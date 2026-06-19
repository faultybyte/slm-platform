"use client";

import { Plus, MessageSquare, Box } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarSection } from "@/components/dashboard/sidebar-section";
import { SidebarItem } from "@/components/dashboard/sidebar-item";
import { ModelStatusDot } from "@/components/dashboard/model-status-dot";
import { useConversations } from "@/lib/hooks/use-conversations";
import { useModels } from "@/lib/hooks/use-models";

function SidebarSkeletonRow() {
  return <div className="mx-2 h-7 animate-pulse rounded-md bg-muted" />;
}

export function LeftSidebar({
  onCreateModel,
  onCreateDataset,
}: {
  onCreateModel: () => void;
  onCreateDataset: () => void;
}) {
  const conversations = useConversations();
  const models = useModels();

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col gap-4 border-r bg-sidebar py-4">
      <div className="flex flex-col gap-2 px-2">
        <Button variant="outline" size="sm" className="justify-start" onClick={onCreateModel}>
          <Plus />
          Create Model
        </Button>
        <Button variant="outline" size="sm" className="justify-start" onClick={onCreateDataset}>
          <Plus />
          New Dataset
        </Button>
      </div>

      <ScrollArea className="flex-1 px-2">
        <div className="flex flex-col gap-4 pb-4">
          <SidebarSection label="Recent chats">
            {conversations.isLoading && (
              <>
                <SidebarSkeletonRow />
                <SidebarSkeletonRow />
              </>
            )}
            {conversations.isError && (
              <p className="px-2 text-xs text-muted-foreground">
                Couldn&apos;t load conversations.
              </p>
            )}
            {conversations.data?.length === 0 && (
              <p className="px-2 text-xs text-muted-foreground">
                No conversations yet.
              </p>
            )}
            {conversations.data?.map((conv) => (
              <SidebarItem
                key={conv.id}
                href={`/dashboard?conversation=${conv.id}`}
                label={conv.title || "Untitled chat"}
                icon={<MessageSquare className="h-3.5 w-3.5 shrink-0" />}
              />
            ))}
          </SidebarSection>

          <SidebarSection label="Recent models">
            {models.isLoading && (
              <>
                <SidebarSkeletonRow />
                <SidebarSkeletonRow />
              </>
            )}
            {models.isError && (
              <p className="px-2 text-xs text-muted-foreground">
                Couldn&apos;t load models.
              </p>
            )}
            {models.data?.length === 0 && (
              <p className="px-2 text-xs text-muted-foreground">
                No models yet.
              </p>
            )}
            {models.data?.map((model) => (
              <SidebarItem
                key={model.id}
                href={`/dashboard/models/${model.id}`}
                label={model.display_name}
                icon={<Box className="h-3.5 w-3.5 shrink-0" />}
                trailing={<ModelStatusDot status={model.status} />}
              />
            ))}
          </SidebarSection>
        </div>
      </ScrollArea>
    </aside>
  );
}
