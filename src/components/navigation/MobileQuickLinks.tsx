"use client";

// "use client": each card closes the drawer, and the pathless variant renders a
// button with its own onClick.

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import {
  MOBILE_SUPPORT_LINKS,
  QUICK_LINK_THEME_CLASSES,
  type MobileQuickLink,
} from "./navLinks";

export interface MobileQuickLinksProps {
  quickLinks: MobileQuickLink[];
  pathname: string;
  /** Closes the drawer. */
  onNavigate: () => void;
}

/**
 * The two link blocks in the middle of the mobile drawer: the two-up quick-link
 * cards and the Support panel underneath.
 *
 * Returns a fragment rather than a wrapper — they are siblings inside the
 * drawer's own flex column, and introducing a container would change the layout.
 */
export function MobileQuickLinks({
  quickLinks,
  pathname,
  onNavigate,
}: MobileQuickLinksProps) {
  const isActive = (path: string) => pathname === path;

  return (
    <>
      {/* ── Navigation section ── */}
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 px-1 mb-2">
        Quick Links
      </p>
      <div className="grid grid-cols-2 gap-1.5 mb-3.5">
        {quickLinks.map((item) => {
          const Icon = item.icon;
          const active = item.path ? isActive(item.path) : false;
          const theme =
            QUICK_LINK_THEME_CLASSES[item.theme] || QUICK_LINK_THEME_CLASSES.shop;

          const innerContent = (
            <>
              <div
                className={`inline-flex h-7 w-7 xs:h-8 xs:w-8 items-center justify-center rounded-lg ${
                  active ? theme.iconActive : theme.iconIdle
                }`}
              >
                <Icon className="h-3.5 w-3.5 xs:h-4 xs:w-4" />
              </div>
              <span
                className={`mt-1.5 text-[13px] xs:text-sm font-semibold leading-snug ${
                  active ? theme.textActive : "text-[#334155]"
                }`}
              >
                {item.label}
              </span>
              <div className="mt-1.5 flex items-center justify-end">
                {item.badge ? (
                  <span className="inline-flex min-w-[20px] h-5 items-center justify-center rounded-full bg-rose-100 text-rose-600 text-[10px] font-semibold px-1.5">
                    {item.badge}
                  </span>
                ) : (
                  <ChevronRight
                    className={`h-3.5 w-3.5 xs:h-4 xs:w-4 ${
                      active ? theme.chevronActive : "text-gray-400"
                    }`}
                  />
                )}
              </div>
            </>
          );

          if (item.path) {
            return (
              <Link
                key={item.key}
                href={item.path}
                onClick={onNavigate}
                className={`flex min-h-[88px] xs:min-h-[96px] flex-col justify-between rounded-xl border px-2.5 py-2 xs:px-3 xs:py-2.5 shadow-sm active:scale-[0.98] transition-all duration-200 ${
                  active ? theme.cardActive : theme.cardIdle
                }`}
              >
                {innerContent}
              </Link>
            );
          }

          return (
            <button
              key={item.key}
              type="button"
              onClick={item.onClick}
              className={`flex min-h-[88px] xs:min-h-[96px] flex-col justify-between rounded-xl border px-2.5 py-2 xs:px-3 xs:py-2.5 text-left shadow-sm active:scale-[0.98] transition-all duration-200 ${theme.cardIdle}`}
            >
              {innerContent}
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 mb-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 mb-2">
          Support
        </p>
        <div className="grid grid-cols-2 gap-2">
          {MOBILE_SUPPORT_LINKS.map((item) => {
            const Icon = item.icon;
            return (
            <Link
              key={item.key}
              href={item.path}
              onClick={onNavigate}
              className="inline-flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50/60 px-2.5 py-2 text-xs font-semibold text-gray-700 active:bg-blue-100/60"
            >
              <div className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-blue-100 text-blue-600 mr-1">
                <Icon className="h-3 w-3" />
              </div>
              <span className="flex-1">{item.label}</span>
              <ChevronRight className="h-3.5 w-3.5 text-blue-400" />
            </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
