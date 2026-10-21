import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "@heroicons/react/24/outline";
import { prisma } from "@/lib/prisma";
import { exigirPermissao } from "@/lib/tenant";
import { PageHeader, Panel } from "@/components/ui";
import { FormSeguro } from "@/components/form-seguro";
import { criarTipoProjetoSeguro, renomearTipoProjetoSeguro } from "@/lib/actions/formularios";
import { EtapaProjetoRow, NovaEtapaProjeto } from "./EtapaProjeto";
import { ListaDeTipos } from "../_ui/ListaDeTipos";

export const metadata: Metadata = { title: "Tipos de projeto" };

export default async function TiposDeProjetoPage({ searchParams }: { searchParams: Promise<{ tipo?: string; novo?: string }> }) {
  await exigirPermissao("cadastros");
  const { tipo: tipoParam, novo } = await searchParams;
  const [tipos, municipios, perfis, projetosPorTipo] = await Promise.all([
    prisma.tipoProjetoModelo.findMany({ include: { etapas: { orderBy: { ordem: "asc" } }, municipio: { select: { nome: true } } }, orderBy: { nome: "asc" } }),
    prisma.municipio.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    prisma.perfil.findMany({ where: { tipo: "INTERNO" }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    prisma.projeto.groupBy({ by: ["tipo"], _count: { _all: true } }),
  ]);
  const projetos = (chave: string) => projetosPorTipo.find((p) => p.tipo === chave)?._count._all ?? 0;
  const criando = novo === "1" || tipos.length === 0;
  const sel = criando ? undefined : tipos.find((t) => t.id === tipoParam) ?? tipos[0];

  return (
    <>
      <PageHeader
        title="Tipos de projeto"
        description="Cada tipo define as etapas do projeto técnico, o que acontece em cada uma e quem do CTP a conduz. Mudanças valem para projetos novos — e, se quiser, para as etapas ainda não iniciadas dos projetos em andamento."
        actions={<Link href="/cadastros/tipos-de-projeto?novo=1" className="primary-button"><PlusIcon className="h-4 w-4" />Novo tipo de projeto</Link>}
      />

      <div className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)]">
        <ListaDeTipos
          titulo="Tipos"
          itens={tipos.map((t) => ({
            id: t.id,
            nome: t.nome,
            href: `/cadastros/tipos-de-projeto?tipo=${t.id}`,
            detalhe: `${t.etapas.length} etapa${t.etapas.length === 1 ? "" : "s"} · ${projetos(t.chave)} projeto${projetos(t.chave) === 1 ? "" : "s"}`,
            exclusivoDe: t.municipio?.nome,
          }))}
          selecionado={sel?.id}
        />

        {criando ? (
          <Panel title="Novo tipo de projeto" description="Ex.: Plano de Mobilidade, Código Tributário. Depois você monta as etapas.">
            <FormSeguro acao={criarTipoProjetoSeguro} className="flex flex-col gap-4 p-5">
              <label className="text-xs font-semibold text-slate-600">
                Nome
                <input name="nome" required maxLength={80} placeholder="Ex.: Plano de Mobilidade" className="form-control mt-1" />
              </label>
              <div className="flex gap-2">
                <button className="primary-button"><PlusIcon className="h-4 w-4" />Criar tipo</button>
                {tipos.length > 0 && <Link href="/cadastros/tipos-de-projeto" className="secondary-button">Cancelar</Link>}
              </div>
            </FormSeguro>
          </Panel>
        ) : sel ? (
          <div className="flex min-w-0 flex-col gap-5">
            <Panel title={sel.nome} description={`${projetos(sel.chave)} projeto(s) deste tipo`}>
              <FormSeguro key={sel.id} acao={renomearTipoProjetoSeguro} limparAoEnviar={false} className="grid gap-3 p-5 sm:grid-cols-[minmax(0,1fr)_240px_auto] sm:items-end">
                <input type="hidden" name="tipoId" value={sel.id} />
                <label className="text-xs font-semibold text-slate-600">Nome<input name="nome" required maxLength={80} defaultValue={sel.nome} className="form-control mt-1 py-2 text-sm" /></label>
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

            <Panel title="Etapas" description="Na ordem em que o projeto passa por elas.">
              <div className="flex flex-col gap-3 p-5">
                {sel.etapas.length > 0 ? (
                  <ol className="flex flex-col">
                    {sel.etapas.map((etapa, i) => <EtapaProjetoRow key={etapa.id} etapa={etapa} posicao={i} total={sel.etapas.length} perfis={perfis} />)}
                  </ol>
                ) : (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">Este tipo ainda não tem etapas: sem elas, não dá para criar projetos dele.</p>
                )}
                <NovaEtapaProjeto key={sel.id} tipoId={sel.id} perfis={perfis} aberta={sel.etapas.length === 0} />
              </div>
            </Panel>
          </div>
        ) : null}
      </div>
    </>
  );
}
