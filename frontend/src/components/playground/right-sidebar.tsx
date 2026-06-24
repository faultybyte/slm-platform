"use client";

import { PanelRightClose } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useChatConfig } from "@/components/playground/chat-config-context";
import { CHAT_CONFIG_LIMITS } from "@/lib/chat-config";

export function RightSidebar() {
  const { config, updateConfig, isSidebarOpen, setSidebarOpen } = useChatConfig();
  const { temperature, topP, maxTokens } = CHAT_CONFIG_LIMITS;

  if (!isSidebarOpen) return null;

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col gap-5 overflow-y-auto border-l bg-sidebar p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Generation settings</span>
        <Button
          variant="ghost" size="icon" className="h-7 w-7"
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
          min={temperature.min} max={temperature.max} step={temperature.step}
          value={[config.temperature]}
          onValueChange={([v]) => updateConfig({ temperature: v })}
        />
        <p className="text-[11px] text-muted-foreground">
          {config.temperature < 0.4 ? "Focused — more deterministic output" :
           config.temperature < 1.1 ? "Balanced — mix of creativity and precision" :
           "Creative — higher variance, more exploratory"}
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
          min={topP.min} max={topP.max} step={topP.step}
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
          <span className="text-xs text-muted-foreground">max {maxTokens.max.toLocaleString()}</span>
        </div>
        <Input
          id="max-tokens"
          type="number"
          min={maxTokens.min} max={maxTokens.max}
          value={config.maxTokens}
          onChange={(e) => {
            const value = Number(e.target.value);
            if (!Number.isNaN(value)) {
              updateConfig({ maxTokens: Math.min(maxTokens.max, Math.max(maxTokens.min, value)) });
            }
          }}
        />
      </div>
    </aside>
  );
}
