"use client";

import type { Resultado } from "@/lib/resultado";
import { useState, useTransition } from "react";
import { useEnvio } from "@/components/use-envio";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClipboardDocumentCheckIcon,
  DocumentTextIcon,
  InformationCircleIcon,
  PencilIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { Badge } from "@/components/ui";

type EtapaModelo = {
  id: string;
  ordem: number;
  nome: string;
  temInformacoesProjeto: boolean;
  temFormulario: boolean;
  temChecklist: boolean;
  temRevisao: boolean;
  modoRevisao: string;
};

function BotaoSalvar({ pending }: { pending: boolean }) {
  return (
    <button type="submit" disabled={pending} className="primary-button min-h-8 px-3 py-1.5 text-xs">
      <CheckIcon className="h-3.5 w-3.5" />
      {pending ? "Salvando..." : "Salvar"}
    </button>
  );
}

export default function EtapaModeloRow({
  etapa,
  posicao,
  total,
  atualizar,
  remover,
  mover,
}: {
  etapa: EtapaModelo;
  posicao: number;
  total: number;
  atualizar: (formData: FormData) => Promise<Resultado<unknown>>;
  remover: (etapaModeloId: string) => Promise<void>;
  mover: (etapaModeloId: string, direcao: "up" | "down") => Promise<void>;
}) {
  const [editando, setEditando] = useState(false);
  const [temRevisao, setTemRevisao] = useState(etapa.temRevisao);
  const [removendo, setRemovendo] = useState(false);
  const [pending, startTransition] = useTransition();
  const { onSubmit, pendente: salvando, erro } = useEnvio(atualizar, () => setEditando(false));

  function handleRemover() {
    if (!window.confirm(`Remover a etapa "${etapa.nome}" deste fluxo? Projetos já criados não são afetados.`)) return;
    setRemovendo(true);
    startTransition(async () => remover(etapa.id));
  }

  return (
    <div
      className={`animar-entrada-linha overflow-hidden rounded-xl border border-slate-200 transition-opacity duration-300 ease-out ${
        removendo ? "pointer-events-none !opacity-30" : ""
      }`}
    >
      {!editando ? (
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">{posicao + 1}</span>
          <p className="min-w-[140px] flex-1 text-sm font-semibold text-slate-800">{etapa.nome}</p>
          <div className="flex flex-wrap gap-1.5">
            {etapa.temInformacoesProjeto && <Badge tone="cyan">Dados + cronograma</Badge>}
            {etapa.temFormulario && <Badge tone="blue">Formulário</Badge>}
            {etapa.temChecklist && <Badge tone="violet">Checklist</Badge>}
            {etapa.temRevisao && <Badge tone="amber">Revisão de documento</Badge>}
            {!etapa.temInformacoesProjeto && !etapa.temFormulario && !etapa.temChecklist && !etapa.temRevisao && (
              <span className="text-[11px] text-slate-400">Sem capacidades extras</span>
            )}
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <button
              type="button"
              disabled={posicao === 0 || pending}
              onClick={() => startTransition(async () => mover(etapa.id, "up"))}
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
              aria-label="Mover para cima"
            >
              <ChevronUpIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={posicao === total - 1 || pending}
              onClick={() => startTransition(async () => mover(etapa.id, "down"))}
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
              aria-label="Mover para baixo"
            >
              <ChevronDownIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setEditando(true)}
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-cyan-50 hover:text-cyan-700"
              aria-label="Editar etapa"
            >
              <PencilIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleRemover}
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
              aria-label="Remover etapa"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-3 bg-slate-50/70 px-4 py-4 transition-all duration-200">
          <input type="hidden" name="etapaModeloId" value={etapa.id} />
          <label className="text-xs font-semibold text-slate-600">
            Nome da etapa
            <input name="nome" required defaultValue={etapa.nome} className="form-control mt-1 py-2 text-sm" />
          </label>

          <div>
            <p className="mb-1.5 text-xs font-semibold text-slate-600">O que essa etapa tem</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                <input type="checkbox" name="temInformacoesProjeto" defaultChecked={etapa.temInformacoesProjeto} className="h-3.5 w-3.5" />
                <InformationCircleIcon className="h-4 w-4 text-cyan-600" /> Dados do projeto + cronograma
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                <input type="checkbox" name="temFormulario" defaultChecked={etapa.temFormulario} className="h-3.5 w-3.5" />
                <DocumentTextIcon className="h-4 w-4 text-blue-600" /> Formulário para o município
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                <input type="checkbox" name="temChecklist" defaultChecked={etapa.temChecklist} className="h-3.5 w-3.5" />
                <ClipboardDocumentCheckIcon className="h-4 w-4 text-violet-600" /> Checklist de documentos
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  name="temRevisao"
                  checked={temRevisao}
                  onChange={(e) => setTemRevisao(e.target.checked)}
                  className="h-3.5 w-3.5"
                />
                <PencilSquareIcon className="h-4 w-4 text-amber-600" /> Revisão de minuta
              </label>
            </div>
          </div>

          <div className={`grid transition-all duration-200 ease-out ${temRevisao ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
            <div className="overflow-hidden">
              <input type="hidden" name="modoRevisao" value="DOCUMENTO_INTEIRO" />
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
                Minuta escrita no editor do sistema; o município grifa, comenta, concorda ou discorda por trecho e dá o parecer de cada versão.
              </p>
            </div>
          </div>

          {erro && <p className="text-xs text-red-600">{erro}</p>}

          <div className="flex gap-2">
            <BotaoSalvar pending={salvando} />
            <button type="button" onClick={() => setEditando(false)} className="secondary-button min-h-8 px-3 py-1.5 text-xs">
              <XMarkIcon className="h-3.5 w-3.5" />
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
