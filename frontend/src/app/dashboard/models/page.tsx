import { Box } from "lucide-react";
import { TabPlaceholder } from "@/components/dashboard/tab-placeholder";

export default function ModelsPage() {
  return (
    <TabPlaceholder
      icon={Box}
      title="Model management"
      description="Registering models, starting training runs, and streaming training logs are built in an upcoming step."
    />
  );
}
