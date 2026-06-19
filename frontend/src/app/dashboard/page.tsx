import { PlaygroundShell } from "@/components/dashboard/playground-shell";
import { PlaygroundWorkspace } from "@/components/playground/playground-workspace";

export default function DashboardPage() {
  return (
    <PlaygroundShell>
      <PlaygroundWorkspace />
    </PlaygroundShell>
  );
}