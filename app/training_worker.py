import sys
import os
import asyncio
import signal
from datetime import datetime
from sqlalchemy import update
from app.database import AsyncSessionLocal
from app.models import Model

_CURRENT_LOG_PATH = None

def _signal_handler(signum, frame):
    try:
        if _CURRENT_LOG_PATH:
            with open(_CURRENT_LOG_PATH, "a") as f:
                f.write(f"[{datetime.utcnow().strftime('%H:%M:%S')}] SYSTEM: Received termination signal ({signum})\n")
    except Exception:
        pass
    raise SystemExit(1)

os.environ["WANDB_DISABLED"] = "true"
os.environ["TOKENIZERS_PARALLELISM"] = "false"

import torch
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    TrainingArguments,
    Trainer,
    TrainerCallback,
    DataCollatorForLanguageModeling,
)
from peft import get_peft_model, LoraConfig, TaskType
from datasets import load_dataset


class SSELoggingCallback(TrainerCallback):
    def __init__(self, log_path):
        self.log_path = log_path

    def _write(self, msg):
        with open(self.log_path, "a") as f:
            f.write(msg + "\n")

    def on_log(self, args, state, control, logs=None, **kwargs):
        if logs and "loss" in logs:
            timestamp = datetime.utcnow().strftime("%H:%M:%S")
            self._write(f"[{timestamp}] Step {state.global_step} | Loss: {logs['loss']:.4f}")

    def on_epoch_end(self, args, state, control, **kwargs):
        timestamp = datetime.utcnow().strftime("%H:%M:%S")
        self._write(f"[{timestamp}] Epoch {state.epoch:.0f} complete.")


