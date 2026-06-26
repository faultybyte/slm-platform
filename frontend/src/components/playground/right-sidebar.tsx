"use client";

import { useRef } from "react";
import { PanelRightClose, FileText, Upload, Trash2, Loader2, CheckCircle2, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useChatConfig } from "@/components/playground/chat-config-context";
import { CHAT_CONFIG_LIMITS } from "@/lib/chat-config";
import { cn } from "@/lib/utils";

export function RightSidebar() {
  const {
    config,
    updateConfig,
    isSidebarOpen,
    setSidebarOpen,
    pendingFiles,
    isUploadingDoc,
    hasUploadedDocs,
    onFileSelected,
    onClearDocuments,
  } = useChatConfig();

  const { temperature, topP, maxTokens } = CHAT_CONFIG_LIMITS;
  const fileRef = useRef<HTMLInputElement>(null);

  if (!isSidebarOpen) return null;

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col gap-5 overflow-y-auto border-l bg-sidebar p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Generation settings</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setSidebarOpen(false)}
          aria-label="Collapse settings panel"
        >
          <PanelRightClose className="h-4 w-4" />
        </Button>
      </div>

      {/* System prompt */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="system-prompt">System prompt</Label>
        <Textarea
          id="system-prompt"
          placeholder="You are a helpful assistant..."
          value={config.systemPrompt}
          onChange={(e) => updateConfig({ systemPrompt: e.target.value })}
          className="min-h-24 resize-none"
        />
      </div>

      <Separator />

      {/* Temperature */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="temperature">Temperature</Label>
          <span className="text-xs text-muted-foreground">{config.temperature.toFixed(1)}</span>
        </div>
        <Slider
          id="temperature"
          min={temperature.min}
          max={temperature.max}
          step={temperature.step}
          value={[config.temperature]}
          onValueChange={([v]) => updateConfig({ temperature: v })}
        />
        <p className="text-[11px] text-muted-foreground">
          {config.temperature < 0.4
            ? "Focused — more deterministic output"
            : config.temperature < 1.1
            ? "Balanced — mix of creativity and precision"
            : "Creative — higher variance, more exploratory"}
        </p>
      </div>

      {/* Top-P */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="top-p">Top-P</Label>
          <span className="text-xs text-muted-foreground">{config.topP.toFixed(2)}</span>
        </div>
        <Slider
          id="top-p"
          min={topP.min}
          max={topP.max}
          step={topP.step}
          value={[config.topP]}
          onValueChange={([v]) => updateConfig({ topP: v })}
        />
        <p className="text-[11px] text-muted-foreground">
          Nucleus sampling — lower values constrain token selection to the most likely options.
        </p>
      </div>

      {/* Max tokens */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="max-tokens">Max tokens</Label>
          <span className="text-xs text-muted-foreground">
            max {maxTokens.max.toLocaleString()}
          </span>
        </div>
        <Input
          id="max-tokens"
          type="number"
          min={maxTokens.min}
          max={maxTokens.max}
          value={config.maxTokens}
          onChange={(e) => {
            const value = Number(e.target.value);
            if (!Number.isNaN(value)) {
              updateConfig({
                maxTokens: Math.min(maxTokens.max, Math.max(maxTokens.min, value)),
              });
            }
          }}
        />
      </div>

      <Separator />

      {/* ── RAG Context Documents ───────────────────────────── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Context documents</span>
          {hasUploadedDocs && (
            <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0">
              Active
            </Badge>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Upload PDF, DOCX, or TXT files. The model will use them as context when answering your
          questions.
        </p>

        {/* Pending / uploaded files list */}
        {pendingFiles.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {pendingFiles.map((file, i) => (
              <div
                key={`${file.name}-${i}`}
                className="flex items-center gap-2 rounded-md border bg-secondary/50 px-2.5 py-1.5 text-xs"
              >
                {isUploadingDoc ? (
                  <Loader2 className="h-3 w-3 animate-spin shrink-0 text-muted-foreground" />
                ) : (
                  <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-500" />
                )}
                <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate text-foreground">{file.name}</span>
              </div>
            ))}
          </div>
        )}

        {hasUploadedDocs && (
          <div
            className={cn(
              "flex items-center gap-2 rounded-md border px-2.5 py-2 text-xs",
              "bg-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400",
            )}
          >
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            <span>Documents embedded — RAG is active for this conversation.</span>
          </div>
        )}

        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.txt,.docx"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFileSelected(file);
              e.target.value = "";
            }}
          />
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1.5"
            onClick={() => fileRef.current?.click()}
            disabled={isUploadingDoc}
          >
            {isUploadingDoc ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            {isUploadingDoc ? "Uploading…" : "Upload file"}
          </Button>

          {(hasUploadedDocs || pendingFiles.length > 0) && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground hover:text-destructive"
              onClick={onClearDocuments}
              disabled={isUploadingDoc}
              aria-label="Clear all context documents"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </aside>
  );
}