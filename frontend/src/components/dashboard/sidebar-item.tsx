"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function SidebarItem({
  href,
  label,
  icon,
  trailing,
}: {
  href: string;
  label: string;
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
        isActive
          ? "bg-secondary text-foreground"
          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
      )}
    >
      {icon}
      <span className="flex-1 truncate">{label}</span>
      {trailing}
    </Link>
  );
}
