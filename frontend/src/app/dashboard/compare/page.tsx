import { Columns2 } from "lucide-react";
import { PlaygroundShell } from "@/components/dashboard/playground-shell";
import { TabPlaceholder } from "@/components/dashboard/tab-placeholder";

export default function ComparePage() {
  return (
    <PlaygroundShell>
      <TabPlaceholder
        icon={Columns2}
        title="Model comparison"
        description="Side-by-side A/B testing across two models is built in an upcoming step."
      />
    </PlaygroundShell>
  );
}
