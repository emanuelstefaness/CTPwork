"use client";

import { useState, useTransition } from "react";
import { Avatar } from "@/components/ui";
import { decidirSugestoes, excluirAnotacao, resolverAnotacao, responderAnotacao, type Resultado } from "@/lib/actions/documentos";
import { CORES_GRIFO, TIPO_ANOTACAO_LABEL, type TipoAnotacao } from "@/lib/editor/extensoes";
import { formatarRelativo } from "@/lib/formatters";
import { ArrowPathIcon, ArrowRightIcon, CheckCircleIcon, CheckIcon, MagnifyingGlassIcon, TrashIcon, XCircleIcon } from "@heroicons/react/24/outline";
import type { AnotacaoView } from "./tipos";

/** Comentário, discordância e sugestão de redação pedem uma ação do CTP; grifo e concordo são registro. */
export const pedeAcao = (a: AnotacaoView) => a.tipo === "COMENTARIO" || a.tipo === "DISCORDO" || a.tipo === "SUGESTAO";

export const estiloTipo: Record<TipoAnotacao, { chip: string; borda: string }> = {
  GRIFO: { chip: "bg-amber-50 text-amber-800 ring-amber-200", borda: "border-amber-300" },
  COMENTARIO: { chip: "bg-cyan-50 text-cyan-800 ring-cyan-200", borda: "border-cyan-400" },
  CONCORDO: { chip: "bg-emerald-50 text-emerald-800 ring-emerald-200", borda: "border-emerald-400" },
  DISCORDO: { chip: "bg-red-50 text-red-700 ring-red-200", borda: "border-red-400" },
  SUGESTAO: { chip: "bg-violet-50 text-violet-800 ring-violet-200", borda: "border-violet-400" },
};

/** Como aceitar uma sugestão a partir deste painel (depende de onde o painel está aberto). */
export type AcoesSugestao = {
  /** No rascunho: aplica a redação no texto e marca como aceita. */
  aceitar?: (a: AnotacaoView) => void;
  /** Numa versão enviada: leva o CTP ao rascunho da próxima versão, onde a sugestão é aplicada. */
  irParaRascunho?: () => void;
};

/** Texto atual riscado → redação proposta, como no controle de alterações do Word. */
export function DiffSugestao({ a, compacto = false }: { a: AnotacaoView; compacto?: boolean }) {
  return (
    <div className="mt-2.5 space-y-1.5 font-serif text-xs leading-5">
      <p className="rounded-md bg-red-50 px-2 py-1 text-red-800">
        <span className="mr-1 font-sans text-[9px] font-bold uppercase tracking-wide text-red-500">Atual</span>
        <del className={`decoration-red-400 ${compacto ? "line-clamp-2" : "line-clamp-4"}`}>{a.trecho}</del>
      </p>
      <p className="rounded-md bg-emerald-50 px-2 py-1 text-emerald-900">
        <span className="mr-1 font-sans text-[9px] font-bold uppercase tracking-wide text-emerald-600">Proposta</span>
        {a.sugestao ? <ins className="whitespace-pre-wrap no-underline">{a.sugestao}</ins> : <em className="font-sans text-slate-500">suprimir este trecho</em>}
      </p>
    </div>
  );
}

