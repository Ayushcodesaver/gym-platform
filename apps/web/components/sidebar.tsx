"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Users, CalendarCheck, IdCard, RefreshCcw, Wallet,
  HeartPulse, Package, UserCog, BarChart3, Settings, Dumbbell,
} from "lucide-react";

/** Nav is role-aware (master prompt §39): each item carries its permission. */
const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard.read" },
  { href: "/members", label: "Members", icon: Users, permission: "members.read" },
  { href: "/attendance", label: "Attendance", icon: CalendarCheck, permission: "attendance.read" },
  { href: "/memberships", label: "Memberships", icon: IdCard, permission: "memberships.read" },
  { href: "/renewals", label: "Renewals", icon: RefreshCcw, permission: "renewals.read" },
  { href: "/payments", label: "Payments", icon: Wallet, permission: "payments.read" },
  { href: "/add-ons", label: "Add-ons", icon: Package, permission: "addons.read" },
  { href: "/retention", label: "Retention", icon: HeartPulse, permission: "followups.read" },
  { href: "/staff", label: "Staff", icon: UserCog, permission: "staff.read" },
  { href: "/reports", label: "Reports", icon: BarChart3, permission: "reports.read" },
  { href: "/settings", label: "Settings", icon: Settings, permission: "settings.read" },
] as const;

interface Me { permissions: string[]; gym: { name: string } | null; profile: { role: string } }

export function Sidebar() {
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((j) => { if (j.success) setMe(j.data); })
      .catch(() => { /* nav falls back to showing nothing; middleware still protects */ });
  }, []);

  const permissions = me?.permissions ?? [];

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-bg lg:flex">
      <div className="flex h-16 items-center gap-2 border-b border-line px-5">
        <Dumbbell size={20} className="text-accent" aria-hidden />
        <span className="truncate font-semibold tracking-tight">{me?.gym?.name ?? "Gym Platform"}</span>
      </div>
      <nav aria-label="Primary" className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
        {NAV.map(({ href, label, icon: Icon, permission }) => {
          if (me && !permissions.includes(permission)) return null;
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined}
              className={`flex min-h-[44px] items-center gap-3 rounded-btn px-3 text-small transition-colors
                ${active ? "bg-accent/10 text-accent" : "text-text-mid hover:bg-elevated hover:text-text-hi"}`}>
              <Icon size={18} aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
      {me && (
        <div className="border-t border-line px-5 py-3 text-caption text-text-low">
          Signed in as <span className="capitalize text-text-mid">{me.profile.role.replace("_", " ")}</span>
        </div>
      )}
    </aside>
  );
}
