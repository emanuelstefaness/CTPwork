import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeftIcon, DocumentCheckIcon } from "@heroicons/react/24/outline";

/** Moldura das telas sem login (esqueci/redefinir senha), no mesmo visual da tela de entrada. */
export function TelaPublica({ titulo, descricao, children }: { titulo: string; descricao: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-10">
      <div className="w-full max-w-md">
        <Link href="/login" className="mb-8 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#082843] text-cyan-300"><DocumentCheckIcon className="h-6 w-6" /></span>
          <span className="text-xl font-bold text-slate-950">CTP Work</span>
        </Link>
        <div className="surface-panel p-7 sm:p-9">
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">{titulo}</h1>
          <p className="mb-6 mt-2 text-sm leading-6 text-slate-500">{descricao}</p>
          {children}
        </div>
        <Link href="/login" className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-cyan-700">
          <ArrowLeftIcon className="h-4 w-4" /> Voltar para a entrada
        </Link>
      </div>
    </div>
  );
}
