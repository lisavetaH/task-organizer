"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarRange, CalendarDays, FolderClosed, LayoutList, Star, Menu } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Tab = { href: string; label: string; Icon: LucideIcon };

const TABS: Tab[] = [
  { href: "/today", label: "Today", Icon: LayoutList },
  { href: "/week", label: "Week", Icon: CalendarRange },
  { href: "/folders", label: "Folders", Icon: FolderClosed },
  { href: "/calendar", label: "Calendar", Icon: CalendarDays },
  { href: "/favorites", label: "Favorites", Icon: Star },
  { href: "/more", label: "More", Icon: Menu },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Primary"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-between">
        {TABS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex h-16 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors ${
                  active ? "text-brand" : "text-gray-400 active:text-gray-600"
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} aria-hidden="true" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
