"use client";

import { toast } from "sonner";

import { Navbar } from "@/components/dashboard/navbar";
import { LeftSidebar } from "@/components/dashboard/left-sidebar";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const handleCreateModel = () => {
    toast.info("Model creation dialog is coming in the next implementation step.");
  };

  const handleCreateDataset = () => {
    toast.info("Dataset upload dialog is coming in the next implementation step.");
  };

  return (
    <div className="flex h-svh flex-col">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <LeftSidebar
          onCreateModel={handleCreateModel}
          onCreateDataset={handleCreateDataset}
        />
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
