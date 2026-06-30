"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  ArrowLeft, User, Database, HardDrive, Settings, Key,
  ChevronRight, Save, Loader2, Eye, EyeOff, Copy, Check,
  Plus, Trash2, ShieldCheck, Activity, RefreshCw, Terminal,
  ChevronDown, ChevronUp,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Tienne } from "next/font/google";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectGroup, SelectItem,
  SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  useApiKeys, useCreateApiKey, useRevokeApiKey, type ApiKeyRow,
} from "@/lib/hooks/use-api-keys";
import { useModels } from "@/lib/hooks/use-models";
import {
  useSettings, useUpdateSettings, useChangePassword,
  type UserSettings, type SettingsPatch,
} from "@/lib/hooks/use-settings";

const tienne = Tienne({ subsets: ["latin"], weight: ["400", "700"] });

// ── sidebar nav ────────────────────────────────────────────────────────────────
const NAV = [
  { id: "profile",  icon: User,      label: "Account" },
  { id: "models",   icon: Database,  label: "Model preferences" },
  { id: "storage",  icon: HardDrive, label: "Storage & paths" },
  { id: "api-keys", icon: Key,       label: "API keys" },
  { id: "general",  icon: Settings,  label: "General" },
] as const;

type Tab = (typeof NAV)[number]["id"];

const SECTION_LABELS: Record<Tab, string> = {
  profile:    "Account",
  models:     "Model preferences",
  storage:    "Storage & paths",
  "api-keys": "API keys",
  general:    "General",
};

// ── primitives ─────────────────────────────────────────────────────────────────

