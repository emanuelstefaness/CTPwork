"use client";

import { useState } from "react";
import { diffWords } from "diff";
import { textoDoConteudo, type VersaoView } from "./tipos";

/** "O que mudou" entre duas versões: inserções em verde, remoções riscadas em vermelho. */
export function ComparacaoVersoes({ versoes }: { versoes: VersaoView[] }) {
  const comTexto = versoes.filter((v) => v.conteudo);
  const [deId, setDeId] = useState(comTexto[1]?.id ?? comTexto[0]?.id);
  const [paraId, setParaId] = useState(comTexto[0]?.id);
  const de = comTexto.find((v) => v.id === deId);
  const para = comTexto.find((v) => v.id === paraId);

  const partes = de && para ? diffWords(textoDoConteudo(de.conteudo), textoDoConteudo(para.conteudo)) : [];
  const inseridas = partes.filter((p) => p.added).reduce((s, p) => s + p.value.trim().split(/\s+/).filter(Boolean).length, 0);
  const removidas = partes.filter((p) => p.removed).reduce((s, p) => s + p.value.trim().split(/\s+/).filter(Boolean).length, 0);

  if (comTexto.length < 2) {
    return <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">É preciso ter ao menos duas versões para comparar.</p>;
  }

  const rotulo = (v: VersaoView) => `Versão ${v.versao}${v.enviadoEm ? "" : " (rascunho)"}`;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-5 py-3 text-sm">
        <label className="flex items-center gap-2 text-slate-600">
          De
          <select value={deId} onChange={(e) => setDeId(e.target.value)} className="form-control w-auto py-1.5 text-sm">
            {comTexto.map((v) => <option key={v.id} value={v.id}>{rotulo(v)}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-slate-600">
          para
          <select value={paraId} onChange={(e) => setParaId(e.target.value)} className="form-control w-auto py-1.5 text-sm">
            {comTexto.map((v) => <option key={v.id} value={v.id}>{rotulo(v)}</option>)}
          </select>
        </label>
        <span className="ml-auto flex gap-3 text-xs">
          <span className="rounded bg-emerald-100 px-2 py-1 font-semibold text-emerald-800">+{inseridas} palavras</span>
          <span className="rounded bg-red-100 px-2 py-1 font-semibold text-red-700">−{removidas} palavras</span>
        </span>
      </div>
      <div className="bg-slate-100 px-3 py-6 sm:px-8 sm:py-10">
        <div className="mx-auto max-w-[816px] rounded-sm bg-white px-6 py-10 font-serif text-[15px] leading-7 text-slate-800 shadow-sm sm:px-[72px]">
          {deId === paraId ? (
            <p className="text-center font-sans text-sm text-slate-400">Escolha duas versões diferentes.</p>
          ) : (
            <p className="whitespace-pre-wrap">
              {partes.map((p, i) =>
                p.added ? (
                  <ins key={i} className="rounded-sm bg-emerald-100 text-emerald-900 no-underline">{p.value}</ins>
                ) : p.removed ? (
                  <del key={i} className="rounded-sm bg-red-100 text-red-700 decoration-red-400">{p.value}</del>
                ) : (
                  <span key={i}>{p.value}</span>
                ),
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