async def run_training(model_id: int, dataset_path: str, hf_model_id: str):
    log_path = f"storage/logs/training_{model_id}.log"
    adapter_dir = f"storage/adapters/model_{model_id}_lora"

    os.makedirs("storage/logs", exist_ok=True)
    os.makedirs("storage/adapters", exist_ok=True)

    def log(msg: str):
        with open(log_path, "a") as f:
            f.write(f"[{datetime.utcnow().strftime('%H:%M:%S')}] SYSTEM: {msg}\n")

    with open(log_path, "w") as f:
        f.write(f"[{datetime.utcnow().strftime('%H:%M:%S')}] SYSTEM: Initializing LoRA fine-tuning pipeline...\n")

    global _CURRENT_LOG_PATH
    _CURRENT_LOG_PATH = log_path
    try:
        signal.signal(signal.SIGTERM, _signal_handler)
        signal.signal(signal.SIGINT, _signal_handler)
    except Exception:
        pass

    try:
        async with AsyncSessionLocal() as db:
            await db.execute(update(Model).where(Model.id == model_id).values(status="TRAINING"))
            await db.commit()

        log(f"Loading tokenizer for {hf_model_id}...")
        
        # Some model families need trust_remote_code or specific tokenizer args
        tokenizer_kwargs = {"trust_remote_code": True}
        
        # Gemma requires use_fast=False without sentencepiece installed
        if "gemma" in hf_model_id.lower():
            tokenizer_kwargs["use_fast"] = False
            
        tokenizer = AutoTokenizer.from_pretrained(hf_model_id, **tokenizer_kwargs)

        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token
        if tokenizer.chat_template is None:
            # Fallback chat template for models that don't ship one
            tokenizer.chat_template = (
                "{% for message in messages %}"
                "{{ message['role'] + ': ' + message['content'] + '\n' }}"
                "{% endfor %}"
            )

        log(f"Loading base model {hf_model_id} on CPU (float32)...")
        model = AutoModelForCausalLM.from_pretrained(
            hf_model_id,
            torch_dtype=torch.float32,
            device_map="cpu",
            trust_remote_code=True,
        )
        model.config.use_cache = False  # required for gradient checkpointing compat

        log("Applying LoRA adapters...")
        
        # Find the right target modules for the model architecture
        target_modules = _get_lora_target_modules(model)
        log(f"LoRA target modules: {target_modules}")
        
        peft_config = LoraConfig(
            task_type=TaskType.CAUSAL_LM,
            inference_mode=False,
            r=8,
            lora_alpha=16,
            lora_dropout=0.05,
            target_modules=target_modules,
        )
        model = get_peft_model(model, peft_config)
        trainable, total = model.get_nb_trainable_parameters()
        log(f"Trainable params: {trainable:,} / {total:,} ({100*trainable/total:.2f}%)")

        log(f"Loading and tokenizing dataset from {dataset_path}...")
        dataset = load_dataset("json", data_files=dataset_path, split="train")

        def format_and_tokenize(example):
            try:
                prompt = tokenizer.apply_chat_template(
                    example["messages"],
                    tokenize=False,
                    add_generation_prompt=False,
                )
            except Exception:
                # Fallback: concatenate role+content manually
                prompt = "\n".join(
                    f"{m['role']}: {m['content']}" for m in example["messages"]
                )
            tokenized = tokenizer(
                prompt,
                truncation=True,
                max_length=512,
                padding="max_length",
            )
            return tokenized

        tokenized_dataset = dataset.map(
            format_and_tokenize,
            remove_columns=dataset.column_names,
            desc="Tokenizing",
        )
        log(f"Dataset tokenized: {len(tokenized_dataset)} examples.")

        data_collator = DataCollatorForLanguageModeling(tokenizer=tokenizer, mlm=False)

        log("Starting training loop...")
        training_args = TrainingArguments(
            output_dir=adapter_dir,
            per_device_train_batch_size=1,
            gradient_accumulation_steps=4,
            num_train_epochs=2,
            max_steps=2,           
            logging_steps=1,
            use_cpu=True,
            save_strategy="no",
            report_to="none",
            optim="adamw_torch",    # sgd is too unstable for LoRA
            remove_unused_columns=False,
            fp16=False,
            bf16=False,
        )

        trainer = Trainer(
            model=model,
            args=training_args,
            train_dataset=tokenized_dataset,
            data_collator=data_collator,
            callbacks=[SSELoggingCallback(log_path)],
        )

        trainer.train()

        log("Saving LoRA adapter weights...")
        model.save_pretrained(adapter_dir)
        tokenizer.save_pretrained(adapter_dir)
        log(f"Adapter saved to {adapter_dir}")

        async with AsyncSessionLocal() as db:
            await db.execute(
                update(Model)
                .where(Model.id == model_id)
                .values(status="COMPLETED", adapter_path=adapter_dir)
            )
            await db.commit()

        log("SUCCESS: Fine-tuning complete.")

    except Exception as e:
        import traceback
        log(f"ERROR: {str(e)}")
        log(traceback.format_exc())
        async with AsyncSessionLocal() as db:
            await db.execute(update(Model).where(Model.id == model_id).values(status="FAILED"))
            await db.commit()

    finally:
        with open(log_path, "a") as f:
            f.write("JOB_FINISHED\n")


def _get_lora_target_modules(model) -> list[str]:
    """
    Detect which linear layer names to target for LoRA based on the model architecture.
    Falls back to scanning the model's named modules if no known pattern matches.
    """
    arch = type(model).__name__.lower()
    
    known_targets = {
        "llama":    ["q_proj", "v_proj", "k_proj", "o_proj"],
        "mistral":  ["q_proj", "v_proj", "k_proj", "o_proj"],
        "qwen2":    ["q_proj", "v_proj", "k_proj", "o_proj"],
        "gemma":    ["q_proj", "v_proj"],
        "deepseek": ["q_proj", "v_proj", "k_proj", "o_proj"],
        "phi":      ["q_proj", "v_proj"],
        "tinyllama":["q_proj", "v_proj"],
    }
    
    for key, modules in known_targets.items():
        if key in arch:
            return modules

    # Fallback: find all Linear layers and target them
    linear_names = set()
    for name, module in model.named_modules():
        if isinstance(module, torch.nn.Linear):
            linear_names.add(name.split(".")[-1])
    
    # Exclude the LM head
    linear_names.discard("lm_head")
    return list(linear_names) if linear_names else ["q_proj", "v_proj"]


if __name__ == "__main__":
    if len(sys.argv) < 4:
        sys.exit(1)
    m_id = int(sys.argv[1])
    d_path = sys.argv[2]
    hf_id = sys.argv[3]
    asyncio.run(run_training(m_id, d_path, hf_id))