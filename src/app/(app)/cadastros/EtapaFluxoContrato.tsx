"use client";

import { useState, useTransition } from "react";
import { BuildingLibraryIcon, CheckIcon, ChevronDownIcon, ChevronUpIcon, PencilIcon, PencilSquareIcon, PlusIcon, RocketLaunchIcon, TrashIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { Badge } from "@/components/ui";
import { lerDocumentosPadraoContrato } from "@/lib/documentos-contrato-tipos";
import { useEnvio } from "@/components/use-envio";
import {
  atualizarEtapaFluxoContratoSeguro, criarEtapaFluxoContratoSeguro, moverEtapaFluxoContratoSeguro, removerEtapaFluxoContratoSeguro,
} from "@/lib/actions/formularios";

type Etapa = {
  id: string; nome: string; curto: string; exigeAssinaturas: boolean; liberaProjeto: boolean; perfisQueAvancam: string;
  concluidaPelaPrefeitura: boolean; documentosPadrao: string;
};
type PerfilOpcao = { id: string; nome: string };

const idsDe = (json: string) => {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? (v as string[]) : [];
  } catch {
    return [];
  }
};

/** Campos de uma etapa (nome, rótulo curto e o que ela exige/libera) — usados ao criar e ao editar. */
function CamposEtapa({ etapa, perfis }: { etapa?: Etapa; perfis: PerfilOpcao[] }) {
  const marcados = etapa ? idsDe(etapa.perfisQueAvancam) : [];
  const documentos = lerDocumentosPadraoContrato(etapa?.documentosPadrao);
  const [pelaPrefeitura, setPelaPrefeitura] = useState(!!etapa?.concluidaPelaPrefeitura);
  return (
    <>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px]">
        <label className="text-xs font-semibold text-slate-600">
          Nome da etapa
          <input name="nome" required maxLength={120} defaultValue={etapa?.nome} placeholder="Ex.: Parecer jurídico" className="form-control mt-1 py-2 text-sm" />
        </label>
        <label className="text-xs font-semibold text-slate-600">
          Rótulo curto <span className="font-normal text-slate-400">(barra de progresso)</span>
          <input name="curto" maxLength={24} defaultValue={etapa?.curto} placeholder="Ex.: Jurídico" className="form-control mt-1 py-2 text-sm" />
        </label>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
          <input type="checkbox" name="exigeAssinaturas" defaultChecked={etapa?.exigeAssinaturas} className="mt-0.5 h-3.5 w-3.5" />
          <span><span className="flex items-center gap-1 font-semibold text-slate-700"><PencilSquareIcon className="h-4 w-4 text-amber-600" />Exige assinaturas</span>Aqui se abre a coleta de assinaturas; só avança com todas.</span>
        </label>
        <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
          <input type="checkbox" name="liberaProjeto" defaultChecked={etapa?.liberaProjeto} className="mt-0.5 h-3.5 w-3.5" />
          <span><span className="flex items-center gap-1 font-semibold text-slate-700"><RocketLaunchIcon className="h-4 w-4 text-emerald-600" />Libera o projeto</span>Nesta etapa já dá para criar o projeto técnico.</span>
        </label>
      </div>
      <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
        <input type="checkbox" name="concluidaPelaPrefeitura" checked={pelaPrefeitura} onChange={(e) => setPelaPrefeitura(e.target.checked)} className="mt-0.5 h-3.5 w-3.5" />
        <span><span className="flex items-center gap-1 font-semibold text-slate-700"><BuildingLibraryIcon className="h-4 w-4 text-violet-600" />Concluída pela prefeitura</span>Quem aprova é a prefeitura (perfis com &quot;Aprovar etapas do contrato&quot;), ex.: aprovação do orçamento. Ela pode aprovar ou devolver à etapa anterior com o motivo.</span>
      </label>
      {!pelaPrefeitura && (
        <fieldset className="rounded-lg border border-slate-200 bg-white px-3 py-2">
          <legend className="px-1 text-xs font-semibold text-slate-700">Quem pode concluir esta etapa</legend>
          <p className="text-[11px] text-slate-500">Nenhum marcado = qualquer perfil que gerencia contratos.</p>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
            {perfis.map((p) => (
              <label key={p.id} className="flex items-center gap-1.5 text-xs text-slate-700">
                <input type="checkbox" name="perfisQueAvancam" value={p.id} defaultChecked={marcados.includes(p.id)} className="h-3.5 w-3.5" />
                {p.nome}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs font-semibold text-slate-600">
          Documentos que a prefeitura envia <span className="font-normal text-slate-400">(um por linha)</span>
          <textarea name="docsPrefeitura" rows={3} defaultValue={documentos.filter((d) => d.enviaQuem === "PREFEITURA").map((d) => d.nome).join("\n")} placeholder={"Ex.: Termo de referência assinado\nDeclaração de dotação orçamentária"} className="form-control mt-1 py-2 text-sm" />
        </label>
        <label className="text-xs font-semibold text-slate-600">
          Documentos que o CTP envia <span className="font-normal text-slate-400">(um por linha)</span>
          <textarea name="docsCtp" rows={3} defaultValue={documentos.filter((d) => d.enviaQuem === "CTP").map((d) => d.nome).join("\n")} placeholder={"Ex.: Proposta de orçamento\nCertidões de regularidade"} className="form-control mt-1 py-2 text-sm" />
        </label>
      </div>
      <p className="-mt-1 text-[11px] text-slate-500">Pedidos automaticamente em todo contrato novo deste tipo; a etapa só avança com todos aprovados.</p>
    </>
  );
}

export function EtapaFluxoContratoRow({ etapa, posicao, total, perfis }: { etapa: Etapa; posicao: number; total: number; perfis: PerfilOpcao[] }) {
  const restritos = idsDe(etapa.perfisQueAvancam).map((id) => perfis.find((p) => p.id === id)?.nome).filter(Boolean);
  const documentosPedidos = lerDocumentosPadraoContrato(etapa.documentosPadrao).length;
  const [editando, setEditando] = useState(false);
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const { onSubmit, pendente: salvando, erro: erroEdicao } = useEnvio(atualizarEtapaFluxoContratoSeguro, () => setEditando(false));

  const rodar = (acao: (d: FormData) => Promise<{ ok: boolean; erro?: string }>, extra: Record<string, string> = {}) =>
    iniciar(async () => {
      const dados = new FormData();
      dados.set("etapaId", etapa.id);
      for (const [k, v] of Object.entries(extra)) dados.set(k, v);
      const r = await acao(dados);
      setErro(r.ok ? null : r.erro ?? "Não foi possível salvar.");
    });

  if (editando) {
    return (
      <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-xl border border-cyan-200 bg-cyan-50/40 p-4">
        <input type="hidden" name="etapaId" value={etapa.id} />
        <CamposEtapa etapa={etapa} perfis={perfis} />
        <label className="flex items-start gap-2 text-xs text-slate-600">
          <input type="checkbox" name="aplicarAosContratos" defaultChecked className="mt-0.5 h-3.5 w-3.5" />
          <span>Aplicar também aos contratos em andamento que <strong>ainda não passaram</strong> desta etapa (quem conclui e documentos que faltarem).</span>
        </label>
        {erroEdicao && <p className="text-xs text-red-600" role="alert">{erroEdicao}</p>}
        <div className="flex gap-2">
          <button type="submit" disabled={salvando} className="primary-button min-h-8 px-3 py-1.5 text-xs"><CheckIcon className="h-3.5 w-3.5" />{salvando ? "Salvando…" : "Salvar"}</button>
          <button type="button" onClick={() => setEditando(false)} className="secondary-button min-h-8 px-3 py-1.5 text-xs"><XMarkIcon className="h-3.5 w-3.5" />Cancelar</button>
        </div>
      </form>
    );
  }

  return (
    <div className={`rounded-xl border border-slate-200 bg-white px-4 py-3 ${pendente ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">{posicao + 1}</span>
        <div className="min-w-[160px] flex-1">
          <p className="text-sm font-semibold text-slate-800">{etapa.nome}</p>
          <p className="text-[11px] text-slate-400">Rótulo: {etapa.curto}{posicao === total - 1 ? " · etapa final" : ""}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {etapa.exigeAssinaturas && <Badge tone="amber">Exige assinaturas</Badge>}
          {etapa.liberaProjeto && <Badge tone="emerald">Libera o projeto</Badge>}
          {etapa.concluidaPelaPrefeitura && <Badge tone="cyan">Prefeitura aprova</Badge>}
          {!etapa.concluidaPelaPrefeitura && restritos.length > 0 && <Badge tone="violet">Só: {restritos.join(", ")}</Badge>}
          {documentosPedidos > 0 && <Badge tone="slate">{documentosPedidos} documento{documentosPedidos === 1 ? "" : "s"}</Badge>}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <button type="button" aria-label="Mover para cima" disabled={posicao === 0 || pendente} onClick={() => rodar(moverEtapaFluxoContratoSeguro, { direcao: "up" })} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"><ChevronUpIcon className="h-4 w-4" /></button>
          <button type="button" aria-label="Mover para baixo" disabled={posicao === total - 1 || pendente} onClick={() => rodar(moverEtapaFluxoContratoSeguro, { direcao: "down" })} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"><ChevronDownIcon className="h-4 w-4" /></button>
          <button type="button" aria-label="Editar etapa" onClick={() => setEditando(true)} className="rounded-lg p-1.5 text-slate-400 hover:bg-cyan-50 hover:text-cyan-700"><PencilIcon className="h-4 w-4" /></button>
          <button
            type="button"
            aria-label="Remover etapa"
            onClick={() => { if (confirm(`Remover a etapa "${etapa.nome}"? Contratos já criados não são afetados.`)) rodar(removerEtapaFluxoContratoSeguro); }}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
          ><TrashIcon className="h-4 w-4" /></button>
        </div>
      </div>
      {erro && <p className="mt-2 text-xs text-red-600" role="alert">{erro}</p>}
    </div>
  );
}

export function NovaEtapaFluxoContrato({ fluxoId, perfis }: { fluxoId: string; perfis: PerfilOpcao[] }) {
  const { onSubmit, pendente, erro } = useEnvio(criarEtapaFluxoContratoSeguro);
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-xl border border-dashed border-cyan-300 bg-cyan-50/40 p-4">
      <input type="hidden" name="fluxoId" value={fluxoId} />
      <p className="text-xs font-semibold text-slate-700">Adicionar etapa ao final</p>
      <CamposEtapa perfis={perfis} />
      {erro && <p className="text-xs text-red-600" role="alert">{erro}</p>}
      <button type="submit" disabled={pendente} className="primary-button self-start"><PlusIcon className="h-4 w-4" />{pendente ? "Adicionando…" : "Adicionar etapa"}</button>
    </form>
  );
}
