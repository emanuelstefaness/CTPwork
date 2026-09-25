"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowRightStartOnRectangleIcon,
  Bars3Icon,
  BellIcon,
  BriefcaseIcon,
  ChatBubbleLeftRightIcon,
  ClipboardDocumentListIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

/** Menu sanduíche do portal do município — mesma lógica do AppShell interno, com tema do portal externo. */
export function PortalShell({
  userName,
  notificacoesNaoLidas,
  conversasNaoLidas,
  onSignOut,
  children,
}: {
  userName: string;
  notificacoesNaoLidas: number;
  conversasNaoLidas: number;
  onSignOut: () => Promise<void>;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-slate-50">
      {open && (
        <button
          aria-label="Fechar menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-[#092c52] text-white shadow-2xl transition-transform duration-200 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-cyan-900/30 px-5 py-5">
          <Link href="/projetos" className="flex items-center gap-2.5 font-bold tracking-tight" onClick={() => setOpen(false)}>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-400 text-[#082843]">
              <BriefcaseIcon className="h-5 w-5" />
            </span>
            <span className="text-lg">
              CTP <span className="font-medium">Work</span>
            </span>
          </Link>
          <button aria-label="Fechar menu" onClick={() => setOpen(false)} className="rounded-lg p-2 text-cyan-100 hover:bg-white/10">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        <span className="mx-5 mt-4 inline-flex w-fit rounded-lg bg-cyan-400/15 px-3 py-1.5 text-xs font-semibold text-cyan-100 ring-1 ring-inset ring-cyan-300/20">
          Portal do Município
        </span>
        <nav className="flex-1 space-y-1 px-3 py-5" onClick={() => setOpen(false)}>
          {[
            { href: "/projetos", label: "Meus projetos", icon: BriefcaseIcon },
            { href: "/contratos", label: "Meus contratos", icon: ClipboardDocumentListIcon },
            { href: "/conversas", label: "Conversas com o CTP", icon: ChatBubbleLeftRightIcon, badge: conversasNaoLidas },
            { href: "/notificacoes", label: "Notificações", icon: BellIcon, badge: notificacoesNaoLidas },
          ].map(({ href, label, icon: Icon, badge = 0 }) => {
            const ativo = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={ativo ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${ativo ? "bg-white/10 text-white" : "text-slate-200 hover:bg-white/5 hover:text-white"}`}
              >
                <Icon className={`h-5 w-5 ${ativo ? "text-cyan-300" : "text-slate-400"}`} /> {label}
                {badge > 0 && (
                  <span className={`ml-auto rounded-full px-1.5 text-[10px] font-bold ${href === "/notificacoes" ? "bg-red-500 text-white" : "bg-cyan-400 text-[#082843]"}`}>{badge}</span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-cyan-900/30 p-4">
          <div className="flex items-center gap-3">
            <Link href="/conta" onClick={() => setOpen(false)} className="-m-1 min-w-0 flex-1 rounded-lg p-1 hover:bg-white/5" title="Minha conta">
              <span className="block truncate text-xs font-semibold text-white">{userName}</span>
              <span className="block text-[10px] text-cyan-200">Minha conta</span>
            </Link>
            <form action={onSignOut}>
              <button className="rounded-lg p-2 text-cyan-100 hover:bg-white/10" aria-label="Sair">
                <ArrowRightStartOnRectangleIcon className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-30 border-b border-cyan-900/20 bg-[#092c52] text-white shadow-sm">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button aria-label="Abrir menu" onClick={() => setOpen(true)} className="rounded-lg p-2 text-cyan-50 hover:bg-white/10">
              <Bars3Icon className="h-5 w-5" />
            </button>
            <Link href="/projetos" className="flex items-center gap-2.5 font-bold tracking-tight">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-400 text-[#082843]">
                <BriefcaseIcon className="h-5 w-5" />
              </span>
              <span className="hidden text-xl sm:inline">
                CTP <span className="font-medium">Work</span>
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/conversas" className="relative rounded-lg p-2 text-cyan-50 hover:bg-white/10" aria-label={conversasNaoLidas ? `Conversas (${conversasNaoLidas} não lidas)` : "Conversas"} title="Conversas com o CTP">
              <ChatBubbleLeftRightIcon className="h-5 w-5" />
              {conversasNaoLidas > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-cyan-400 px-1 text-[9px] font-bold text-[#082843] ring-2 ring-[#092c52]">{conversasNaoLidas}</span>}
            </Link>
            <Link href="/notificacoes" className="relative rounded-lg p-2 text-cyan-50 hover:bg-white/10" aria-label="Notificações">
              <BellIcon className="h-5 w-5" />
              {notificacoesNaoLidas > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-400 ring-2 ring-[#092c52]" />}
            </Link>
            <Link href="/conta" className="hidden rounded-lg px-2 py-1 text-right hover:bg-white/10 sm:block" title="Minha conta">
              <span className="block text-xs font-semibold">{userName}</span>
              <span className="block text-[10px] text-cyan-200">Município contratante</span>
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:py-8">{children}</main>
    </div>
  );
}
