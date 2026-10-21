"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ComponentType, type SVGProps } from "react";
import {
  BuildingLibraryIcon, ClipboardDocumentListIcon, DocumentTextIcon, RectangleStackIcon, ShieldCheckIcon, UsersIcon,
} from "@heroicons/react/24/outline";

type Secao = { href: string; rotulo: string; dica: string; icone: ComponentType<SVGProps<SVGSVGElement>> };

/** Seções de Cadastros, agrupadas pelo que a pessoa quer resolver. */
const SECOES_CADASTROS: { grupo: string; itens: Secao[] }[] = [
  {
    grupo: "Pessoas",
    itens: [
      { href: "/cadastros/equipe", rotulo: "Equipe do CTP", dica: "Quem trabalha no CTP", icone: UsersIcon },
      { href: "/cadastros/perfis", rotulo: "Perfis de acesso", dica: "O que cada cargo pode fazer", icone: ShieldCheckIcon },
    ],
  },
  {
    grupo: "Clientes",
    itens: [{ href: "/cadastros/prefeituras", rotulo: "Prefeituras", dica: "Dados e acessos de cada uma", icone: BuildingLibraryIcon }],
  },
  {
    grupo: "Como o trabalho anda",
    itens: [
      { href: "/cadastros/tipos-de-contrato", rotulo: "Tipos de contrato", dica: "Etapas e quem conclui cada uma", icone: ClipboardDocumentListIcon },
      { href: "/cadastros/tipos-de-projeto", rotulo: "Tipos de projeto", dica: "Etapas e quem conduz cada uma", icone: RectangleStackIcon },
      { href: "/cadastros/formularios", rotulo: "Formulários", dica: "Campos de memorandos e etapas", icone: DocumentTextIcon },
    ],
  },
];

export function MenuCadastros() {
  const pathname = usePathname();
  const ativo = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const linhaCelular = useRef<HTMLDivElement>(null);
  // No celular, a seção atual pode estar fora da linha rolável: traz para a vista.
  useEffect(() => {
    const atual = linhaCelular.current?.querySelector<HTMLElement>("[aria-current=page]");
    if (atual && linhaCelular.current) linhaCelular.current.scrollLeft = atual.offsetLeft - 16;
  }, [pathname]);

  return (
    <nav aria-label="Seções de Cadastros" className="lg:sticky lg:top-6">
      {/* Celular: uma linha rolável de atalhos. */}
      <div ref={linhaCelular} className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:hidden">
        {SECOES_CADASTROS.flatMap((g) => g.itens).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={ativo(item.href) ? "page" : undefined}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
              ativo(item.href) ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200"
            }`}
          >
            <item.icone className="h-4 w-4" />
            {item.rotulo}
          </Link>
        ))}
      </div>

      {/* Tela larga: grupos com a explicação de cada seção. */}
      <div className="hidden flex-col gap-5 lg:flex">
        {SECOES_CADASTROS.map((g) => (
          <div key={g.grupo}>
            <p className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-wide text-slate-400">{g.grupo}</p>
            <ul className="flex flex-col gap-0.5">
              {g.itens.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={ativo(item.href) ? "page" : undefined}
                    className={`flex items-start gap-2.5 rounded-xl px-3 py-2 transition-colors ${
                      ativo(item.href) ? "bg-white shadow-sm ring-1 ring-slate-200" : "hover:bg-white/70"
                    }`}
                  >
                    <item.icone className={`mt-0.5 h-4 w-4 shrink-0 ${ativo(item.href) ? "text-cyan-700" : "text-slate-400"}`} />
                    <span className="min-w-0">
                      <span className={`block text-sm font-semibold ${ativo(item.href) ? "text-slate-900" : "text-slate-700"}`}>{item.rotulo}</span>
                      <span className="block text-[11px] leading-4 text-slate-400">{item.dica}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
