import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "@heroicons/react/24/outline";
import { prisma } from "@/lib/prisma";
import { exigirPermissao } from "@/lib/tenant";
import { PageHeader, Panel } from "@/components/ui";
import { FormSeguro } from "@/components/form-seguro";
import { alternarFluxoContratoSeguro, atualizarFluxoContratoSeguro, criarFluxoContratoSeguro } from "@/lib/actions/formularios";
import { EtapaContratoRow, NovaEtapaContrato } from "./EtapaContrato";
import { ListaDeTipos } from "../_ui/ListaDeTipos";

export const metadata: Metadata = { title: "Tipos de contrato" };

export default async function TiposDeContratoPage({ searchParams }: { searchParams: Promise<{ tipo?: string; novo?: string }> }) {
  await exigirPermissao("cadastros");
  const { tipo: tipoParam, novo } = await searchParams;
  const [tipos, municipios, perfis] = await Promise.all([
    prisma.fluxoContrato.findMany({
      include: { etapas: { orderBy: { ordem: "asc" } }, municipio: { select: { nome: true } }, _count: { select: { contratos: true } } },
      orderBy: [{ ativo: "desc" }, { nome: "asc" }],
    }),
    prisma.municipio.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    prisma.perfil.findMany({ where: { tipo: "INTERNO" }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
  ]);
  const criando = novo === "1" || tipos.length === 0;
  const sel = criando ? undefined : tipos.find((t) => t.id === tipoParam) ?? tipos[0];

  return (
    <>
      <PageHeader
        title="Tipos de contrato"
        description="Cada tipo define as etapas que o contrato percorre e quem conclui cada uma. O que você muda aqui vale para contratos novos — e, se quiser, para os que estão em andamento."
        actions={<Link href="/cadastros/tipos-de-contrato?novo=1" className="primary-button"><PlusIcon className="h-4 w-4" />Novo tipo de contrato</Link>}
      />

      <div className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)]">
        <ListaDeTipos
          titulo="Tipos"
          itens={tipos.map((t) => ({
            id: t.id,
            nome: t.nome,
            href: `/cadastros/tipos-de-contrato?tipo=${t.id}`,
            detalhe: `${t.etapas.length} etapa${t.etapas.length === 1 ? "" : "s"} · ${t._count.contratos} contrato${t._count.contratos === 1 ? "" : "s"}`,
            exclusivoDe: t.municipio?.nome,
            inativo: !t.ativo,
          }))}
          selecionado={sel?.id}
        />

        {criando ? (
          <Panel title="Novo tipo de contrato" description="Comece do zero ou copie as etapas de um tipo que já existe e ajuste depois.">
            <FormSeguro acao={criarFluxoContratoSeguro} className="flex flex-col gap-4 p-5">
              <label className="text-xs font-semibold text-slate-600">
                Nome
                <input name="nome" required maxLength={80} placeholder="Ex.: Dispensa de licitação" className="form-control mt-1" />
              </label>
              <label className="text-xs font-semibold text-slate-600">
                Começar com
                <select name="baseId" defaultValue="" className="form-control mt-1">
                  <option value="">Nenhuma etapa (montar do zero)</option>
                  {tipos.map((t) => <option key={t.id} value={t.id}>As etapas de “{t.nome}”</option>)}
                </select>
              </label>
              <div className="flex gap-2">
                <button className="primary-button"><PlusIcon className="h-4 w-4" />Criar tipo</button>
                {tipos.length > 0 && <Link href="/cadastros/tipos-de-contrato" className="secondary-button">Cancelar</Link>}
              </div>
            </FormSeguro>
          </Panel>
        ) : sel ? (
          <div className="flex min-w-0 flex-col gap-5">
            <Panel
              title={sel.nome}
              description={`${sel._count.contratos} contrato(s) usam este tipo${sel.ativo ? "" : " · desativado: não aparece ao criar contratos"}`}
              action={
                <FormSeguro acao={alternarFluxoContratoSeguro} className="flex flex-col items-end" erroClassName="mt-1 max-w-[260px] text-right text-[11px] text-red-600">
                  <input type="hidden" name="fluxoId" value={sel.id} />
                  <input type="hidden" name="ativo" value={String(!sel.ativo)} />
                  <button className={`min-h-8 rounded-lg px-3 py-1 text-[11px] font-semibold ${sel.ativo ? "text-red-600 hover:bg-red-50" : "border border-emerald-200 text-emerald-700 hover:bg-emerald-50"}`}>
                    {sel.ativo ? "Desativar tipo" : "Ativar tipo"}
                  </button>
                </FormSeguro>
              }
            >
              <FormSeguro key={sel.id} acao={atualizarFluxoContratoSeguro} limparAoEnviar={false} className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_220px_auto] lg:items-end">
                <input type="hidden" name="fluxoId" value={sel.id} />
                <label className="text-xs font-semibold text-slate-600">Nome<input name="nome" required maxLength={80} defaultValue={sel.nome} className="form-control mt-1 py-2 text-sm" /></label>
                <label className="text-xs font-semibold text-slate-600">Quando usar <span className="font-normal text-slate-400">(opcional)</span><input name="descricao" maxLength={300} defaultValue={sel.descricao ?? ""} placeholder="Ex.: contratações abaixo do limite legal" className="form-control mt-1 py-2 text-sm" /></label>
                <label className="text-xs font-semibold text-slate-600">
                  Disponível para
                  <select name="municipioId" defaultValue={sel.municipioId ?? ""} className="form-control mt-1 py-2 text-sm">
                    <option value="">Todas as prefeituras</option>
                    {municipios.map((m) => <option key={m.id} value={m.id}>Só {m.nome}</option>)}
                  </select>
                </label>
                <button className="secondary-button min-h-10 px-3 text-xs">Salvar</button>
              </FormSeguro>
            </Panel>

            <Panel title="Etapas" description="Na ordem em que o contrato passa por elas. A última é o estado final.">
              <div className="flex flex-col gap-3 p-5">
                {sel.etapas.length < 2 && (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
                    Um tipo de contrato precisa de pelo menos 2 etapas para ser usado. A última etapa é o estado final do contrato.
                  </p>
                )}
                {sel.etapas.length >= 2 && !sel.etapas.some((e) => e.liberaProjeto) && (
                  <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
                    Nenhuma etapa libera o projeto: contratos deste tipo não geram projeto técnico (útil para aditivos, por exemplo).
                  </p>
                )}
                {sel.etapas.length > 0 && (
                  <ol className="flex flex-col">
                    {sel.etapas.map((etapa, i) => <EtapaContratoRow key={etapa.id} etapa={etapa} posicao={i} total={sel.etapas.length} perfis={perfis} />)}
                  </ol>
                )}
                <NovaEtapaContrato key={sel.id} fluxoId={sel.id} perfis={perfis} aberta={sel.etapas.length === 0} />
              </div>
            </Panel>
          </div>
        ) : null}
      </div>
    </>
  );
}
