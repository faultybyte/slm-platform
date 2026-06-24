"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, User, Database, HardDrive, Settings, Key, ChevronRight, Save, Loader2, Eye, EyeOff, Copy, Check, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ── sidebar nav items ──────────────────────────────────────────────────────────
const NAV = [
  { id: "profile",  icon: User,      label: "Account" },
  { id: "models",   icon: Database,  label: "Model preferences" },
  { id: "storage",  icon: HardDrive, label: "Storage & paths" },
  { id: "api-keys", icon: Key,       label: "API keys" },
  { id: "general",  icon: Settings,  label: "General" },
] as const;

type Tab = (typeof NAV)[number]["id"];

// ── mock API key shape ─────────────────────────────────────────────────────────
interface ApiKeyRow {
  id: string;
  name: string;
  prefix: string;
  created: string;
}

const MOCK_KEYS: ApiKeyRow[] = [
  { id: "1", name: "Production", prefix: "fsk-prod-••••••••", created: "Jun 2025" },
  { id: "2", name: "Dev laptop",  prefix: "fsk-dev-••••••••",  created: "May 2025" },
];

// ── section components ─────────────────────────────────────────────────────────

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
          <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
            <option>TinyLlama 1.1B Chat</option>
            <option>Llama 3.2 1B Instruct</option>
            <option>Qwen 2.5 3B Instruct</option>
            <option>DeepSeek-R1 Distill 1.5B</option>
            <option>Gemma 3 1B IT</option>
          </select>
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
      <SectionCard title="Storage paths" description="Directories where Forge writes model adapters, dataset files, and training logs. Relative paths are resolved from the server working directory.">
        <div className="flex flex-col gap-4">
          {[
            { label: "Datasets root",      value: "storage/datasets" },
            { label: "Adapters root",      value: "storage/adapters" },
            { label: "Uploaded models",    value: "storage/uploaded_models" },
            { label: "Training logs",      value: "storage/logs" },
            { label: "Base model GGUFs",   value: "storage/models" },
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

function ApiKeysSection() {
  const [keys, setKeys] = useState<ApiKeyRow[]>(MOCK_KEYS);
  const [newName, setNewName] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const create = () => {
    if (!newName.trim()) return;
    setCreating(true);
    setTimeout(() => {
      const fake: ApiKeyRow = {
        id: String(Date.now()),
        name: newName.trim(),
        prefix: `fsk-${newName.toLowerCase().slice(0,4)}-••••••••`,
        created: "Jun 2025",
      };
      setKeys((k) => [...k, fake]);
      setNewName("");
      setCreating(false);
      toast.success("API key created.");
    }, 700);
  };

  const remove = (id: string) => {
    setKeys((k) => k.filter((x) => x.id !== id));
    toast.success("API key revoked.");
  };

  const copy = (id: string) => {
    navigator.clipboard.writeText("fsk-example-xxxxxxxxxxxx");
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="flex flex-col gap-6">
      <SectionCard title="Active keys" description="Use these keys to authenticate against the OpenAI-compatible gateway endpoint at /v1/chat/completions.">
        <div className="flex flex-col divide-y rounded-lg border">
          {keys.map((k) => (
            <div key={k.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex flex-col">
                <span className="text-sm font-medium">{k.name}</span>
                <span className="font-mono text-xs text-muted-foreground">{k.prefix}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Created {k.created}</span>
                <button onClick={() => copy(k.id)} className="rounded p-1 hover:bg-secondary transition-colors">
                  {copiedId === k.id ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
                <button onClick={() => remove(k.id)} className="rounded p-1 hover:bg-destructive/10 hover:text-destructive transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
          {keys.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">No active API keys.</p>
          )}
        </div>
      </SectionCard>

      <SectionCard title="Create a new key" description="The full key value is only shown once — copy it immediately after creation.">
        <div className="flex gap-2">
          <Input
            placeholder="Key name, e.g. CI pipeline"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
          />
          <Button size="sm" onClick={create} disabled={creating || !newName.trim()}>
            {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Create
          </Button>
        </div>
      </SectionCard>
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
          <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
            <option>System default</option>
            <option>Light</option>
            <option>Dark</option>
          </select>
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

// ── reusable primitives ────────────────────────────────────────────────────────

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
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

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
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

// ── page ───────────────────────────────────────────────────────────────────────

const SECTION_LABELS: Record<Tab, string> = {
  profile:   "Account",
  models:    "Model preferences",
  storage:   "Storage & paths",
  "api-keys": "API keys",
  general:   "General",
};

export default function SettingsPage() {
  const [active, setActive] = useState<Tab>("profile");

  return (
    // Full-screen layout that intentionally bypasses the DashboardShell sidebar
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Minimal header — back to dashboard + breadcrumb */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Dashboard
          </Link>
          <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
          <span className="text-xs font-medium">Settings</span>
          <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
          <span className="text-xs text-muted-foreground">{SECTION_LABELS[active]}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand text-sm font-semibold text-brand-foreground">
            F
          </div>
          <span className="text-sm font-semibold">Forge SLM</span>
        </div>
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
                onClick={() => setActive(id)}
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
              {active === "profile"    && "Manage your account credentials and personal information."}
              {active === "models"     && "Configure default models and inference parameters for the playground."}
              {active === "storage"    && "Control where Forge stores files on the server."}
              {active === "api-keys"   && "Manage keys for the OpenAI-compatible /v1/chat/completions gateway."}
              {active === "general"    && "Appearance and account-level actions."}
            </p>

            {active === "profile"    && <ProfileSection />}
            {active === "models"     && <ModelPrefsSection />}
            {active === "storage"    && <StorageSection />}
            {active === "api-keys"   && <ApiKeysSection />}
            {active === "general"    && <GeneralSection />}
          </div>
        </main>
      </div>
    </div>
  );
}