function SectionCard({ title, description, children }: {
  title: string; description: string; children: React.ReactNode;
}) {
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

function Field({ label, hint, children }: {
  label: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function PasswordInput({
  placeholder,
  value,
  onChange,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        type={show ? "text" : "password"}
        placeholder={placeholder}
        className="pr-9"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
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
        {saving
          ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>
          : <><Save className="h-3.5 w-3.5" /> Save changes</>}
      </Button>
    </div>
  );
}

// ── Code block ─────────────────────────────────────────────────────────────────

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
        {copied
          ? <Check className="h-3.5 w-3.5 text-emerald-400" />
          : <Copy className="h-3.5 w-3.5" />}
      </button>
      <pre className="overflow-x-auto p-4 pr-12 text-[11.5px] leading-[1.7] font-mono text-[#e6edf3] whitespace-pre">
        {code}
      </pre>
    </div>
  );
}

// ── Section: Profile ───────────────────────────────────────────────────────────

function ProfileSection({ settings }: { settings: UserSettings }) {
  const update = useUpdateSettings();
  const changePassword = useChangePassword();

  const [displayName, setDisplayName] = useState(settings.display_name ?? "");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  // Sync if settings reload
  useEffect(() => {
    setDisplayName(settings.display_name ?? "");
  }, [settings.display_name]);

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      await update.mutateAsync({ display_name: displayName });
      toast.success("Profile saved.");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async () => {
    if (!currentPw || !newPw) {
      toast.error("Please fill in both password fields.");
      return;
    }
    setSavingPw(true);
    try {
      await changePassword.mutateAsync({ current_password: currentPw, new_password: newPw });
      toast.success("Password changed.");
      setCurrentPw("");
      setNewPw("");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to change password.");
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <SectionCard title="Personal info" description="Your display name and email address.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email">
            <Input value={settings.email} disabled className="opacity-60 cursor-not-allowed" />
          </Field>
          <Field label="Display name">
            <Input
              placeholder="Your name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </Field>
        </div>
        <SaveRow saving={savingProfile} onClick={saveProfile} />
      </SectionCard>

      <SectionCard title="Change password" description="Update your login credentials.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Current password">
            <PasswordInput placeholder="••••••••" value={currentPw} onChange={setCurrentPw} />
          </Field>
          <Field label="New password">
            <PasswordInput placeholder="••••••••" value={newPw} onChange={setNewPw} />
          </Field>
        </div>
        <SaveRow saving={savingPw} onClick={savePassword} />
      </SectionCard>
    </div>
  );
}

// ── Section: Model preferences ─────────────────────────────────────────────────

function ModelPrefsSection({ settings }: { settings: UserSettings }) {
  const update = useUpdateSettings();
  const { data: models } = useModels();

  const [form, setForm] = useState({
    default_model:  settings.default_model,
    system_prompt:  settings.system_prompt,
    temperature:    settings.temperature,
    max_tokens:     settings.max_tokens,
    top_p:          settings.top_p,
    context_window: settings.context_window,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      default_model:  settings.default_model,
      system_prompt:  settings.system_prompt,
      temperature:    settings.temperature,
      max_tokens:     settings.max_tokens,
      top_p:          settings.top_p,
      context_window: settings.context_window,
    });
  }, [settings]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      await update.mutateAsync(form);
      toast.success("Model preferences saved.");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  // Build model options: registered models + hardcoded base models as fallback
  const modelOptions = useMemo(() => {
    if (models && models.length > 0) {
      return models.map((m) => ({
        value: m.display_name.toLowerCase().replace(/ /g, "-"),
        label: m.display_name,
      }));
    }
    return [
      { value: "llama-3.2-1b-instruct",    label: "Llama 3.2 1B Instruct" },
      { value: "qwen-2.5-3b-instruct",     label: "Qwen 2.5 3B Instruct" },
      { value: "deepseek-r1-distill-1.5b", label: "DeepSeek-R1 Distill 1.5B" },
      { value: "gemma-3-1b-it",            label: "Gemma 3 1B IT" },
    ];
  }, [models]);

  return (
    <div className="flex flex-col gap-6">
      <SectionCard
        title="Default base model"
        description="Used when starting a new conversation with no explicit model selected."
      >
        <Field label="Base model">
          <Select value={form.default_model} onValueChange={(v) => set("default_model", v)}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Select a model" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Models</SelectLabel>
                {modelOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Default system prompt">
          <textarea
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            value={form.system_prompt}
            onChange={(e) => set("system_prompt", e.target.value)}
          />
        </Field>
      </SectionCard>

      <SectionCard
        title="Inference parameters"
        description="Applied to all conversations unless overridden in the playground sidebar."
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Temperature" hint="Higher values make output more creative and random.">
            <Input
              type="number" step="0.1" min="0" max="2"
              value={form.temperature}
              onChange={(e) => set("temperature", parseFloat(e.target.value) || 0)}
            />
          </Field>
          <Field label="Max tokens" hint="Maximum length of each generated response.">
            <Input
              type="number"
              value={form.max_tokens}
              onChange={(e) => set("max_tokens", parseInt(e.target.value) || 0)}
            />
          </Field>
          <Field label="Top-p" hint="Nucleus sampling — lower values focus output.">
            <Input
              type="number" step="0.05" min="0" max="1"
              value={form.top_p}
              onChange={(e) => set("top_p", parseFloat(e.target.value) || 0)}
            />
          </Field>
          <Field label="Context window" hint="Number of tokens retained from conversation history.">
            <Input
              type="number"
              value={form.context_window}
              onChange={(e) => set("context_window", parseInt(e.target.value) || 0)}
            />
          </Field>
        </div>
      </SectionCard>

      <SaveRow saving={saving} onClick={save} />
    </div>
  );
}

// ── Section: Storage ───────────────────────────────────────────────────────────

function StorageSection({ settings }: { settings: UserSettings }) {
  const update = useUpdateSettings();

  const [form, setForm] = useState({
    datasets_root:           settings.datasets_root,
    adapters_root:           settings.adapters_root,
    uploaded_models_root:    settings.uploaded_models_root,
    logs_root:               settings.logs_root,
    base_models_root:        settings.base_models_root,
    docker_image:            settings.docker_image,
    docker_healthcheck_timeout: settings.docker_healthcheck_timeout,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      datasets_root:              settings.datasets_root,
      adapters_root:              settings.adapters_root,
      uploaded_models_root:       settings.uploaded_models_root,
      logs_root:                  settings.logs_root,
      base_models_root:           settings.base_models_root,
      docker_image:               settings.docker_image,
      docker_healthcheck_timeout: settings.docker_healthcheck_timeout,
    });
  }, [settings]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      await update.mutateAsync(form);
      toast.success("Paths saved.");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const storagePaths: { label: string; key: keyof typeof form }[] = [
    { label: "Datasets root",    key: "datasets_root" },
    { label: "Adapters root",    key: "adapters_root" },
    { label: "Uploaded models",  key: "uploaded_models_root" },
    { label: "Training logs",    key: "logs_root" },
    { label: "Base model GGUFs", key: "base_models_root" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <SectionCard
        title="Storage paths"
        description="Directories where Forge writes model adapters, dataset files, and training logs."
      >
        <div className="flex flex-col gap-4">
          {storagePaths.map(({ label, key }) => (
            <Field key={key} label={label}>
              <Input
                value={form[key] as string}
                onChange={(e) => set(key, e.target.value)}
                className="font-mono text-xs"
              />
            </Field>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Docker settings"
        description="Configuration for the llama.cpp inference containers."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Container image" hint="Pulled from ghcr.io by default.">
            <Input
              value={form.docker_image}
              onChange={(e) => set("docker_image", e.target.value)}
              className="font-mono text-xs"
            />
          </Field>
          <Field label="Health-check timeout (s)" hint="Seconds to wait for container readiness.">
            <Input
              type="number"
              value={form.docker_healthcheck_timeout}
              onChange={(e) => set("docker_healthcheck_timeout", parseInt(e.target.value) || 0)}
            />
          </Field>
        </div>
      </SectionCard>

      <SaveRow saving={saving} onClick={save} />
    </div>
  );
}

// ── Section: General ───────────────────────────────────────────────────────────

function GeneralSection({ settings }: { settings: UserSettings }) {
  const update = useUpdateSettings();
  const { setTheme: applyTheme } = useTheme();
  const [theme, setTheme] = useState(settings.theme ?? "system");
  const [saving, setSaving] = useState(false);

  useEffect(() => { setTheme(settings.theme ?? "system"); }, [settings.theme]);

  const save = async () => {
    setSaving(true);
    try {
      await update.mutateAsync({ theme });
      // Actually apply the theme immediately via next-themes
      applyTheme(theme);
      toast.success("Settings saved.");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <SectionCard title="Appearance" description="Choose your preferred interface theme.">
        <Field label="Theme">
          <Select value={theme} onValueChange={(v) => { setTheme(v); applyTheme(v); }}>
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

// ── Quick-start code snippet ───────────────────────────────────────────────────

function ApiQuickStart({ keys, serverUrl }: { keys: ApiKeyRow[]; serverUrl: string }) {
  const { data: models } = useModels();
  const [open, setOpen] = useState(false);

  const exampleKey = keys.find((k) => k.is_active)?.prefix
    ? `${keys.find((k) => k.is_active)!.prefix}...`
    : "sk-local-<your-key-here>";

  const modelListComment = useMemo(() => {
    if (!models || models.length === 0)
      return `#   (no models registered yet — go to Models tab to create one)`;
    return models
      .map((m) => {
        const slug = m.display_name.toLowerCase().replace(/ /g, "-");
        const tag = m.is_base_model ? "base" : "fine-tuned";
        return `#   "${slug}"  ← ${tag}: ${m.display_name}`;
      })
      .join("\n");
  }, [models]);

  const defaultModelSlug = useMemo(() => {
    if (!models || models.length === 0) return "tinyllama";
    const ready = models.find((m) => m.status === "READY" || m.status === "COMPLETED");
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
client = OpenAI(
    base_url="${serverUrl}/v1",
    api_key="${exampleKey}",  # ← paste your full sk-local-... key here
)

# ── 2. Pick a model ───────────────────────────────────────────────────────────
${modelListComment}
MODEL = "${defaultModelSlug}"

# ── 3. Send a chat completion ─────────────────────────────────────────────────
response = client.chat.completions.create(
    model=MODEL,
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user",   "content": "Help me draft a vacation policy."},
    ],
    max_tokens=256,
    temperature=0.7,
    top_p=1.0,
)

print(response.choices[0].message.content)`;

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
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t px-6 pb-6 pt-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-violet-500/20 bg-violet-500/5 px-3 py-2">
            <span className="text-[11px] text-violet-400 font-mono">pip install openai</span>
            <span className="text-[11px] text-muted-foreground">— only dependency needed</span>
          </div>
          <CodeBlock code={code} />
        </div>
      )}
    </div>
  );
}

// ── Section: API Keys ──────────────────────────────────────────────────────────

function ApiKeysSection() {
  const { data: keys, isLoading, refetch } = useApiKeys();
  const createKey = useCreateApiKey();
  const revokeKey = useRevokeApiKey();

  const [newName, setNewName]         = useState("");
  const [tokenLimit, setTokenLimit]   = useState("1000000");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [revoking, setRevoking]       = useState<ApiKeyRow | null>(null);
  const [copiedId, setCopiedId]       = useState<number | null>(null);

  const serverUrl =
    typeof window !== "undefined"
      ? window.location.origin.replace(/:3000$/, ":8000")
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

      <ApiQuickStart keys={keys ?? []} serverUrl={serverUrl} />

      {revealedKey && (
        <KeyRevealDialog rawKey={revealedKey} onClose={() => setRevealedKey(null)} />
      )}

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

// ── Page ───────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [active, setActive] = useState<Tab>("profile");
  const [isMounted, setIsMounted] = useState(false);

  const { data: settings, isLoading, isError } = useSettings();
  const { setTheme: applyTheme } = useTheme();

  // Apply theme from server settings whenever it loads/changes
  useEffect(() => {
    if (settings?.theme) applyTheme(settings.theme);
  }, [settings?.theme]);

  useEffect(() => {
    const savedTab = localStorage.getItem("forge_active_tab") as Tab;
    if (savedTab && SECTION_LABELS[savedTab]) setActive(savedTab);
    setIsMounted(true);
  }, []);

  const handleTabChange = (id: Tab) => {
    setActive(id);
    localStorage.setItem("forge_active_tab", id);
  };

  if (!isMounted) return null;

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
        {/* Sidebar */}
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

            {/* Loading state */}
            {isLoading && active !== "api-keys" && (
              <div className="flex flex-col gap-4">
                {[...Array(2)].map((_, i) => (
                  <div key={i} className="h-48 animate-pulse rounded-xl bg-muted" />
                ))}
              </div>
            )}

            {/* Error state */}
            {isError && active !== "api-keys" && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
                Failed to load settings. Please refresh the page.
              </div>
            )}

            {/* Sections — only render once settings are loaded (except API keys which is self-contained) */}
            {active === "api-keys" && <ApiKeysSection />}
            {settings && active === "profile"  && <ProfileSection settings={settings} />}
            {settings && active === "models"   && <ModelPrefsSection settings={settings} />}
            {settings && active === "storage"  && <StorageSection settings={settings} />}
            {settings && active === "general"  && <GeneralSection settings={settings} />}
          </div>
        </main>
      </div>
    </div>
  );
}
