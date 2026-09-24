"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/config/navigation";
import { Icon } from "./icons";

export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <ul className="space-y-1">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const upcoming = item.status === "upcoming";

        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={[
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-brand-50 text-brand-800"
                  : upcoming
                    ? "text-muted hover:bg-canvas"
                    : "text-ink hover:bg-canvas",
              ].join(" ")}
            >
              <Icon
                name={item.icon}
                className={`size-5 shrink-0 ${active ? "text-brand-600" : "text-muted"}`}
              />
              <span className="flex-1">{item.label}</span>
              {upcoming ? (
                <span className="rounded-full bg-canvas px-2 py-0.5 text-[11px] font-medium text-muted ring-1 ring-line">
                  Soon
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
