import sys
import os
import asyncio
import subprocess
from datetime import datetime
from sqlalchemy import update
from app.database import AsyncSessionLocal
from app.models import Model

# Machine Learning Imports
import torch
from transformers import (
    AutoModelForCausalLM, 
    AutoTokenizer, 
    TrainingArguments, 
    Trainer, 
    TrainerCallback,
    DataCollatorForLanguageModeling # <-- THE FIX: Official Label Handler
)
from peft import get_peft_model, LoraConfig, TaskType
from datasets import load_dataset

# Disable WANDB to prevent it from trying to log to the cloud
os.environ["WANDB_DISABLED"] = "true"

class SSELoggingCallback(TrainerCallback):
    """Custom callback to hijack HuggingFace logs and push them to our SSE stream."""
    def __init__(self, log_path):
        self.log_path = log_path
        
    def _write(self, msg):
        with open(self.log_path, "a") as f:
            f.write(msg + "\n")
            
    def on_log(self, args, state, control, logs=None, **kwargs):
        if logs and "loss" in logs:
            timestamp = datetime.utcnow().strftime("%H:%M:%S")
            self._write(f"[{timestamp}] Step {state.global_step} | Loss: {logs['loss']:.4f}")

async def run_training(model_id: int, dataset_path: str, hf_model_id: str):
    log_path = f"storage/logs/training_{model_id}.log"
    adapter_hf_dir = f"storage/adapters/model_{model_id}_hf"
    final_gguf_path = f"storage/adapters/model_{model_id}_lora.gguf"
    
    os.makedirs("storage/logs", exist_ok=True)
    os.makedirs("storage/adapters", exist_ok=True)

    def log(msg: str):
        with open(log_path, "a") as f:
            f.write(f"[{datetime.utcnow().strftime('%H:%M:%S')}] SYSTEM: {msg}\n")

    with open(log_path, "w") as f:
        f.write(f"[{datetime.utcnow().strftime('%H:%M:%S')}] SYSTEM: Initializing real HuggingFace LoRA pipeline...\n")

    try:
        async with AsyncSessionLocal() as db:
            await db.execute(update(Model).where(Model.id == model_id).values(status="TRAINING"))
            await db.commit()

        log(f"Loading base PyTorch model ({hf_model_id}) on CPU. This will take a moment...")
        tokenizer = AutoTokenizer.from_pretrained(hf_model_id)
        
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token
            
        model = AutoModelForCausalLM.from_pretrained(
            hf_model_id, 
            torch_dtype=torch.float32, 
            device_map="cpu"
        )
        
        log("Applying Low-Rank Adaptation (LoRA) matrices to weight layers...")
        peft_config = LoraConfig(
            task_type=TaskType.CAUSAL_LM,
            inference_mode=False,
            r=8,
            lora_alpha=16,
            lora_dropout=0.05
        )
        model = get_peft_model(model, peft_config)
        
        log(f"Formatting dataset {dataset_path} for chat template...")
        dataset = load_dataset("json", data_files=dataset_path, split="train")
        
        def format_and_tokenize(example):
            prompt = tokenizer.apply_chat_template(example["messages"], tokenize=False)
            # Memory optimization: sequence length 64
            tokenized = tokenizer(prompt, truncation=True, max_length=64, padding="max_length")
            return tokenized
            
        tokenized_dataset = dataset.map(format_and_tokenize, remove_columns=dataset.column_names)
        
        # THE FIX: Explicitly handle Causal LM labels
        data_collator = DataCollatorForLanguageModeling(tokenizer=tokenizer, mlm=False)
        
        log("Commencing CPU PyTorch Training Loop...")
        training_args = TrainingArguments(
            output_dir=adapter_hf_dir,
            per_device_train_batch_size=1,
            gradient_accumulation_steps=1,
            max_steps=3, 
            logging_steps=1,
            use_cpu=True,
            save_strategy="no",
            report_to="none",
            optim="sgd", # Memory optimization
            remove_unused_columns=False # THE FIX: Stop deleting our data!
        )
        
        trainer = Trainer(
            model=model,
            args=training_args,
            train_dataset=tokenized_dataset,
            data_collator=data_collator,
            callbacks=[SSELoggingCallback(log_path)]
        )
        
        trainer.train()
        
        log("Saving raw PyTorch LoRA adapter...")
        model.save_pretrained(adapter_hf_dir)
        
        log("Converting adapter to GGUF format using llama.cpp...")
        
        # Flush standard out to ensure the sysout log is synced
        sys.stdout.flush() 
        sys.stderr.flush()

        subprocess.run(
            [sys.executable, "app/llama_cpp_repo/convert_lora_to_gguf.py", adapter_hf_dir, "--outfile", final_gguf_path], 
            check=True
        )
        
        async with AsyncSessionLocal() as db:
            await db.execute(
                update(Model)
                .where(Model.id == model_id)
                .values(status="COMPLETED", adapter_path=final_gguf_path)
            )
            await db.commit()

        log(f"SUCCESS: Adapter converted and serialized to {final_gguf_path}")
        
    except Exception as e:
        log(f"ERROR: Pipeline failed: {str(e)}")
        async with AsyncSessionLocal() as db:
            await db.execute(update(Model).where(Model.id == model_id).values(status="FAILED"))
            await db.commit()
            
    finally:
        with open(log_path, "a") as f:
            f.write("JOB_FINISHED\n")

if __name__ == "__main__":
    if len(sys.argv) < 4:
        sys.exit(1)
    m_id = int(sys.argv[1])
    d_path = sys.argv[2]
    hf_id = sys.argv[3] # Extract the dynamic HF ID
    asyncio.run(run_training(m_id, d_path, hf_id))
