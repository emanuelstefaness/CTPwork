import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireInterno } from "@/lib/tenant";
import { criarContratoSeguro } from "@/lib/actions/formularios";
import { FormSeguro } from "@/components/form-seguro";
import { ETAPAS_CONTRATO } from "@/lib/constants";
import { BackLink, PageHeader } from "@/components/ui";
import { InformationCircleIcon, PlusIcon } from "@heroicons/react/24/outline";

export const metadata: Metadata = { title: "Novo contrato" };

export default async function NovoContratoPage() {
  const user = await requireInterno();
  const [municipios, usuarios] = await Promise.all([
    prisma.municipio.findMany({ orderBy: { nome: "asc" } }),
    prisma.user.findMany({ where: { tipo: "INTERNO", ativo: true }, orderBy: { nome: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <BackLink href="/contratos" label="Contratos" />
      <PageHeader title="Novo contrato" description="Registre o pedido de orçamento que abre um novo fluxo contratual." />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <FormSeguro acao={criarContratoSeguro} limparAoEnviar={false} className="surface-panel" erroClassName="flex items-center gap-1.5 border-t border-red-100 bg-red-50 px-6 py-3 text-sm text-red-700">
          <div className="flex flex-col gap-5 px-6 py-6">
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
                  {municipios.map((m) => (
                    <option key={m.id} value={m.id}>{m.nome}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">Responsável no CTP</span>
                <select name="responsavelId" required className="form-control" defaultValue={user.id}>
                  {usuarios.map((u) => (
                    <option key={u.id} value={u.id}>{u.nome}</option>
                  ))}
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
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-900"><InformationCircleIcon className="h-5 w-5 text-cyan-600" />Como funciona</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">O contrato percorre estas etapas. Ao final, com todas as assinaturas, você cria o projeto técnico.</p>
          <ol className="mt-4 flex flex-col gap-2.5">
            {ETAPAS_CONTRATO.map((e, i) => (
              <li key={e.chave} className="flex items-start gap-2.5 text-xs text-slate-600">
                <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${i === 0 ? "bg-cyan-600 text-white" : "bg-slate-100 text-slate-500"}`}>{i + 1}</span>
                <span className="pt-0.5">{e.nome}</span>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </div>
  );
}
