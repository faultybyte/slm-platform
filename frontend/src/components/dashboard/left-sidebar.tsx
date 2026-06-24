"use client";

import { useState } from "react";
import { 
  Plus, 
  MessageSquare, 
  Box, 
  MoreHorizontal, 
  Trash2, 
  Edit3, 
  Pin, 
  PinOff,
  Database
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useDeleteConversation, useUpdateConversation, useConversations } from "@/lib/hooks/use-conversations";
import { useCreateConversation } from "@/lib/hooks/use-conversations";
import { useRouter, useSearchParams } from "next/navigation";

import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarSection } from "@/components/dashboard/sidebar-section";
import { SidebarItem } from "@/components/dashboard/sidebar-item";

function SidebarSkeletonRows() {
  return (
    <div className="flex flex-col gap-2 px-2 mt-2">
      <div className="h-8 w-full animate-pulse rounded-md bg-muted/60" />
      <div className="h-8 w-[85%] animate-pulse rounded-md bg-muted/60" />
      <div className="h-8 w-[90%] animate-pulse rounded-md bg-muted/60" />
    </div>
  );
}

export function LeftSidebar({
  onCreateModel,
  onCreateDataset,
}: {
  onCreateModel: () => void;
  onCreateDataset: () => void;
}) {
  const conversations = useConversations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const updateMutation = useUpdateConversation();
  const deleteMutation = useDeleteConversation();
  const createMutation = useCreateConversation();

  const currentConvId = searchParams.get("conversation");

  
  const handleNewChat = async () => {
    try {
      const conv = await createMutation.mutateAsync({ model_id: undefined, session_title: "New Chat" });
      const id = (conv as any)?.conversation_id ?? (conv as any)?.id ?? conv?.id;
      if (id) router.push(`/dashboard?conversation=${id}`);
      else router.push("/dashboard");
    } catch (err) {
      console.error("Failed to create conversation", err);
      router.push("/dashboard");
    }
  };

  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renameConvId, setRenameConvId] = useState<number | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConvId, setDeleteConvId] = useState<number | null>(null);
  const [deleteConvTitle, setDeleteConvTitle] = useState("");

  const handleRenameOpen = (convId: number, currentTitle: string) => {
    setRenameConvId(convId);
    setRenameValue(currentTitle || "");
    setRenameDialogOpen(true);
  };

  const handleRenameSubmit = () => {
    if (!renameValue.trim() || !renameConvId) return;
    updateMutation.mutate({ id: renameConvId, body: { title: renameValue } });
    setRenameDialogOpen(false);
  };

  const handleDeleteOpen = (convId: number, title: string) => {
    setDeleteConvId(convId);
    setDeleteConvTitle(title);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (!deleteConvId) return;
    deleteMutation.mutate(deleteConvId, {
      onSuccess: () => {
        if (currentConvId === String(deleteConvId)) {
          router.push("/dashboard");
        }
      },
    });
    setDeleteDialogOpen(false);
  };

  // Sort conversations: pinned first, then by creation date descending
  const sortedConversations = [...(conversations.data || [])].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col bg-background border-r shadow-sm">
      {/* Top Header Actions */}
      <div className="flex flex-col gap-3 p-4">
        <Button 
          onClick={handleNewChat}
          className="w-full justify-start rounded-xl font-medium shadow-sm transition-all active:scale-[0.98] bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Chat
        </Button>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 rounded-lg h-8 text-xs text-muted-foreground hover:text-foreground transition-colors" 
            onClick={onCreateModel}
          >
            <Box className="mr-1.5 h-3.5 w-3.5" />
            Model
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 rounded-lg h-8 text-xs text-muted-foreground hover:text-foreground transition-colors" 
            onClick={onCreateDataset}
          >
            <Database className="mr-1.5 h-3.5 w-3.5" />
            Dataset
          </Button>
        </div>
      </div>

      <div className="px-4 pb-2">
        <div className="h-[1px] w-full bg-border/40" />
      </div>

      {/* Conversations List */}
      <ScrollArea className="flex-1 px-3">
        <SidebarSection label="Recent chats">
          {conversations.isLoading && <SidebarSkeletonRows />}
          
          {conversations.isError && (
            <div className="px-3 py-4 text-center rounded-lg bg-destructive/10 text-destructive text-xs border border-destructive/20 mt-2">
              Couldn&apos;t load conversations.
            </div>
          )}
          
          {conversations.data?.length === 0 && (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              No conversations yet.
            </div>
          )}

          <div className="flex flex-col gap-0.5 mt-1 pb-4">
            {sortedConversations.map((conv) => {
              const isActive = currentConvId === String(conv.conversation_id);

              return (
                <div 
                  key={conv.conversation_id} 
                  className={`group relative flex w-full items-center justify-between rounded-lg overflow-hidden transition-all duration-200 ease-in-out ${
                    isActive 
                      ? "bg-accent/80 text-accent-foreground" 
                      : "hover:bg-muted/60"
                  }`}
                >
                  {/* Min-w-0 ensures the text can truncate correctly inside the flex child */}
                  <div className="flex-1 min-w-0 pr-8">
                    <SidebarItem
                      href={`/dashboard?conversation=${conv.conversation_id}`}
                      label={conv.title || "Untitled chat"}
                      icon={
                        conv.pinned 
                          ? <Pin className="h-3.5 w-3.5 shrink-0 fill-current rotate-45 text-primary" /> 
                          : <MessageSquare className={`h-3.5 w-3.5 shrink-0 transition-colors ${isActive ? "text-foreground" : "text-muted-foreground/70 group-hover:text-foreground"}`} />
                      }
                    />
                  </div>

                  {/* Absolute positioned right actions area with solid background to cleanly obscure long text */}
                  <div 
                    className={`absolute right-1 top-1/2 -translate-y-1/2 flex items-center rounded-md px-0.5 py-0.5 opacity-0 transition-opacity duration-200 ${
                      isActive 
                        ? "bg-accent opacity-100 shadow-[0_0_10px_10px_hsl(var(--accent))]" 
                        : "bg-muted group-hover:opacity-100 shadow-[0_0_10px_10px_hsl(var(--muted))]"
                    }`}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button 
                          aria-label="Actions" 
                          className="p-1.5 rounded-md hover:bg-background/80 text-muted-foreground hover:text-foreground transition-colors focus:outline-none"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="right" align="start" className="w-48 shadow-lg rounded-xl">
                        <DropdownMenuItem onSelect={() => handleRenameOpen(conv.conversation_id, conv.title || "")}>
                          <Edit3 className="mr-2 h-4 w-4 text-muted-foreground" /> 
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => updateMutation.mutate({ id: conv.conversation_id, body: { pinned: !conv.pinned } })}>
                          {conv.pinned ? (
                            <><PinOff className="mr-2 h-4 w-4 text-muted-foreground" /> Unpin</>
                          ) : (
                            <><Pin className="mr-2 h-4 w-4 text-muted-foreground" /> Pin</>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onSelect={() => handleDeleteOpen(conv.conversation_id, conv.title || "Untitled chat")}
                          className="text-destructive focus:text-destructive focus:bg-destructive/10"
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> 
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>
        </SidebarSection>
      </ScrollArea>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle>Rename Conversation</DialogTitle>
            <DialogDescription>Enter a new name for this conversation.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Input
              placeholder="New name..."
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRenameSubmit()}
              autoFocus
              className="rounded-lg"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameDialogOpen(false)}>
              Cancel
            </Button>
            <Button className="rounded-lg" onClick={handleRenameSubmit} disabled={!renameValue.trim() || updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" /> Delete Conversation
            </DialogTitle>
            <DialogDescription className="pt-2">
              Are you sure you want to delete <span className="font-semibold text-foreground">"{deleteConvTitle}"</span>? This action cannot be undone and will permanently remove all messages.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-2">
            <Button variant="ghost" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="rounded-lg"
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}