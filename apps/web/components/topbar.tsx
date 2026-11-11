"use client";

import { useUser } from "@clerk/nextjs";
import { Search, Bell, UserRound } from "lucide-react";

/** 64px top bar per docs/desgin md §12: title-less (page has its own), search, notifications, profile. */
export function Topbar() {
  const { user } = useUser();
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-line bg-bg/95 px-5 backdrop-blur">
      <div className="relative hidden max-w-md flex-1 md:block">
        <Search size={16} aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-text-low" />
        <input aria-label="Search members" placeholder="Search members…"
          className="w-full pl-9" onKeyDown={(e) => {
            if (e.key === "Enter") {
              window.location.href = `/members?q=${encodeURIComponent((e.target as HTMLInputElement).value)}`;
            }
          }} />
      </div>
      <div className="ml-auto flex items-center gap-3">
        <button aria-label="Notifications" className="relative flex h-11 w-11 items-center justify-center rounded-btn text-text-mid hover:bg-elevated hover:text-text-hi">
          <Bell size={18} />
        </button>
        <div className="flex items-center gap-2">
          <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-full bg-elevated border border-line">
            <UserRound size={16} className="text-text-mid" />
          </span>
          <span className="hidden text-small text-text-mid sm:block">
            {user?.fullName ?? user?.username ?? "Staff"}
          </span>
        </div>
      </div>
    </header>
  );
}
