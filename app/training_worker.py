import sys
import os
import shutil
import asyncio
import signal
import subprocess
from datetime import datetime
from sqlalchemy import update
from app.database import AsyncSessionLocal
from app.models import Model

_CURRENT_LOG_PATH = None


def _signal_handler(signum, frame):
    try:
        if _CURRENT_LOG_PATH:
            with open(_CURRENT_LOG_PATH, "a") as f:
                f.write(
                    f"[{datetime.utcnow().strftime('%H:%M:%S')}] SYSTEM: "
                    f"Received termination signal ({signum})\n"
                )
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
            ts = datetime.utcnow().strftime("%H:%M:%S")
            self._write(f"[{ts}] Step {state.global_step} | Loss: {logs['loss']:.4f}")

    def on_epoch_end(self, args, state, control, **kwargs):
        ts = datetime.utcnow().strftime("%H:%M:%S")
        self._write(f"[{ts}] Epoch {int(state.epoch)} complete.")


def _get_lora_target_modules(model) -> list:
    arch = type(model).__name__.lower()
    known = {
        "llama":     ["q_proj", "v_proj", "k_proj", "o_proj"],
        "mistral":   ["q_proj", "v_proj", "k_proj", "o_proj"],
        "qwen2":     ["q_proj", "v_proj", "k_proj", "o_proj"],
        "gemma":     ["q_proj", "v_proj"],
        "deepseek":  ["q_proj", "v_proj", "k_proj", "o_proj"],
        "phi":       ["q_proj", "v_proj"],
        "tinyllama": ["q_proj", "v_proj"],
    }
    for key, modules in known.items():
        if key in arch:
            return modules
    names = {
        name.split(".")[-1]
        for name, mod in model.named_modules()
        if isinstance(mod, torch.nn.Linear)
    }
    names.discard("lm_head")
    return list(names) or ["q_proj", "v_proj"]


def _merge_and_convert_to_gguf(
    peft_model,
    tokenizer,
    model_id: int,
    log_fn,
) -> str | None:
    """
    Merges the LoRA adapter weights into the base model and converts to GGUF
    using convert_hf_to_gguf.py from llama.cpp.
    Returns the path to the merged GGUF on success, or None on failure.
    """
    merged_dir  = f"storage/adapters/model_{model_id}_merged"
    merged_gguf = f"storage/adapters/model_{model_id}_merged.gguf"

    log_fn("Merging LoRA adapter into base model weights...")
    try:
        merged_model = peft_model.merge_and_unload()
        merged_model.save_pretrained(merged_dir)
        tokenizer.save_pretrained(merged_dir)
        log_fn(f"Merged model saved to {merged_dir}")
    except Exception as e:
        log_fn(f"WARNING: Merge failed: {e}")
        log_fn("  Chat will use the base model only.")
        return None

    convert_script = os.path.join(
        os.path.dirname(__file__), "llama_cpp_repo", "convert_hf_to_gguf.py"
    )

    if not os.path.exists(convert_script):
        log_fn("WARNING: convert_hf_to_gguf.py not found — skipping GGUF conversion.")
        log_fn("  Chat will use the base model only.")
        shutil.rmtree(merged_dir, ignore_errors=True)
        return None

    log_fn("Converting merged model to GGUF (f16)...")
    try:
        result = subprocess.run(
            [
                sys.executable,
                convert_script,
                merged_dir,
                "--outtype", "f16",
                "--outfile", merged_gguf,
            ],
            capture_output=True,
            text=True,
            timeout=600,
        )
        if result.returncode != 0:
            log_fn(f"WARNING: GGUF conversion failed (exit {result.returncode}).")
            log_fn(f"  stderr: {result.stderr[:600]}")
            log_fn("  Chat will use the base model only.")
            shutil.rmtree(merged_dir, ignore_errors=True)
            return None

        log_fn(f"Merged GGUF written to {merged_gguf}")
        shutil.rmtree(merged_dir, ignore_errors=True)
        return merged_gguf

    except subprocess.TimeoutExpired:
        log_fn("WARNING: GGUF conversion timed out. Chat will use base model only.")
        shutil.rmtree(merged_dir, ignore_errors=True)
        return None
    except Exception as e:
        log_fn(f"WARNING: GGUF conversion error: {e}. Chat will use base model only.")
        shutil.rmtree(merged_dir, ignore_errors=True)
        return None


