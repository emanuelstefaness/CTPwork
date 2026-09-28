import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/tenant";
import { garantirEtapasDosContratos, progressoDoContrato, SITUACAO_CONTRATO } from "@/lib/fluxo-contrato";
import { formatarRelativo } from "@/lib/formatters";
import { Avatar, Badge, EmptyState, FilterPills, PageHeader, SearchBox } from "@/components/ui";
import { ChevronRightIcon, PlusIcon } from "@heroicons/react/24/outline";

export const metadata: Metadata = { title: "Contratos" };

type Situacao = keyof typeof SITUACAO_CONTRATO;

export default async function ContratosPage({
  searchParams,
}: {
  searchParams: Promise<{ situacao?: string; tipo?: string; q?: string }>;
}) {
  const user = await requireSession();
  const isInterno = user.tipo === "INTERNO";
  const { situacao, tipo, q } = await searchParams;
  const busca = q?.trim() ?? "";
  const situacaoAtiva = situacao && situacao in SITUACAO_CONTRATO ? (situacao as Situacao) : undefined;
  const escopo = isInterno ? {} : { contratanteId: user.municipioId ?? "__none__" };

  // Cada contrato segue o fluxo do seu tipo, então a situação (andamento / assinatura / concluído)
  // é calculada a partir das etapas dele, não de uma lista fixa.
  await garantirEtapasDosContratos((await prisma.contrato.findMany({ where: { ...escopo, etapas: { none: {} } }, select: { id: true } })).map((c) => c.id));
  const [todos, fluxos] = await Promise.all([
    prisma.contrato.findMany({
      where: {
        ...escopo,
        ...(tipo ? { fluxoId: tipo } : {}),
        ...(busca ? { OR: [{ objeto: { contains: busca } }, { codigo: { contains: busca } }, { contratante: { nome: { contains: busca } } }] } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        contratante: true,
        responsavel: true,
        fluxo: { select: { nome: true } },
        projetos: { select: { id: true } },
        etapas: { orderBy: { ordem: "asc" }, select: { chave: true, curto: true, exigeAssinaturas: true, liberaProjeto: true } },
      },
      take: 300,
    }),
    isInterno ? prisma.fluxoContrato.findMany({ where: { contratos: { some: {} } }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }) : Promise.resolve([]),
  ]);

  const comProgresso = todos.map((c) => ({ c, p: progressoDoContrato(c.etapas, c.etapaAtual) }));
  const contratos = comProgresso.filter(({ p }) => !situacaoAtiva || p.situacao === situacaoAtiva).slice(0, 100);
  const contar = (s: Situacao) => comProgresso.filter(({ p }) => p.situacao === s).length;
  const qs = (mudar: { situacao?: string | null; tipo?: string | null }) => {
    const p = new URLSearchParams();
    const s = mudar.situacao === undefined ? situacaoAtiva : mudar.situacao;
    const t = mudar.tipo === undefined ? tipo : mudar.tipo;
    if (s) p.set("situacao", s);
    if (t) p.set("tipo", t);
    if (busca) p.set("q", busca);
    const str = p.toString();
    return `/contratos${str ? `?${str}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader
        eyebrow={isInterno ? "Jurídico e administrativo" : "Portal do município"}
        title={isInterno ? "Contratos" : "Meus contratos"}
        description={isInterno ? "Do pedido de orçamento à assinatura e criação do projeto técnico." : "Acompanhe cada contrato com o CTP, do orçamento à assinatura."}
        actions={isInterno ? <Link href="/contratos/novo" className="primary-button"><PlusIcon className="h-4 w-4" />Novo contrato</Link> : undefined}
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterPills
          options={[
            { label: "Todos", href: qs({ situacao: null }), active: !situacaoAtiva, count: comProgresso.length },
            ...(Object.keys(SITUACAO_CONTRATO) as Situacao[]).map((s) => ({ label: SITUACAO_CONTRATO[s].rotulo, href: qs({ situacao: s }), active: situacaoAtiva === s, count: contar(s) })),
          ]}
        />
        <SearchBox defaultValue={busca} placeholder={isInterno ? "Buscar objeto, código ou município" : "Buscar objeto ou código"} hidden={{ situacao: situacaoAtiva, tipo }} />
      </div>
      {fluxos.length > 1 && (
        <div className="-mt-1 mb-4 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="mr-1 font-semibold text-slate-500">Tipo:</span>
          <Link href={qs({ tipo: null })} className={`rounded-full px-2.5 py-1 font-semibold ${!tipo ? "bg-cyan-700 text-white" : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"}`}>Todos</Link>
          {fluxos.map((f) => (
            <Link key={f.id} href={qs({ tipo: f.id })} className={`rounded-full px-2.5 py-1 font-semibold ${tipo === f.id ? "bg-cyan-700 text-white" : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"}`}>{f.nome}</Link>
          ))}
        </div>
      )}

      <div className="surface-panel overflow-x-auto">
        {contratos.length === 0 ? (
          <EmptyState
            title={busca || situacaoAtiva || tipo ? "Nenhum contrato encontrado" : "Nenhum contrato ainda"}
            description={busca || situacaoAtiva || tipo ? "Tente outro termo de busca ou limpe os filtros." : "Registre um pedido de orçamento para iniciar o primeiro fluxo contratual."}
          />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Contrato</th>
                {isInterno && <th>Município</th>}
                <th>Progresso</th>
                <th>Responsável</th>
                <th>Atualizado</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {contratos.map(({ c, p }) => {
                const idx = p.indice;
                return (
                  <tr key={c.id} className="group relative">
                    <td className="max-w-md">
                      <Link href={`/contratos/${c.id}`} className="after:absolute after:inset-0">
                        <span className="block text-[11px] font-semibold text-cyan-700">{c.codigo}</span>
                        <span className="block truncate font-medium text-slate-900">{c.objeto}</span>
                      </Link>
                    </td>
                    {isInterno && <td className="whitespace-nowrap text-slate-600">{c.contratante.nome.replace(/^Prefeitura (Municipal )?de /, "")}</td>}
                    <td className="min-w-[210px]">
                      <div className="mb-1.5 flex gap-1" aria-label={`Etapa ${idx + 1} de ${c.etapas.length}`}>
                        {c.etapas.map((e, i) => (
                          <span
                            key={e.chave}
                            className={`h-1.5 flex-1 rounded-full ${i < idx || p.concluido ? "bg-emerald-400" : i === idx ? "bg-cyan-500" : "bg-slate-200"}`}
                          />
                        ))}
                      </div>
                      <Badge tone={SITUACAO_CONTRATO[p.situacao].tom}>{p.atual?.curto ?? c.etapaAtual}</Badge>
                      {isInterno && c.fluxo && c.fluxo.nome !== "Padrão" && <span className="ml-1.5 text-[11px] text-slate-400">· {c.fluxo.nome}</span>}
                      {c.projetos.length > 0 && <span className="ml-1.5 text-[11px] text-slate-400">· projeto criado</span>}
                    </td>
                    <td>
                      <span className="flex items-center gap-2 whitespace-nowrap text-slate-600"><Avatar name={c.responsavel.nome} size="sm" />{c.responsavel.nome}</span>
                    </td>
                    <td className="whitespace-nowrap text-slate-500">{formatarRelativo(c.updatedAt)}</td>
                    <td><ChevronRightIcon className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-cyan-600" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
