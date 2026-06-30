"use client";

import { LogOut, Settings } from "lucide-react";
import Link from "next/link";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentUser, useLogout } from "@/lib/hooks/use-auth";
import { useSettings } from "@/lib/hooks/use-settings";

function initialsFromName(name: string | undefined, fallback?: string): string {
  const source = name?.trim() || fallback?.trim();
  if (!source) return "?";

  const words = source.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

export function UserMenu() {
  const { data: user } = useCurrentUser();
  const { data: settings } = useSettings();
  const logout = useLogout();

  return (
    // Settings button to the left of the user menu
    <div className="flex items-center gap-5 rounded-full outline-none focus-visible:ring-2">
      <Link 
        href="/dashboard/settings" 
        className="text-muted-foreground transition-colors hover:text-foreground"
      >
        <Settings className="h-5 w-5" />
        <span className="sr-only">Settings</span>
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger className="rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring">
          <Avatar>
              <AvatarFallback>
                {initialsFromName(settings?.display_name || user?.display_name, user?.email)}
              </AvatarFallback>
        
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <p className="truncate text-sm font-medium text-foreground">
              {settings?.display_name || user?.display_name || user?.email || "Loading..."}
            </p>
          </DropdownMenuLabel>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
            className="cursor-pointer text-red-600 focus:bg-red-50 focus:text-red-700 dark:focus:bg-red-950 dark:focus:text-red-400"
          >
            <LogOut className="mr-2 h-4 w-4" />
            <span>{logout.isPending ? "Signing out..." : "Sign out"}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
        </Avatar>
        </DropdownMenuTrigger>
      </DropdownMenu>
    </div>
  );
}