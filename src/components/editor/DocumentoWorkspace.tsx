"use client";

import { useEffect, useState, useTransition } from "react";
import { ArrowsRightLeftIcon, CheckCircleIcon, DocumentPlusIcon, DocumentTextIcon, PaperClipIcon, PencilSquareIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { criarRascunho } from "@/lib/actions/documentos";
import { formatarDiaDoEvento } from "@/lib/formatters";
import { ComparacaoVersoes } from "./ComparacaoVersoes";
import { VersaoDocumento } from "./VersaoDocumento";
import type { UsuarioEditor, VersaoView } from "./tipos";

function statusDaVersao(v: VersaoView, ehUltimaEnviada: boolean) {
  if (!v.enviadoEm) return { rotulo: "Rascunho", cor: "bg-amber-400" };
  if (v.avaliacao?.status === "APROVADO") return { rotulo: "Aprovada", cor: "bg-emerald-500" };
  if (v.avaliacao?.status === "REPROVADO") return { rotulo: "Ajustes pedidos", cor: "bg-red-500" };
  if (!ehUltimaEnviada) return { rotulo: "Substituída", cor: "bg-slate-300" };
  return { rotulo: "Em revisão", cor: "bg-cyan-500" };
}

/**
 * Documento da etapa: abas de versão (v1, v2… e o rascunho), comparação entre versões e a
 * versão selecionada aberta no editor. `versoes` chega ordenada da mais nova para a mais antiga.
 */
export function DocumentoWorkspace({
  etapaId,
  versoes,
  usuario,
  tipoLabel,
}: {
  etapaId: string;
  versoes: VersaoView[];
  usuario: UsuarioEditor;
  tipoLabel: string;
}) {
  const isInterno = usuario.tipo === "INTERNO";
  const escreve = usuario.permissoes.includes("minuta.escrever");
  const visiveis = isInterno ? versoes : versoes.filter((v) => v.enviadoEm);
  const rascunho = visiveis.find((v) => !v.enviadoEm);
  const enviadas = visiveis.filter((v) => v.enviadoEm);
  const ultimaEnviada = enviadas[0];

  const [selecionadaId, setSelecionadaId] = useState<string | null>(null);
  const [comparando, setComparando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviada, setEnviada] = useState<number | null>(null);
  const [pendente, iniciar] = useTransition();

  useEffect(() => {
    if (enviada === null) return;
    const t = window.setTimeout(() => setEnviada(null), 8000);
    return () => window.clearTimeout(t);
  }, [enviada]);

  // Padrão: o rascunho (para o CTP) ou a versão enviada mais recente.
  const selecionada = visiveis.find((v) => v.id === selecionadaId) ?? rascunho ?? ultimaEnviada;

  const novaVersao = () =>
    iniciar(async () => {
      setErro(null);
      const r = await criarRascunho(etapaId);
      if (!r.ok) return setErro(r.erro);
      setComparando(false);
      setSelecionadaId(r.dados.id);
    });

  if (!selecionada) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-cyan-50 text-cyan-700"><DocumentTextIcon className="h-7 w-7" /></span>
        {escreve ? (
          <>
            <h3 className="mt-4 text-base font-bold text-slate-900">Nenhum documento nesta etapa ainda</h3>
            <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">Escreva a minuta direto no sistema ou importe um arquivo Word. Quando estiver pronta, envie ao município para revisão.</p>
            <button type="button" onClick={novaVersao} disabled={pendente} className="primary-button mt-5"><PencilSquareIcon className="h-4 w-4" />{pendente ? "Criando…" : "Criar documento"}</button>
            {erro && <p className="mt-3 text-sm text-red-600">{erro}</p>}
          </>
        ) : (
          <>
            <h3 className="mt-4 text-base font-bold text-slate-900">O documento ainda não foi enviado</h3>
            <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">Assim que o CTP enviar a primeira versão, você será notificado e poderá lê-la, grifar e comentar aqui.</p>
          </>
        )}
      </div>
    );
  }

  const indice = enviadas.findIndex((v) => v.id === selecionada.id);
  // Para um rascunho, a referência é a última enviada; para uma enviada, a anterior a ela.
  const anterior = !selecionada.enviadoEm ? ultimaEnviada : indice >= 0 ? enviadas[indice + 1] : undefined;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="-mx-1 flex w-full gap-1.5 overflow-x-auto px-1 pb-1 sm:w-auto sm:flex-wrap sm:overflow-visible sm:pb-0" role="tablist" aria-label="Versões do documento">
          {[...visiveis].reverse().map((v) => {
            const st = statusDaVersao(v, v.id === ultimaEnviada?.id);
            const ativa = !comparando && v.id === selecionada.id;
            return (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={ativa}
                onClick={() => { setComparando(false); setSelecionadaId(v.id); }}
                className={`flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-left transition-all ${ativa ? "border-cyan-600 bg-white shadow-sm ring-2 ring-cyan-100" : "border-slate-200 bg-white/70 hover:border-slate-300 hover:bg-white"}`}
              >
                <span className={`h-2 w-2 rounded-full ${st.cor}`} />
                <span>
                  <span className="block text-xs font-bold text-slate-900">{v.enviadoEm ? `Versão ${v.versao}` : `Rascunho v${v.versao}`}</span>
                  <span className="block text-[10px] text-slate-500" suppressHydrationWarning>{st.rotulo}{v.enviadoEm ? ` · ${formatarDiaDoEvento(new Date(v.enviadoEm))}` : ""}</span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="ml-auto flex flex-wrap gap-1.5">
          {visiveis.filter((v) => v.conteudo).length >= 2 && (
            <button type="button" onClick={() => setComparando((c) => !c)} className={`secondary-button min-h-9 px-3 py-1.5 text-xs ${comparando ? "border-cyan-500 bg-cyan-50 text-cyan-800" : ""}`}>
              <ArrowsRightLeftIcon className="h-4 w-4" /> Comparar versões
            </button>
          )}
          {escreve && !rascunho && (
            <button type="button" onClick={novaVersao} disabled={pendente} className="primary-button min-h-9 px-3 py-1.5 text-xs">
              <DocumentPlusIcon className="h-4 w-4" /> {pendente ? "Criando…" : `Nova versão (v${(versoes[0]?.versao ?? 0) + 1})`}
            </button>
          )}
        </div>
      </div>
      {erro && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
      {enviada !== null && (
        <p role="status" className="mb-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <CheckCircleIcon className="h-5 w-5 shrink-0 text-emerald-600" />
          <span><strong>Versão {enviada} enviada ao município.</strong> Os usuários da prefeitura foram avisados e a etapa está aguardando o parecer deles.</span>
          <button type="button" onClick={() => setEnviada(null)} aria-label="Fechar aviso" className="ml-auto rounded p-1 text-emerald-700 hover:bg-emerald-100"><XMarkIcon className="h-4 w-4" /></button>
        </p>
      )}

      {comparando ? (
        <ComparacaoVersoes versoes={visiveis} />
      ) : selecionada.conteudo === null ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center">
          <PaperClipIcon className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm font-semibold text-slate-700">Versão {selecionada.versao} — enviada como arquivo anexo</p>
          <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-500">Esta versão é anterior ao editor de documentos e está disponível apenas para download.</p>
          {selecionada.arquivoLegado && <a href={selecionada.arquivoLegado.url} target="_blank" rel="noopener" className="secondary-button mt-4">{selecionada.arquivoLegado.nome}</a>}
        </div>
      ) : (
        <VersaoDocumento
          key={`${selecionada.id}-${selecionada.enviadoEm ? "enviada" : "rascunho"}`}
          versao={selecionada}
          ehUltimaEnviada={selecionada.id === ultimaEnviada?.id}
          anteriores={!selecionada.enviadoEm ? anterior?.anotacoes ?? [] : []}
          versaoAnterior={anterior?.versao ?? null}
          usuario={usuario}
          tipoLabel={tipoLabel}
          onIrParaRascunho={escreve ? () => (rascunho ? setSelecionadaId(rascunho.id) : novaVersao()) : undefined}
          onEnviada={setEnviada}
        />
      )}
    </div>
  );
}
