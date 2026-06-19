"use client";

import { PanelRightClose } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { useChatConfig } from "@/components/playground/chat-config-context";
import { CHAT_CONFIG_LIMITS } from "@/lib/chat-config";

export function RightSidebar() {
  const { config, updateConfig, isSidebarOpen, setSidebarOpen } = useChatConfig();

  if (!isSidebarOpen) return null;

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col gap-5 overflow-y-auto border-l bg-background p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Playground settings</p>
          <p className="text-xs text-muted-foreground">Generation controls for the active chat.</p>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(false)}
          aria-label="Collapse settings"
        >
          <PanelRightClose className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="model">Model</Label>
        <Input
          id="model"
          value={config.model}
          onChange={(e) => updateConfig({ model: e.target.value })}
          placeholder="tinyllama"
        />
      </div>

      <Separator />

      <div className="space-y-2">
        <Label htmlFor="systemPrompt">System prompt</Label>
        <Textarea
          id="systemPrompt"
          value={config.systemPrompt}
          onChange={(e) => updateConfig({ systemPrompt: e.target.value })}
          placeholder="You are a helpful assistant..."
          className="min-h-28 resize-none"
        />
      </div>

      <Separator />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="temperature">Temperature</Label>
          <span className="text-xs text-muted-foreground">{config.temperature.toFixed(1)}</span>
        </div>
        <Slider
          id="temperature"
          min={CHAT_CONFIG_LIMITS.temperature.min}
          max={CHAT_CONFIG_LIMITS.temperature.max}
          step={CHAT_CONFIG_LIMITS.temperature.step}
          value={[config.temperature]}
          onValueChange={([value]) => updateConfig({ temperature: value })}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="topP">Top-p</Label>
          <span className="text-xs text-muted-foreground">{config.topP.toFixed(2)}</span>
        </div>
        <Slider
          id="topP"
          min={CHAT_CONFIG_LIMITS.topP.min}
          max={CHAT_CONFIG_LIMITS.topP.max}
          step={CHAT_CONFIG_LIMITS.topP.step}
          value={[config.topP]}
          onValueChange={([value]) => updateConfig({ topP: value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="maxTokens">Max tokens</Label>
        <Input
          id="maxTokens"
          type="number"
          min={CHAT_CONFIG_LIMITS.maxTokens.min}
          max={CHAT_CONFIG_LIMITS.maxTokens.max}
          value={config.maxTokens}
          onChange={(e) => {
            const next = Number(e.target.value);
            if (!Number.isNaN(next)) {
              updateConfig({
                maxTokens: Math.max(
                  CHAT_CONFIG_LIMITS.maxTokens.min,
                  Math.min(CHAT_CONFIG_LIMITS.maxTokens.max, next)
                ),
              });
            }
          }}
        />
      </div>
    </aside>
  );
}