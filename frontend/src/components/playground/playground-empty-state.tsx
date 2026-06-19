import { MessageSquare } from "lucide-react";

export function PlaygroundEmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
      <MessageSquare className="h-8 w-8 text-muted-foreground" />
      <p className="text-sm font-medium">Start a conversation</p>
      <p className="max-w-md text-sm text-muted-foreground">
        Send a prompt or attach a document. The chat canvas will keep state while responses stream in.
      </p>
    </div>
  );
}