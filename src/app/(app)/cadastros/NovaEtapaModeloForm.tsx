"use client";

import type { Resultado } from "@/lib/resultado";
import { useState } from "react";
import { useEnvio } from "@/components/use-envio";
import {
  ClipboardDocumentCheckIcon,
  DocumentTextIcon,
  InformationCircleIcon,
  PencilSquareIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";

function BotaoAdicionar({ pending }: { pending: boolean }) {
  return (
    <button type="submit" disabled={pending} className="primary-button">
      <PlusIcon className="h-4 w-4" />
      {pending ? "Adicionando..." : "Adicionar etapa"}
    </button>
  );
}

export default function NovaEtapaModeloForm({
  tipoProjetoModeloId,
  action,
}: {
  tipoProjetoModeloId: string;
  action: (formData: FormData) => Promise<Resultado<unknown>>;
}) {
  const [temRevisao, setTemRevisao] = useState(false);
  const { onSubmit, pendente, erro } = useEnvio(action, (form) => {
    form.reset();
    setTemRevisao(false);
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-xl border border-dashed border-cyan-300 bg-cyan-50/40 p-4">
      <input type="hidden" name="tipoProjetoModeloId" value={tipoProjetoModeloId} />
      <label className="text-xs font-semibold text-slate-600">
        Nome da nova etapa
        <input name="nome" required placeholder="Ex.: Levantamento de campo" className="form-control mt-1 py-2 text-sm" />
      </label>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
          <input type="checkbox" name="temInformacoesProjeto" className="h-3.5 w-3.5" />
          <InformationCircleIcon className="h-4 w-4 text-cyan-600" /> Dados do projeto + cronograma
        </label>
        <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
          <input type="checkbox" name="temFormulario" className="h-3.5 w-3.5" />
          <DocumentTextIcon className="h-4 w-4 text-blue-600" /> Formulário para o município
        </label>
        <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
          <input type="checkbox" name="temChecklist" className="h-3.5 w-3.5" />
          <ClipboardDocumentCheckIcon className="h-4 w-4 text-violet-600" /> Checklist de documentos
        </label>
        <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
          <input type="checkbox" name="temRevisao" checked={temRevisao} onChange={(e) => setTemRevisao(e.target.checked)} className="h-3.5 w-3.5" />
          <PencilSquareIcon className="h-4 w-4 text-amber-600" /> Revisão de minuta
        </label>
      </div>

      <div className={`grid transition-all duration-200 ease-out ${temRevisao ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="overflow-hidden">
          <input type="hidden" name="modoRevisao" value="DOCUMENTO_INTEIRO" />
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
            O CTP escreve a minuta no editor do sistema e envia por versões; o município grifa, comenta, concorda ou discorda de qualquer trecho e dá o parecer da versão.
          </p>
        </div>
      </div>

      {erro && <p className="text-xs text-red-600">{erro}</p>}

      <BotaoAdicionar pending={pendente} />
    </form>
  );
}