function Chip({ a }: { a: AnotacaoView }) {
  const cor = CORES_GRIFO.find((c) => c.chave === a.cor);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${estiloTipo[a.tipo].chip}`}>
      {a.tipo === "GRIFO" && cor && <span className="h-2 w-2 rounded-full ring-1 ring-black/10" style={{ backgroundColor: cor.hex }} />}
      {a.tipo === "SUGESTAO" ? "Sugestão" : TIPO_ANOTACAO_LABEL[a.tipo]}
    </span>
  );
}

function CartaoAnotacao({
  a,
  usuario,
  ativa,
  podeResponder,
  onAtivar,
  onLocalizar,
  onErro,
  sugestoes,
}: {
  a: AnotacaoView;
  usuario: { id: string; tipo: string; permissoes?: readonly string[] };
  ativa: boolean;
  podeResponder: boolean;
  onAtivar: () => void;
  onLocalizar?: () => void;
  onErro: (msg: string) => void;
  sugestoes?: AcoesSugestao;
}) {
  const [respondendo, setRespondendo] = useState(false);
  const [resposta, setResposta] = useState("");
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [pendente, iniciar] = useTransition();
  const ehSugestao = a.tipo === "SUGESTAO";
  const isInterno = usuario.tipo === "INTERNO";
  const podeResolver = pedeAcao(a) && !ehSugestao && (isInterno || a.autor.id === usuario.id);
  const decideSugestao = ehSugestao && isInterno && !a.decisao && !!usuario.permissoes?.includes("minuta.escrever");
  const podeExcluir = a.autor.id === usuario.id && a.respostas.length === 0 && !a.resolvido;
  const orfa = a.ate <= a.de;

  const rodar = (acao: () => Promise<Resultado<unknown>>, depois?: () => void) =>
    iniciar(async () => {
      const r = await acao();
      if (!r.ok) onErro(r.erro);
      else depois?.();
    });

  return (
    <article
      id={`anotacao-${a.id}`}
      onClick={onAtivar}
      className={`cursor-pointer rounded-xl border bg-white p-3.5 text-left transition-all ${
        ativa ? "border-cyan-400 shadow-md ring-2 ring-cyan-100" : "border-slate-200 hover:border-slate-300"
      } ${a.resolvido ? "opacity-70" : ""} ${pendente ? "pointer-events-none opacity-60" : ""}`}
    >
      <header className="flex items-start gap-2.5">
        <Avatar name={a.autor.nome} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-slate-800">
            {a.autor.nome}
            <span className={`ml-1.5 rounded px-1 py-px text-[9px] font-semibold ${a.autor.tipo === "INTERNO" ? "bg-cyan-50 text-cyan-700" : "bg-violet-50 text-violet-700"}`}>
              {a.autor.tipo === "INTERNO" ? "CTP" : "Município"}
            </span>
          </p>
          <p className="text-[10px] text-slate-400" suppressHydrationWarning>{formatarRelativo(new Date(a.criadoEm))}</p>
        </div>
        <Chip a={a} />
      </header>

      {ehSugestao ? (
        <DiffSugestao a={a} />
      ) : (
        <blockquote className={`mt-2.5 line-clamp-3 border-l-2 pl-2.5 font-serif text-xs italic leading-5 text-slate-600 ${estiloTipo[a.tipo].borda}`}>
          {orfa ? <span className="not-italic text-slate-400">Trecho removido do texto: </span> : null}“{a.trecho}”
        </blockquote>
      )}
      {a.texto && (
        <p className="mt-2 whitespace-pre-wrap text-[13px] leading-5 text-slate-800">
          {ehSugestao && <span className="mr-1 text-[11px] font-semibold text-slate-500">Justificativa:</span>}
          {a.texto}
        </p>
      )}

      {a.respostas.length > 0 && (
        <ul className="mt-3 space-y-2.5 border-t border-slate-100 pt-3">
          {a.respostas.map((r) => (
            <li key={r.id} className="flex gap-2">
              <Avatar name={r.autor.nome} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-slate-700">
                  {r.autor.nome} <span className="font-normal text-slate-400" suppressHydrationWarning>· {formatarRelativo(new Date(r.criadoEm))}</span>
                </p>
                <p className="whitespace-pre-wrap text-xs leading-5 text-slate-700">{r.texto}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {a.resolvido && !ehSugestao && (
        <p className="mt-2.5 flex items-center gap-1 text-[11px] font-medium text-emerald-700">
          <CheckCircleIcon className="h-3.5 w-3.5" /> Resolvido{a.resolvidoPor ? ` por ${a.resolvidoPor}` : ""}
        </p>
      )}
      {ehSugestao && a.decisao && (
        <p className={`mt-2.5 text-[11px] font-semibold ${a.decisao === "ACEITA" ? "text-emerald-700" : "text-red-700"}`}>
          {a.decisao === "ACEITA" ? <CheckCircleIcon className="-mt-0.5 mr-1 inline h-3.5 w-3.5" /> : <XCircleIcon className="-mt-0.5 mr-1 inline h-3.5 w-3.5" />}
          {a.decisao === "ACEITA" ? "Aceita" : "Não aceita"}{a.resolvidoPor ? ` por ${a.resolvidoPor}` : ""}
          {a.decisao === "ACEITA" && <span className="font-normal text-slate-500"> · entra na próxima versão</span>}
        </p>
      )}
      {ehSugestao && !a.decisao && !isInterno && (
        <p className="mt-2.5 text-[11px] font-medium text-violet-700">Aguardando o CTP aceitar ou recusar.</p>
      )}

      {recusando ? (
        <form
          className="mt-3"
          onClick={(e) => e.stopPropagation()}
          onSubmit={(e) => {
            e.preventDefault();
            rodar(() => decidirSugestoes([a.id], "RECUSADA", motivo), () => { setMotivo(""); setRecusando(false); });
          }}
        >
          <textarea
            autoFocus
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={2}
            placeholder="Explique ao município por que a redação atual fica (obrigatório)…"
            className="form-control text-xs"
          />
          <div className="mt-1.5 flex justify-end gap-1.5">
            <button type="button" className="rounded-md px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-100" onClick={() => setRecusando(false)}>Cancelar</button>
            <button type="submit" disabled={!motivo.trim()} className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-40">Recusar sugestão</button>
          </div>
        </form>
      ) : respondendo ? (
        <form
          className="mt-3"
          onClick={(e) => e.stopPropagation()}
          onSubmit={(e) => {
            e.preventDefault();
            rodar(() => responderAnotacao(a.id, resposta), () => { setResposta(""); setRespondendo(false); });
          }}
        >
          <textarea
            autoFocus
            value={resposta}
            onChange={(e) => setResposta(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) e.currentTarget.form?.requestSubmit(); }}
            rows={2}
            placeholder="Escreva uma resposta…"
            className="form-control text-xs"
          />
          <div className="mt-1.5 flex justify-end gap-1.5">
            <button type="button" className="rounded-md px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-100" onClick={() => setRespondendo(false)}>Cancelar</button>
            <button type="submit" disabled={!resposta.trim()} className="rounded-md bg-cyan-700 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-40">Responder</button>
          </div>
        </form>
      ) : (
        <>
        {decideSugestao && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            {sugestoes?.aceitar ? (
              <button type="button" className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700" onClick={() => sugestoes.aceitar!(a)}>
                <CheckIcon className="h-3.5 w-3.5" /> Aceitar e aplicar no texto
              </button>
            ) : sugestoes?.irParaRascunho ? (
              <button type="button" title="A sugestão é aplicada no rascunho da próxima versão" className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700" onClick={sugestoes.irParaRascunho}>
                Aceitar na nova versão <ArrowRightIcon className="h-3 w-3" />
              </button>
            ) : null}
            <button type="button" className="rounded-md border border-red-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50" onClick={() => setRecusando(true)}>Recusar</button>
          </div>
        )}
        <footer className="mt-3 flex flex-wrap items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {podeResponder && !a.resolvido && (
            <button type="button" className="rounded-md px-2 py-1 text-[11px] font-semibold text-cyan-700 hover:bg-cyan-50" onClick={() => setRespondendo(true)}>Responder</button>
          )}
          {onLocalizar && !orfa && (
            <button type="button" className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100" onClick={onLocalizar}>
              <MagnifyingGlassIcon className="h-3 w-3" /> Localizar no texto
            </button>
          )}
          {podeResolver && (
            <button
              type="button"
              className={`ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold ${a.resolvido ? "text-slate-500 hover:bg-slate-100" : "text-emerald-700 hover:bg-emerald-50"}`}
              onClick={() => rodar(() => resolverAnotacao(a.id, !a.resolvido))}
            >
              {a.resolvido ? <><ArrowPathIcon className="h-3 w-3" /> Reabrir</> : <><CheckCircleIcon className="h-3.5 w-3.5" /> Resolver</>}
            </button>
          )}
          {ehSugestao && isInterno && a.decisao && usuario.permissoes?.includes("minuta.escrever") && (
            <button
              type="button"
              title="Volta a sugestão para “aguardando decisão”. Se ela já foi aplicada no rascunho, desfaça o texto manualmente."
              className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-100"
              onClick={() => rodar(() => resolverAnotacao(a.id, false))}
            >
              <ArrowPathIcon className="h-3 w-3" /> Reabrir
            </button>
          )}
          {podeExcluir && (
            <button type="button" title="Excluir anotação" aria-label="Excluir anotação" className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => { if (confirm(ehSugestao ? "Retirar esta sugestão?" : "Excluir esta anotação?")) rodar(() => excluirAnotacao(a.id)); }}>
              <TrashIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </footer>
        </>
      )}
    </article>
  );
}

export function PainelAnotacoes({
  anotacoes,
  usuario,
  ativaId,
  podeResponder,
  onAtivar,
  onLocalizar,
  onErro,
  vazio,
  sugestoes,
  onAceitarTodas,
}: {
  anotacoes: AnotacaoView[];
  usuario: { id: string; tipo: string; permissoes?: readonly string[] };
  ativaId: string | null;
  podeResponder: boolean;
  onAtivar: (id: string) => void;
  onLocalizar?: (a: AnotacaoView) => void;
  onErro: (msg: string) => void;
  vazio: string;
  sugestoes?: AcoesSugestao;
  /** No rascunho: aplica de uma vez todas as sugestões de redação ainda sem decisão. */
  onAceitarTodas?: (lista: AnotacaoView[]) => void;
}) {
  const [filtro, setFiltro] = useState<"pendentes" | "todos" | "resolvidos">("todos");
  const pendentes = anotacoes.filter((a) => pedeAcao(a) && !a.resolvido);
  const resolvidos = anotacoes.filter((a) => a.resolvido);
  const sugestoesAbertas = anotacoes.filter((a) => a.tipo === "SUGESTAO" && !a.decisao);
  const lista = (filtro === "pendentes" ? pendentes : filtro === "resolvidos" ? resolvidos : anotacoes)
    .slice()
    .sort((x, y) => (x.ate <= x.de ? 1e9 : x.de) - (y.ate <= y.de ? 1e9 : y.de));

  return (
    <div>
      {onAceitarTodas && usuario.tipo === "INTERNO" && sugestoesAbertas.length >= 2 && (
        <button
          type="button"
          onClick={() => onAceitarTodas(sugestoesAbertas)}
          className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
        >
          <CheckIcon className="h-4 w-4" /> Aceitar as {sugestoesAbertas.length} sugestões de redação
        </button>
      )}
      <div className="mb-3 flex gap-1 rounded-lg bg-slate-100 p-0.5 text-[11px] font-semibold">
        {([
          ["todos", `Todos (${anotacoes.length})`],
          ["pendentes", `Pendentes (${pendentes.length})`],
          ["resolvidos", `Resolvidos (${resolvidos.length})`],
        ] as const).map(([v, rotulo]) => (
          <button key={v} type="button" onClick={() => setFiltro(v)} className={`flex-1 rounded-md px-2 py-1.5 transition-colors ${filtro === v ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
            {rotulo}
          </button>
        ))}
      </div>
      {lista.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-xs leading-5 text-slate-400">{filtro === "pendentes" && anotacoes.length > 0 ? "Nada pendente de resposta." : filtro === "resolvidos" && anotacoes.length > 0 ? "Nada resolvido ainda." : vazio}</p>
      ) : (
        <div className="space-y-2.5">
          {lista.map((a) => (
            <CartaoAnotacao
              key={a.id}
              a={a}
              usuario={usuario}
              ativa={ativaId === a.id}
              podeResponder={podeResponder}
              onAtivar={() => onAtivar(a.id)}
              onLocalizar={onLocalizar ? () => onLocalizar(a) : undefined}
              onErro={onErro}
              sugestoes={sugestoes}
            />
          ))}
        </div>
      )}
    </div>
  );
}
