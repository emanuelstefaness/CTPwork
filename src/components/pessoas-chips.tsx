"use client";

import { useState } from "react";
import { CheckIcon } from "@heroicons/react/24/outline";
import { Avatar } from "@/components/ui";

export type PessoaChip = { id: string; nome: string; detalhe?: string | null };

/** Seleção múltipla de pessoas como chips clicáveis — o input continua nativo (acessível, envia no FormData). */
export function PessoasChips({ name, pessoas, excluir }: { name: string; pessoas: PessoaChip[]; excluir?: string }) {
  const [sel, setSel] = useState<string[]>([]);
  return (
    <div className="flex flex-wrap gap-2">
      {pessoas.filter((u) => u.id !== excluir).map((u) => {
        const ativo = sel.includes(u.id);
        return (
          <label
            key={u.id}
            className={`flex cursor-pointer items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm transition-all has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-cyan-500 ${
              ativo ? "border-cyan-600 bg-cyan-50 text-cyan-900 shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            <input
              type="checkbox"
              name={name}
              value={u.id}
              checked={ativo}
              onChange={() => setSel((p) => (p.includes(u.id) ? p.filter((x) => x !== u.id) : [...p, u.id]))}
              className="sr-only"
            />
            {ativo ? (
              <span className="grid h-6 w-6 place-items-center rounded-full bg-cyan-600 text-white"><CheckIcon className="h-3.5 w-3.5" /></span>
            ) : (
              <Avatar name={u.nome} size="sm" />
            )}
            <span>
              {u.nome}
              {u.detalhe && <span className="ml-1 text-xs text-slate-400">· {u.detalhe}</span>}
            </span>
          </label>
        );
      })}
    </div>
  );
}
