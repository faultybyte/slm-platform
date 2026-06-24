import Link from "next/link";
import { Terminal, Shield, Zap, Cpu, ArrowRight, GitBranch, Lock, Activity } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand text-sm font-semibold text-brand-foreground">
              F
            </div>
            <span className="text-sm font-semibold">Forge SLM</span>
          </div>
          <div className="hidden items-center gap-6 sm:flex">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#models" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Models</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Sign in
            </Link>
            <Link
              href="/login"
              className="flex items-center gap-1.5 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 transition-opacity"
            >
              Open console <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative mx-auto max-w-6xl px-6 pb-24 pt-28 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />
          Platform v1.0 — now in early access
        </div>

        <h1 className="mb-6 text-5xl font-semibold tracking-tight sm:text-6xl md:text-7xl">
          Fine-tune, run, and chat with<br />
          <span className="text-brand">language models</span><br />
          on your own hardware.
        </h1>

        <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground">
          Forge is a self-hosted platform for training small language models from your own datasets,
          evaluating them, and deploying them for inference — entirely on-premise. No data leaves your machine.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/register"
            className="flex items-center gap-2 rounded-md bg-foreground px-6 py-3 text-sm font-medium text-background hover:opacity-90 transition-opacity"
          >
            Get started free <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/login"
            className="flex items-center gap-2 rounded-md border px-6 py-3 text-sm font-medium text-foreground hover:bg-secondary transition-colors"
          >
            Sign in to console
          </Link>
        </div>

        {/* Terminal preview */}
        <div className="relative mx-auto mt-20 max-w-3xl rounded-xl border bg-card text-left shadow-sm">
          <div className="flex items-center gap-1.5 border-b px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-green-400/60" />
            <span className="ml-4 text-xs text-muted-foreground">forge training log — model_26</span>
          </div>
          <div className="space-y-1 p-5 font-mono text-xs leading-relaxed text-muted-foreground">
            <p><span className="text-brand">[08:14:02]</span> SYSTEM: Initializing LoRA fine-tuning pipeline...</p>
            <p><span className="text-brand">[08:14:09]</span> SYSTEM: Loading tokenizer for TinyLlama/TinyLlama-1.1B-Chat-v1.0</p>
            <p><span className="text-brand">[08:14:21]</span> SYSTEM: Applying LoRA adapters... target: [q_proj, v_proj]</p>
            <p><span className="text-brand">[08:14:22]</span> SYSTEM: Trainable params: 2,097,152 / 1,100,048,640 (0.19%)</p>
            <p><span className="text-brand">[08:14:23]</span> SYSTEM: Dataset tokenized: 1,069 examples.</p>
            <p><span className="text-green-500">[08:16:44]</span> Step 12 | Loss: <span className="text-foreground">1.4821</span></p>
            <p><span className="text-green-500">[08:19:01]</span> Step 24 | Loss: <span className="text-foreground">0.9134</span></p>
            <p><span className="text-green-500">[08:21:33]</span> Step 36 | Loss: <span className="text-foreground">0.6247</span></p>
            <p className="text-foreground"><span className="text-brand">[08:23:11]</span> SYSTEM: SUCCESS — adapter saved. Converting to GGUF...</p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Platform capabilities</p>
          <h2 className="mb-16 text-3xl font-semibold">Everything in one place</h2>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: GitBranch,
                title: "LoRA fine-tuning",
                body: "Upload a JSONL dataset and start a fine-tuning run in two clicks. Training telemetry streams live as it happens.",
              },
              {
                icon: Lock,
                title: "Air-gapped by default",
                body: "Models, datasets, and conversations never leave your hardware. Full on-premise deployment with no cloud dependency.",
              },
              {
                icon: Zap,
                title: "Instant inference",
                body: "Each model gets its own llama.cpp Docker container. Switch models mid-conversation without restarting anything.",
              },
              {
                icon: Cpu,
                title: "Bring your own weights",
                body: "Upload any GGUF, safetensors, or .bin file and chat with it immediately. No training required.",
              },
              {
                icon: Activity,
                title: "Dataset management",
                body: "Validate, version, and organise your fine-tuning datasets. The platform checks JSONL compliance before training starts.",
              },
              {
                icon: Shield,
                title: "Multi-tenant auth",
                body: "Every user gets isolated model and dataset storage. API key management for programmatic access via the OpenAI-compatible gateway.",
              },
            ].map((f) => (
              <div key={f.title} className="group rounded-xl border bg-card p-6 transition-colors hover:border-foreground/20">
                <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                  <f.icon className="h-4.5 w-4.5 text-muted-foreground" />
                </div>
                <h3 className="mb-2 text-sm font-semibold">{f.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Models */}
      <section id="models" className="border-t bg-secondary/30">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Supported base models</p>
          <h2 className="mb-12 text-3xl font-semibold">Ready to fine-tune</h2>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { name: "TinyLlama 1.1B Chat", arch: "tinyllama", note: "Best for local CPU — no auth required", badge: "Recommended" },
              { name: "Llama 3.2 1B Instruct", arch: "llama3.2-1b", note: "Meta's compact instruction model", badge: "Meta" },
              { name: "Qwen 2.5 3B Instruct", arch: "qwen2.5-3b", note: "Multilingual, strong reasoning", badge: "Qwen" },
              { name: "DeepSeek-R1 Distill 1.5B", arch: "deepseek-r1-distill-qwen-1.5b", note: "Distilled reasoning on edge hardware", badge: "DeepSeek" },
              { name: "Gemma 3 1B IT", arch: "gemma3-1b", note: "Google's smallest instruction model", badge: "Google" },
              { name: "Your model", arch: "custom", note: "Upload any GGUF or safetensors file", badge: "Upload" },
            ].map((m) => (
              <div key={m.arch} className="flex items-start gap-3 rounded-xl border bg-card p-4">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-secondary">
                  <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{m.name}</p>
                    <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {m.badge}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{m.note}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 py-24 text-center">
          <h2 className="text-3xl font-semibold">Start training your first model</h2>
          <p className="max-w-lg text-muted-foreground">
            Upload a dataset, pick a base model, and have a fine-tuned SLM running in under an hour.
          </p>
          <Link
            href="/register"
            className="flex items-center gap-2 rounded-md bg-foreground px-6 py-3 text-sm font-medium text-background hover:opacity-90 transition-opacity"
          >
            Create an account <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-brand text-[10px] font-bold text-brand-foreground">
              F
            </div>
            <span className="text-xs text-muted-foreground">Forge SLM Platform</span>
          </div>
          <p className="text-xs text-muted-foreground">Self-hosted · Air-gapped · Open</p>
        </div>
      </footer>
    </div>
  );
}
