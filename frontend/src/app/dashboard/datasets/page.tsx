import { Database } from "lucide-react";
import { TabPlaceholder } from "@/components/dashboard/tab-placeholder";

export default function DatasetsPage() {
  return (
    <TabPlaceholder
      icon={Database}
      title="Dataset management"
      description="Uploading and validating JSONL fine-tuning datasets is built in an upcoming step."
    />
  );
}