async def run_training(
    model_id: int,
    dataset_path: str,
    hf_model_id: str,
    num_epochs: int = 3,
    learning_rate: float = 2e-4,
    batch_size: int = 1,
    warmup_steps: int = 10,
    max_seq_length: int = 512,
):
    log_path   = f"storage/logs/training_{model_id}.log"
    adapter_dir = f"storage/adapters/model_{model_id}_lora"

    os.makedirs("storage/logs", exist_ok=True)
    os.makedirs("storage/adapters", exist_ok=True)

    def log(msg: str):
        with open(log_path, "a") as f:
            f.write(f"[{datetime.utcnow().strftime('%H:%M:%S')}] SYSTEM: {msg}\n")

    with open(log_path, "w") as f:
        f.write(
            f"[{datetime.utcnow().strftime('%H:%M:%S')}] SYSTEM: "
            f"Initializing LoRA fine-tuning pipeline...\n"
        )

    global _CURRENT_LOG_PATH
    _CURRENT_LOG_PATH = log_path
    try:
        signal.signal(signal.SIGTERM, _signal_handler)
        signal.signal(signal.SIGINT, _signal_handler)
    except Exception:
        pass

    try:
        # ── Mark model as TRAINING ──────────────────────────────────────────
        async with AsyncSessionLocal() as db:
            await db.execute(
                update(Model).where(Model.id == model_id).values(status="TRAINING")
            )
            await db.commit()

        log(f"Training config: epochs={num_epochs}, lr={learning_rate}, "
            f"batch_size={batch_size}, warmup_steps={warmup_steps}, "
            f"max_seq_length={max_seq_length}")

        # ── Tokenizer ───────────────────────────────────────────────────────
        log(f"Loading tokenizer for {hf_model_id}...")
        tok_kwargs = {"trust_remote_code": True}
        if "gemma" in hf_model_id.lower():
            tok_kwargs["use_fast"] = False

        tokenizer = AutoTokenizer.from_pretrained(hf_model_id, **tok_kwargs)
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token
        if tokenizer.chat_template is None:
            tokenizer.chat_template = (
                "{% for message in messages %}"
                "{{ message['role'] + ': ' + message['content'] + '\n' }}"
                "{% endfor %}"
            )

        # ── Base model ──────────────────────────────────────────────────────
        log(f"Loading base model {hf_model_id} on CPU (float32)...")
        model = AutoModelForCausalLM.from_pretrained(
            hf_model_id,
            torch_dtype=torch.float32,
            device_map="cpu",
            trust_remote_code=True,
        )
        model.config.use_cache = False

        # ── LoRA adapters ───────────────────────────────────────────────────
        log("Applying LoRA adapters...")
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

        # ── Dataset ─────────────────────────────────────────────────────────
        log(f"Loading dataset from {dataset_path}...")
        dataset = load_dataset("json", data_files=dataset_path, split="train")

        def format_and_tokenize(example):
            try:
                prompt = tokenizer.apply_chat_template(
                    example["messages"], tokenize=False, add_generation_prompt=False
                )
            except Exception:
                prompt = "\n".join(f"{m['role']}: {m['content']}" for m in example["messages"])
            return tokenizer(prompt, truncation=True, max_length=max_seq_length, padding="max_length")

        tokenized_dataset = dataset.map(
            format_and_tokenize,
            remove_columns=dataset.column_names,
            desc="Tokenizing",
        )
        log(f"Dataset tokenized: {len(tokenized_dataset)} examples.")

        data_collator = DataCollatorForLanguageModeling(tokenizer=tokenizer, mlm=False)

        # ── Training ────────────────────────────────────────────────────────
        log("Starting training loop...")
        training_args = TrainingArguments(
            output_dir=adapter_dir,
            per_device_train_batch_size=batch_size,
            gradient_accumulation_steps=max(1, 4 // batch_size),
            num_train_epochs=num_epochs,
            learning_rate=learning_rate,
            warmup_steps=warmup_steps,
            logging_steps=1,
            use_cpu=True,
            save_strategy="no",
            report_to="none",
            optim="adamw_torch",
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

        # ── Save LoRA adapter ────────────────────────────────────────────────
        log("Saving LoRA adapter (HF format)...")
        model.save_pretrained(adapter_dir)
        tokenizer.save_pretrained(adapter_dir)
        log(f"Adapter saved to {adapter_dir}")

        # ── Merge + GGUF conversion ──────────────────────────────────────────
        log("Merging LoRA weights into base model and converting to GGUF...")
        merged_gguf_path = _merge_and_convert_to_gguf(model, tokenizer, model_id, log)

        update_values: dict = {
            "status": "COMPLETED",
            "adapter_path": adapter_dir,
        }

        if merged_gguf_path and os.path.isfile(merged_gguf_path):
            update_values["base_model_path"] = merged_gguf_path
            log(f"SUCCESS: Training complete. Serving fine-tuned model from {merged_gguf_path}")
        else:
            log("WARNING: GGUF conversion failed. base_model_path unchanged.")

        async with AsyncSessionLocal() as db:
            await db.execute(
                update(Model)
                .where(Model.id == model_id)
                .values(**update_values)
            )
            await db.commit()

    except Exception as e:
        import traceback
        log(f"ERROR: {e}")
        log(traceback.format_exc())
        async with AsyncSessionLocal() as db:
            await db.execute(
                update(Model).where(Model.id == model_id).values(status="FAILED")
            )
            await db.commit()

    finally:
        with open(log_path, "a") as f:
            f.write("JOB_FINISHED\n")


if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: training_worker <model_id> <dataset_path> <hf_model_id> "
              "[num_epochs] [learning_rate] [batch_size] [warmup_steps] [max_seq_length]",
              file=sys.stderr)
        sys.exit(1)

    _model_id     = int(sys.argv[1])
    _dataset_path = sys.argv[2]
    _hf_model_id  = sys.argv[3]
    _num_epochs   = int(sys.argv[4])   if len(sys.argv) > 4 else 3
    _lr           = float(sys.argv[5]) if len(sys.argv) > 5 else 2e-4
    _batch_size   = int(sys.argv[6])   if len(sys.argv) > 6 else 1
    _warmup       = int(sys.argv[7])   if len(sys.argv) > 7 else 10
    _max_seq      = int(sys.argv[8])   if len(sys.argv) > 8 else 512

    asyncio.run(run_training(
        _model_id,
        _dataset_path,
        _hf_model_id,
        num_epochs=_num_epochs,
        learning_rate=_lr,
        batch_size=_batch_size,
        warmup_steps=_warmup,
        max_seq_length=_max_seq,
    ))