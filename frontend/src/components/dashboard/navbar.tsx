import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { NavTabs } from "@/components/dashboard/nav-tabs";
import { TokenBadge } from "@/components/dashboard/token-badge";
import { UserMenu } from "@/components/dashboard/user-menu";

export function Navbar() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-4">
      <div className="flex items-center gap-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand text-sm font-semibold text-brand-foreground">
            C
          </div>
          <span className="text-sm font-semibold">SLM Platform</span>
        </Link>
        <NavTabs />
      </div>

      <div className="flex items-center gap-3">
        <TokenBadge />
        <UserMenu />
        <ThemeToggle />
      </div>
    </header>
  );
}
