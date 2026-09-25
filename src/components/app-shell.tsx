"use client";

import { useState } from "react";
import Link from "next/link";
import { NavLink, type NavIcon } from "@/components/nav-link";
import {
  ArrowRightStartOnRectangleIcon,
  Bars3Icon,
  BellIcon,
  ChatBubbleLeftRightIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

type NavItem = { href: string; label: string; icon: NavIcon; badge?: number };

/** Menu sanduíche: navegação sempre escondida atrás do hambúrguer, em qualquer tamanho de tela. */
export function AppShell({
  navItems,
  userName,
  isGestor,
  notificacoesNaoLidas,
  conversasNaoLidas,
  onSignOut,
  children,
}: {
  navItems: NavItem[];
  userName: string;
  isGestor: boolean;
  notificacoesNaoLidas: number;
  conversasNaoLidas: number;
  onSignOut: () => Promise<void>;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const initials = userName.split(" ").map((n) => n[0]).slice(0, 2).join("");

  return (
    <div className="min-h-screen bg-[#f4f7fa]">
      {open && (
        <button
          aria-label="Fechar menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-[#082843] text-white shadow-2xl transition-transform duration-200 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-5">
          <Link href="/dashboard" className="flex items-center gap-3" onClick={() => setOpen(false)}>
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-cyan-400 text-xs font-extrabold text-[#082843] shadow-lg shadow-cyan-950/20">
              CTP
            </span>
            <div>
              <p className="text-xl font-bold tracking-tight">CTP Work</p>
              <p className="text-[11px] text-slate-400">Cilla Tech Park</p>
            </div>
          </Link>
          <button aria-label="Fechar menu" onClick={() => setOpen(false)} className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-5" onClick={() => setOpen(false)}>
          {navItems.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </nav>

        <div className="mx-4 mb-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-semibold text-white">Gestão pública que funciona</p>
          <p className="mt-1 text-[11px] leading-5 text-slate-400">Contratos, projetos e municípios em um só fluxo.</p>
        </div>

        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3">
            <Link href="/conta" onClick={() => setOpen(false)} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1 -m-1 hover:bg-white/5" title="Minha conta">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-cyan-400/15 text-xs font-bold text-cyan-200">{initials}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-white">{userName}</span>
                <span className="block text-[10px] text-slate-400">Minha conta</span>
              </span>
            </Link>
            <form action={onSignOut}>
              <button className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Sair">
                <ArrowRightStartOnRectangleIcon className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
          <button
            aria-label="Abrir menu"
            onClick={() => setOpen(true)}
            className="rounded-xl p-2.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            <Bars3Icon className="h-5 w-5" />
          </button>
          <Link href="/dashboard" className="hidden items-center gap-2 font-bold text-slate-950 sm:flex">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-cyan-500 text-white text-xs font-bold">CTP</span>
            <span>Work</span>
          </Link>
          <form action="/projetos" className="relative hidden w-full max-w-xl md:block">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              name="q"
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-cyan-100"
              placeholder="Buscar projetos por nome, código ou município…"
            />
          </form>
          <div className="ml-auto flex items-center gap-1.5">
            <Link href="/conversas" className="relative rounded-xl p-2.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800" aria-label={conversasNaoLidas ? `Conversas (${conversasNaoLidas} não lidas)` : "Conversas"} title="Conversas com municípios">
              <ChatBubbleLeftRightIcon className="h-5 w-5" />
              {conversasNaoLidas > 0 && <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-cyan-600 px-1 text-[9px] font-bold text-white ring-2 ring-white">{conversasNaoLidas}</span>}
            </Link>
            <Link href="/notificacoes" className="relative rounded-xl p-2.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800" aria-label="Notificações">
              <BellIcon className="h-5 w-5" />
              {notificacoesNaoLidas > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />}
            </Link>
            <div className="mx-1 h-6 w-px bg-slate-200" />
            <Link href="/conta" className="hidden items-center gap-2 rounded-xl p-1 hover:bg-slate-100 sm:flex" title="Minha conta">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-[#0c3763] text-xs font-bold text-white">{initials}</span>
              <span className="hidden pr-1 xl:block">
                <span className="block text-xs font-semibold text-slate-800">{userName}</span>
                <span className="block text-[10px] text-slate-400">{isGestor ? "Gestor CTP" : "Equipe técnica"}</span>
              </span>
            </Link>
          </div>
        </div>
      </header>

      <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}
