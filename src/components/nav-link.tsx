"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BriefcaseIcon, CalendarDaysIcon, ChartBarSquareIcon, ChatBubbleLeftRightIcon, ClipboardDocumentListIcon, Cog6ToothIcon, DocumentTextIcon } from "@heroicons/react/24/outline";

const icons = {
  dashboard: ChartBarSquareIcon,
  memorandos: DocumentTextIcon,
  contratos: ClipboardDocumentListIcon,
  projetos: BriefcaseIcon,
  conversas: ChatBubbleLeftRightIcon,
  prazos: CalendarDaysIcon,
  cadastros: Cog6ToothIcon,
};

export type NavIcon = keyof typeof icons;

export function NavLink({ href, label, icon, badge = 0 }: { href: string; label: string; icon: NavIcon; badge?: number }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  const Icon = icons[icon];

  return (
    <Link
      href={href}
      className={`group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
        active
          ? "bg-cyan-400/15 text-white ring-1 ring-inset ring-cyan-300/20"
          : "text-slate-300 hover:bg-white/7 hover:text-white"
      }`}
    >
      <Icon className={`h-5 w-5 ${active ? "text-cyan-300" : "text-slate-400 group-hover:text-slate-200"}`} />
      <span>{label}</span>
      {badge > 0 ? (
        <span className="ml-auto rounded-full bg-cyan-400 px-1.5 text-[10px] font-bold text-[#082843]" aria-label={`${badge} não lida(s)`}>{badge}</span>
      ) : (
        active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan-300" />
      )}
    </Link>
  );
}
