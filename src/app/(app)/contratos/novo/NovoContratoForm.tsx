"use client";

import { useState } from "react";
import Link from "next/link";
import { InformationCircleIcon, PencilSquareIcon, PlusIcon, RocketLaunchIcon } from "@heroicons/react/24/outline";
import { FormSeguro } from "@/components/form-seguro";
import { criarContratoSeguro } from "@/lib/actions/formularios";

type Fluxo = { id: string; nome: string; descricao: string | null; etapas: { nome: string; exigeAssinaturas: boolean; liberaProjeto: boolean }[] };

export default function NovoContratoForm({
  municipios,
  usuarios,
  fluxos,
  responsavelPadrao,
  fluxoPadrao,
  podeConfigurar,
}: {
  municipios: { id: string; nome: string }[];
  usuarios: { id: string; nome: string }[];
  fluxos: Fluxo[];
  responsavelPadrao: string;
  fluxoPadrao: string;
  podeConfigurar: boolean;
}) {
  const [fluxoId, setFluxoId] = useState(fluxoPadrao);
  const fluxo = fluxos.find((f) => f.id === fluxoId) ?? fluxos[0];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <FormSeguro acao={criarContratoSeguro} limparAoEnviar={false} className="surface-panel" erroClassName="flex items-center gap-1.5 border-t border-red-100 bg-red-50 px-6 py-3 text-sm text-red-700">
        <div className="flex flex-col gap-5 px-6 py-6">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Tipo de contrato</span>
            <select name="fluxoId" value={fluxoId} onChange={(e) => setFluxoId(e.target.value)} className="form-control">
              {fluxos.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
            <span className="mt-1 block text-xs text-slate-400">{fluxo?.descricao ?? "Define as etapas que o contrato vai percorrer."}</span>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Objeto do contrato</span>
            <input name="objeto" required className="form-control" placeholder="Ex.: Elaboração do Plano Diretor Municipal" />
            <span className="mt-1 block text-xs text-slate-400">Descreva o serviço como aparecerá no termo de referência.</span>
          </label>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Município contratante</span>
              <select name="contratanteId" required className="form-control" defaultValue="">
                <option value="" disabled>Selecione o município</option>
                {municipios.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Responsável no CTP</span>
              <select name="responsavelId" required className="form-control" defaultValue={responsavelPadrao}>
                {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Tags <span className="font-normal text-slate-400">(opcional)</span></span>
            <input name="tags" className="form-control" placeholder="plano-diretor, prioritário" />
            <span className="mt-1 block text-xs text-slate-400">Separe por vírgula. Ajudam a encontrar o contrato depois.</span>
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-4">
          <Link href="/contratos" className="secondary-button">Cancelar</Link>
          <button type="submit" className="primary-button"><PlusIcon className="h-4 w-4" />Criar contrato</button>
        </div>
      </FormSeguro>

      <aside className="surface-panel h-fit p-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-900"><InformationCircleIcon className="h-5 w-5 text-cyan-600" />Etapas deste tipo</p>
        <p className="mt-2 text-xs leading-5 text-slate-500">O contrato percorre estas etapas, na ordem.</p>
        <ol className="mt-4 flex flex-col gap-2.5">
          {fluxo?.etapas.map((e, i) => (
            <li key={i} className="flex items-start gap-2.5 text-xs text-slate-600">
              <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${i === 0 ? "bg-cyan-600 text-white" : "bg-slate-100 text-slate-500"}`}>{i + 1}</span>
              <span className="pt-0.5">
                {e.nome}
                {e.exigeAssinaturas && <span className="ml-1 inline-flex items-center gap-0.5 rounded bg-amber-50 px-1 text-[10px] font-semibold text-amber-800"><PencilSquareIcon className="h-3 w-3" />assinaturas</span>}
                {e.liberaProjeto && <span className="ml-1 inline-flex items-center gap-0.5 rounded bg-emerald-50 px-1 text-[10px] font-semibold text-emerald-800"><RocketLaunchIcon className="h-3 w-3" />projeto</span>}
              </span>
            </li>
          ))}
        </ol>
        {podeConfigurar && (
          <Link href="/cadastros?aba=fluxos-contrato" className="mt-4 inline-block text-xs font-semibold text-cyan-700 hover:underline">Configurar tipos de contrato →</Link>
        )}
      </aside>
    </div>
  );
}
