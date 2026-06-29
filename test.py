"""
Forge API key test script.
Run: python test.py

How to find your model identifier:
  1. GET http://localhost:8000/v1/models  (with your API key)
     Each model has an "id" field — use that exact string below.
     e.g. "tinyllama", "my-fine-tuned-hr-model", "model_7"
"""

from pyexpat.errors import messages

from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8000/v1",
    api_key="sk-local-uJuqJA2WGk4z_9xXtcBX1cWtDVWwAD0wK3ycF58Xxhk",
)

# ── Step 1: list available models ─────────────────────────────────────────────
print("Available models:")
models = client.models.list()
for m in models.data:
    # show both the slug id and the numeric alias
    model_id_alias = getattr(m, "model_id", "n/a")
    print(f"  id={m.id!r}   alias={model_id_alias!r}   status={getattr(m, 'status', '?')}")

print()

# ── Step 2: pick a model id from the list above ───────────────────────────────
# Use the "id" field exactly as printed above, e.g.:
#   "tinyllama"                  ← base model
#   "your-fine-tuned-hr-model"   ← fine-tuned model slug
#   "model_7"                    ← numeric alias (also works)
MODEL = "model_29" # <-- change this to your model's id

# ── Step 3: send a chat completion ────────────────────────────────────────────
print(f"Sending request to model: {MODEL!r}")
response = client.chat.completions.create(
    model=MODEL,
    messages=[
            {
                "role": "system", 
                "content": "You are a helpful assistant that only speaks in Shakespearean English."
            },
            {
                "role": "user", 
                "content": "What is the weather like today?"
            }
        ],
    max_tokens=256,
    temperature=0.7,
    top_p=1.0,
)

print("\nResponse:")
print(response.choices[0].message.content)

# ── Step 4: print token usage (updates the key's usage counter in Forge) ──────
usage = response.usage
if usage:
    print(f"\nTokens used — prompt: {usage.prompt_tokens}, "
          f"completion: {usage.completion_tokens}, "
          f"total: {usage.total_tokens}")