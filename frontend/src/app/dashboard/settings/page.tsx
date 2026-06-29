"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, User, Database, HardDrive, Settings, Key, ChevronRight, Save, Loader2, Eye, EyeOff, Copy, Check, Plus, Trash2, ShieldCheck, Activity, RefreshCw, Terminal, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Tienne } from "next/font/google";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  useApiKeys, useCreateApiKey, useRevokeApiKey,
  type ApiKeyRow,
} from "@/lib/hooks/use-api-keys";
import { useModels } from "@/lib/hooks/use-models";

const tienne = Tienne({ subsets: ["latin"], weight: ["400", "700"] });

// ── sidebar nav items ──────────────────────────────────────────────────────────
const NAV = [
  { id: "profile",  icon: User,      label: "Account" },
  { id: "models",   icon: Database,  label: "Model preferences" },
  { id: "storage",  icon: HardDrive, label: "Storage & paths" },
  { id: "api-keys", icon: Key,       label: "API keys" },
  { id: "general",  icon: Settings,  label: "General" },
] as const;

type Tab = (typeof NAV)[number]["id"];

// ── reusable primitives ────────────────────────────────────────────────────────

function SectionCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="mb-5 border-b pb-4">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function PasswordInput({ placeholder }: { placeholder: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input type={show ? "text" : "password"} placeholder={placeholder} className="pr-9" />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
      >
        {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

function SaveRow({ saving, onClick }: { saving: boolean; onClick: () => void }) {
  return (
    <div className="flex justify-end">
      <Button size="sm" onClick={onClick} disabled={saving}>
        {saving ? (
          <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>
        ) : (
          <><Save className="h-3.5 w-3.5" /> Save changes</>
        )}
      </Button>
    </div>
  );
}

// ── Code block with copy button ────────────────────────────────────────────────

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative rounded-lg border bg-[#0d1117] overflow-hidden">
      <button
        onClick={copy}
        className="absolute right-3 top-3 z-10 rounded-md border border-white/10 bg-white/5 p-1.5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
        title="Copy code"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
      <pre className="overflow-x-auto p-4 pr-12 text-[11.5px] leading-[1.7] font-mono text-[#e6edf3] whitespace-pre">
        {code}
      </pre>
    </div>
  );
}

// ── section components (Profile / ModelPrefs / Storage / General unchanged) ────

function ProfileSection() {
  const [saving, setSaving] = useState(false);
  const save = () => {
    setSaving(true);
    setTimeout(() => { setSaving(false); toast.success("Profile saved."); }, 800);
  };
  return (
    <div className="flex flex-col gap-6">
      <SectionCard title="Personal info" description="Your display name and email address.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email">
            <Input placeholder="you@example.com" />
          </Field>
          <Field label="Display name">
            <Input placeholder="Your name" />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Change password" description="Update your login credentials.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Current password">
            <PasswordInput placeholder="••••••••" />
          </Field>
          <Field label="New password">
            <PasswordInput placeholder="••••••••" />
          </Field>
        </div>
      </SectionCard>

      <SaveRow saving={saving} onClick={save} />
    </div>
  );
}

function ModelPrefsSection() {
  const [saving, setSaving] = useState(false);
  const save = () => {
    setSaving(true);
    setTimeout(() => { setSaving(false); toast.success("Model preferences saved."); }, 800);
  };
  return (
    <div className="flex flex-col gap-6">
      <SectionCard title="Default base model" description="Used when starting a new conversation with no explicit model selected.">
        <Field label="Base model">
          <Select>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Select a model" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Models</SelectLabel>
                <SelectItem value="llama-3.2-1b-instruct">Llama 3.2 1B Instruct</SelectItem>
                <SelectItem value="qwen-2.5-3b-instruct">Qwen 2.5 3B Instruct</SelectItem>
                <SelectItem value="deepseek-r1-distill-1.5b">DeepSeek-R1 Distill 1.5B</SelectItem>
                <SelectItem value="gemma-3-1b-it">Gemma 3 1B IT</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Default system prompt">
          <textarea
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            defaultValue="You are a helpful, respectful, and honest local AI assistant."
          />
        </Field>
      </SectionCard>

      <SectionCard title="Inference parameters" description="Applied to all conversations unless overridden in the playground sidebar.">
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Temperature" hint="Higher values make output more creative and random.">
            <Input type="number" step="0.1" min="0" max="2" defaultValue="0.7" />
          </Field>
          <Field label="Max tokens" hint="Maximum length of each generated response.">
            <Input type="number" defaultValue="2048" />
          </Field>
          <Field label="Top-p" hint="Nucleus sampling — lower values focus output.">
            <Input type="number" step="0.05" min="0" max="1" defaultValue="1.0" />
          </Field>
          <Field label="Context window" hint="Number of tokens retained from conversation history.">
            <Input type="number" defaultValue="4096" />
          </Field>
        </div>
      </SectionCard>

      <SaveRow saving={saving} onClick={save} />
    </div>
  );
}

function StorageSection() {
  const [saving, setSaving] = useState(false);
  const save = () => {
    setSaving(true);
    setTimeout(() => { setSaving(false); toast.success("Paths saved."); }, 800);
  };
  return (
    <div className="flex flex-col gap-6">
      <SectionCard title="Storage paths" description="Directories where Forge writes model adapters, dataset files, and training logs.">
        <div className="flex flex-col gap-4">
          {[
            { label: "Datasets root",    value: "storage/datasets" },
            { label: "Adapters root",    value: "storage/adapters" },
            { label: "Uploaded models",  value: "storage/uploaded_models" },
            { label: "Training logs",    value: "storage/logs" },
            { label: "Base model GGUFs", value: "storage/models" },
          ].map((p) => (
            <Field key={p.label} label={p.label}>
              <Input defaultValue={p.value} className="font-mono text-xs" />
            </Field>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Docker settings" description="Configuration for the llama.cpp inference containers.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Container image" hint="Pulled from ghcr.io by default.">
            <Input defaultValue="ghcr.io/ggml-org/llama.cpp:server" className="font-mono text-xs" />
          </Field>
          <Field label="Health-check timeout (s)" hint="Seconds to wait for container readiness.">
            <Input type="number" defaultValue="600" />
          </Field>
        </div>
      </SectionCard>

      <SaveRow saving={saving} onClick={save} />
    </div>
  );
}

function GeneralSection() {
  const [saving, setSaving] = useState(false);
  const save = () => {
    setSaving(true);
    setTimeout(() => { setSaving(false); toast.success("Settings saved."); }, 800);
  };
  return (
    <div className="flex flex-col gap-6">
      <SectionCard title="Appearance" description="Choose your preferred interface theme.">
        <Field label="Theme">
          <Select>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Select a theme" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Themes</SelectLabel>
                <SelectItem value="system">System default</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
      </SectionCard>

      <SectionCard title="Danger zone" description="Irreversible actions — proceed with care.">
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="mb-3 text-sm font-medium text-destructive">Delete account</p>
          <p className="mb-4 text-xs text-muted-foreground">
            Permanently removes your account, all models, datasets, and conversations. This cannot be undone.
          </p>
          <Button variant="destructive" size="sm">Delete my account</Button>
        </div>
      </SectionCard>

      <SaveRow saving={saving} onClick={save} />
    </div>
  );
}

// ── Key reveal dialog ──────────────────────────────────────────────────────────

function KeyRevealDialog({ rawKey, onClose }: { rawKey: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(rawKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            Save your API key
          </DialogTitle>
          <DialogDescription>
            This key is shown <strong>only once</strong>. Copy it now — you will not be able to see it again.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
          <code className="flex-1 break-all font-mono text-xs text-violet-400 select-all">
            {rawKey}
          </code>
          <button onClick={copy} className="shrink-0 rounded p-1.5 hover:bg-secondary transition-colors">
            {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
        <DialogFooter>
          <Button onClick={onClose} className="w-full">I&apos;ve saved it — close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Usage bar ──────────────────────────────────────────────────────────────────

function UsageBar({ used, limit }: { used: number; limit: number | null }) {
  if (!limit) {
    return <span className="text-[10px] text-muted-foreground">{used.toLocaleString()} tokens · unlimited</span>;
  }
  const pct = Math.min((used / limit) * 100, 100);
  const color = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-yellow-500" : "bg-violet-500";
  return (
    <div className="flex flex-col gap-1 mt-1">
      <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-muted-foreground">
        {used.toLocaleString()} / {limit.toLocaleString()} tokens ({pct.toFixed(1)}%)
      </span>
    </div>
  );
}

// ── Quick-start code snippet (live, uses real key + real models) ───────────────

function ApiQuickStart({ keys, serverUrl }: { keys: ApiKeyRow[]; serverUrl: string }) {
  const { data: models } = useModels();
  const [open, setOpen] = useState(false);

  // Pick the first active key's prefix for display, or a placeholder
  const exampleKey = keys.find((k) => k.is_active)?.prefix
    ? `${keys.find((k) => k.is_active)!.prefix}...`
    : "sk-local-<your-key-here>";

  // Build a model list comment from real models
  const modelListComment = useMemo(() => {
    if (!models || models.length === 0) return `#   (no models registered yet — go to Models tab to create one)`;
    return models
      .map((m) => {
        const slug = m.display_name.toLowerCase().replace(/ /g, "-");
        const tag = m.is_base_model ? "base" : "fine-tuned";
        return `#   "${slug}"  ← ${tag}: ${m.display_name}`;
      })
      .join("\n");
  }, [models]);

  // First ready/completed model slug for the default MODEL= line
  const defaultModelSlug = useMemo(() => {
    if (!models || models.length === 0) return "tinyllama";
    const ready = models.find(
      (m) => m.status === "READY" || m.status === "COMPLETED"
    );
    return ready
      ? ready.display_name.toLowerCase().replace(/ /g, "-")
      : models[0].display_name.toLowerCase().replace(/ /g, "-");
  }, [models]);

  const code = `"""
Forge API test script — drop this into your project and run it.
Install deps first:  pip install openai
"""

from openai import OpenAI

# ── 1. Configure the client ───────────────────────────────────────────────────
#   base_url  → your Forge server address (change if not running locally)
#   api_key   → copy a full key from "Active keys" above (shown once on creation)
client = OpenAI(
    base_url="${serverUrl}/v1",
    api_key="${exampleKey}",  # ← paste your full sk-local-... key here
)

# ── 2. Pick a model ───────────────────────────────────────────────────────────
#   Run GET ${serverUrl}/v1/models to see every available model.
#   Your registered models:
${modelListComment}
MODEL = "${defaultModelSlug}"

# ── 3. Send a chat completion ─────────────────────────────────────────────────
print(f"Sending request to model: {MODEL!r}")
response = client.chat.completions.create(
    model=MODEL,
    messages=[
        {
            "role": "system",
            "content": "You are a helpful assistant.",  # ← customise as needed
        },
        {
            "role": "user",
            "content": "Help me draft a vacation policy.",
        },
    ],
    max_tokens=256,
    temperature=0.7,   # 0 = deterministic, 2 = very creative
    top_p=1.0,         # nucleus sampling — lower values focus the output
)

# ── 4. Print the response ─────────────────────────────────────────────────────
print("\\nResponse:")
print(response.choices[0].message.content)

# ── 5. Token usage ────────────────────────────────────────────────────────────
#   Each request deducts tokens from your key's budget.
#   Check the usage bar in Forge Settings → API keys after running this.
usage = response.usage
if usage:
    print(f"\\nTokens used — prompt: {usage.prompt_tokens}, "
          f"completion: {usage.completion_tokens}, "
          f"total: {usage.total_tokens}")`;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-6 py-4 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-violet-500/10">
            <Terminal className="h-3.5 w-3.5 text-violet-500" />
          </div>
          <div>
            <p className="text-sm font-semibold">Quick-start code</p>
            <p className="text-xs text-muted-foreground">
              Python snippet pre-filled with your server URL and models
            </p>
          </div>
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t px-6 pb-6 pt-4 flex flex-col gap-3">
          {/* Install hint */}
          <div className="flex items-center gap-2 rounded-lg border border-violet-500/20 bg-violet-500/5 px-3 py-2">
            <span className="text-[11px] text-violet-400 font-mono">pip install openai</span>
            <span className="text-[11px] text-muted-foreground">— only dependency needed</span>
          </div>

          <CodeBlock code={code} />

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Replace the <code className="font-mono text-violet-400">api_key</code> value with the full{" "}
            <code className="font-mono text-violet-400">sk-local-…</code> key shown when you created it.
            Token usage updates in Forge after each request — watch the usage bar above refresh.
          </p>
        </div>
      )}
    </div>
  );
}

// ── API Keys section ───────────────────────────────────────────────────────────

function ApiKeysSection() {
  const { data: keys, isLoading, refetch } = useApiKeys();
  const createKey = useCreateApiKey();
  const revokeKey = useRevokeApiKey();

  const [newName, setNewName]         = useState("");
  const [tokenLimit, setTokenLimit]   = useState("1000000");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [revoking, setRevoking]       = useState<ApiKeyRow | null>(null);
  const [copiedId, setCopiedId]       = useState<number | null>(null);

  // Server URL — assume same origin in production; localhost for dev
  const serverUrl =
    typeof window !== "undefined"
      ? window.location.origin.replace(/:3000$/, ":8000") // Next dev → FastAPI
      : "http://localhost:8000";

  const create = () => {
    if (!newName.trim()) return;
    const limit = tokenLimit && !isNaN(Number(tokenLimit)) ? Number(tokenLimit) : 1_000_000;
    createKey.mutate(
      { name: newName.trim(), token_limit: limit },
      {
        onSuccess: (res) => {
          setNewName("");
          setRevealedKey(res.plain_text_key);
          toast.success(`Key "${res.key.name}" created.`);
        },
        onError: (err) => toast.error(err.message),
      }
    );
  };

  const confirmRevoke = () => {
    if (!revoking) return;
    revokeKey.mutate(revoking.id, {
      onSuccess: () => {
        toast.success(`Key "${revoking.name}" revoked.`);
        setRevoking(null);
      },
      onError: (err) => toast.error(err.message),
    });
  };

  const copyPrefix = (k: ApiKeyRow) => {
    navigator.clipboard.writeText(k.prefix);
    setCopiedId(k.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const formatDate = (iso: string) =>
    iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "—";

  const formatRelative = (iso: string | null) => {
    if (!iso) return "Never used";
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Active keys list */}
      <SectionCard
        title="Active keys"
        description="Use these keys in the Authorization header to call your fine-tuned models via the OpenAI-compatible gateway."
      >
        {isLoading && (
          <div className="flex flex-col gap-2">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        )}

        {!isLoading && (keys?.length ?? 0) === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No active API keys. Create one below.
          </p>
        )}

        {keys && keys.length > 0 && (
          <div className="flex flex-col divide-y rounded-lg border">
            {keys.map((k) => (
              <div key={k.id} className="flex flex-col gap-1 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{k.name}</span>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <code className="font-mono">{k.prefix}…</code>
                      <span>·</span>
                      <span>Created {formatDate(k.created_at)}</span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Activity className="h-3 w-3" />
                        {formatRelative(k.last_used_at)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => copyPrefix(k)}
                      className="rounded p-1 hover:bg-secondary transition-colors"
                      title="Copy prefix"
                    >
                      {copiedId === k.id
                        ? <Check className="h-3.5 w-3.5 text-emerald-500" />
                        : <Copy className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      onClick={() => setRevoking(k)}
                      className="rounded p-1 hover:bg-destructive/10 hover:text-destructive transition-colors"
                      title="Revoke key"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <UsageBar used={k.tokens_used} limit={k.token_limit} />
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 self-end text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className="h-3 w-3" /> Refresh
        </button>
      </SectionCard>

      {/* Create new key */}
      <SectionCard
        title="Create a new key"
        description="The full key value is shown exactly once — copy it immediately after creation."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Key name">
            <Input
              placeholder="e.g. Production, CI pipeline"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && create()}
            />
          </Field>
          <Field label="Token limit" hint="Total tokens this key may use.">
            <Input
              type="number"
              min="1000"
              step="100000"
              value={tokenLimit}
              onChange={(e) => setTokenLimit(e.target.value)}
            />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={create} disabled={createKey.isPending || !newName.trim()}>
            {createKey.isPending
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Creating…</>
              : <><Plus className="h-3.5 w-3.5" /> Create key</>}
          </Button>
        </div>
      </SectionCard>

      {/* Quick-start snippet — shown once there are keys */}
      <ApiQuickStart keys={keys ?? []} serverUrl={serverUrl} />

      {/* Key reveal modal */}
      {revealedKey && (
        <KeyRevealDialog rawKey={revealedKey} onClose={() => setRevealedKey(null)} />
      )}

      {/* Revoke confirm modal */}
      {revoking && (
        <Dialog open onOpenChange={(o) => !o && setRevoking(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-destructive">Revoke key?</DialogTitle>
              <DialogDescription>
                &ldquo;{revoking.name}&rdquo; will stop working immediately. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setRevoking(null)} disabled={revokeKey.isPending}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmRevoke} disabled={revokeKey.isPending}>
                {revokeKey.isPending ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Revoking…</> : "Revoke"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ── page ───────────────────────────────────────────────────────────────────────

const SECTION_LABELS: Record<Tab, string> = {
  profile:    "Account",
  models:     "Model preferences",
  storage:    "Storage & paths",
  "api-keys": "API keys",
  general:    "General",
};

export default function SettingsPage() {
  const [active, setActive] = useState<Tab>("profile");
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    const savedTab = localStorage.getItem("forge_active_tab") as Tab;
    if (savedTab && SECTION_LABELS[savedTab]) {
      setActive(savedTab);
    }
    setIsMounted(true);
  }, []);
  const handleTabChange = (id: Tab) => {
    setActive(id);
    localStorage.setItem("forge_active_tab", id);
  };

  if (!isMounted) {
    return null;
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
          <span className="text-sm font-semibold">Settings</span>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
          <span className="text-sm text-muted-foreground">{SECTION_LABELS[active]}</span>
        </div>
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full">
            <Image src="/logo.png" alt="Forge Logo" fill sizes="32px" className="object-cover" />
          </div>
          <span className={`${tienne.className} text-xl font-bold uppercase tracking-[0.15em]`}>
            Forge
          </span>
        </Link>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Settings sidebar */}
        <aside className="flex w-56 shrink-0 flex-col border-r bg-sidebar py-6">
          <p className="mb-2 px-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Settings
          </p>
          <nav className="flex flex-col gap-0.5 px-2">
            {NAV.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => handleTabChange(id)}
                className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors ${
                  active === id
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-8">
          <div className="mx-auto max-w-2xl">
            <h1 className="mb-1 text-lg font-semibold">{SECTION_LABELS[active]}</h1>
            <p className="mb-8 text-sm text-muted-foreground">
              {active === "profile"  && "Manage your account credentials and personal information."}
              {active === "models"   && "Configure default models and inference parameters for the playground."}
              {active === "storage"  && "Control where Forge stores files on the server."}
              {active === "api-keys" && "Manage keys for the OpenAI-compatible /v1/chat/completions gateway."}
              {active === "general"  && "Appearance and account-level actions."}
            </p>

            {active === "profile"  && <ProfileSection />}
            {active === "models"   && <ModelPrefsSection />}
            {active === "storage"  && <StorageSection />}
            {active === "api-keys" && <ApiKeysSection />}
            {active === "general"  && <GeneralSection />}
          </div>
        </main>
      </div>
    </div>
  );
}