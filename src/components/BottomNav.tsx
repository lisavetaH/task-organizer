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
      <ul className="mx-auto flex max-w-md items-stretch justify-between px-1.5 py-1.5">
        {TABS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex flex-1 justify-center">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex h-[52px] w-full max-w-[72px] flex-col items-center justify-center gap-0.5 rounded-2xl transition-all duration-200 ease-out active:scale-[0.96] ${
                  active ? "bg-brand shadow-sm" : "active:bg-gray-100"
                }`}
              >
                <Icon
                  className={`h-5 w-5 transition-colors duration-200 ${
                    active ? "text-white" : "text-gray-400"
                  }`}
                  strokeWidth={active ? 2.5 : 2}
                  aria-hidden="true"
                />
                <span
                  className={`text-[10px] tracking-tight transition-colors duration-200 ${
                    active ? "font-semibold text-white" : "font-medium text-gray-400"
                  }`}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
