import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/tenant";
import { ETAPAS_CONTRATO, ETAPA_CONTRATO_FINAL } from "@/lib/constants";
import { formatarRelativo } from "@/lib/formatters";
import { Avatar, Badge, EmptyState, FilterPills, PageHeader, SearchBox } from "@/components/ui";
import { ChevronRightIcon, PlusIcon } from "@heroicons/react/24/outline";

export const metadata: Metadata = { title: "Contratos" };

// Agrupa as 6 etapas da máquina de estado em fases que fazem sentido para quem filtra a lista.
const FASES = {
  orcamento: { label: "Orçamento", etapas: ["PEDIDO_ORCAMENTO", "EMISSAO_ORCAMENTO", "APROVACAO_ORCAMENTO"] },
  documentacao: { label: "Documentação", etapas: ["DOCUMENTOS_CONTRATACAO"] },
  assinatura: { label: "Em assinatura", etapas: ["TERMO_REFERENCIA_MINUTA"] },
  assinados: { label: "Assinados", etapas: [ETAPA_CONTRATO_FINAL] },
} as const;
type Fase = keyof typeof FASES;

function toneEtapa(chave: string): "emerald" | "amber" | "blue" {
  if (chave === ETAPA_CONTRATO_FINAL) return "emerald";
  if (chave === "TERMO_REFERENCIA_MINUTA") return "amber";
  return "blue";
}

export default async function ContratosPage({
  searchParams,
}: {
  searchParams: Promise<{ fase?: string; q?: string }>;
}) {
  const user = await requireSession();
  const isInterno = user.tipo === "INTERNO";
  const { fase, q } = await searchParams;
  const busca = q?.trim() ?? "";
  const faseAtiva = fase && fase in FASES ? (fase as Fase) : undefined;
  const escopo = isInterno ? {} : { contratanteId: user.municipioId ?? "__none__" };

  const [contratos, porEtapa] = await Promise.all([
    prisma.contrato.findMany({
      where: {
        ...escopo,
        ...(faseAtiva ? { etapaAtual: { in: [...FASES[faseAtiva].etapas] } } : {}),
        ...(busca ? { OR: [{ objeto: { contains: busca } }, { codigo: { contains: busca } }, { contratante: { nome: { contains: busca } } }] } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: { contratante: true, responsavel: true, projetos: { select: { id: true } } },
      take: 100,
    }),
    prisma.contrato.groupBy({ by: ["etapaAtual"], where: escopo, _count: true }),
  ]);

  const contar = (etapas: readonly string[]) => porEtapa.filter((e) => etapas.includes(e.etapaAtual)).reduce((s, e) => s + e._count, 0);
  const total = porEtapa.reduce((s, e) => s + e._count, 0);
  const qs = (f?: string) => {
    const p = new URLSearchParams();
    if (f) p.set("fase", f);
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
            { label: "Todos", href: qs(), active: !faseAtiva, count: total },
            ...(Object.keys(FASES) as Fase[]).map((f) => ({ label: FASES[f].label, href: qs(f), active: faseAtiva === f, count: contar(FASES[f].etapas) })),
          ]}
        />
        <SearchBox defaultValue={busca} placeholder={isInterno ? "Buscar objeto, código ou município" : "Buscar objeto ou código"} hidden={{ fase: faseAtiva }} />
      </div>

      <div className="surface-panel overflow-x-auto">
        {contratos.length === 0 ? (
          <EmptyState
            title={busca || faseAtiva ? "Nenhum contrato encontrado" : "Nenhum contrato ainda"}
            description={busca || faseAtiva ? "Tente outro termo de busca ou limpe os filtros." : "Registre um pedido de orçamento para iniciar o primeiro fluxo contratual."}
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
              {contratos.map((c) => {
                const idx = ETAPAS_CONTRATO.findIndex((e) => e.chave === c.etapaAtual);
                const etapa = ETAPAS_CONTRATO[idx];
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
                      <div className="mb-1.5 flex gap-1" aria-label={`Etapa ${idx + 1} de ${ETAPAS_CONTRATO.length}`}>
                        {ETAPAS_CONTRATO.map((e, i) => (
                          <span
                            key={e.chave}
                            className={`h-1.5 flex-1 rounded-full ${i < idx || c.etapaAtual === ETAPA_CONTRATO_FINAL ? "bg-emerald-400" : i === idx ? "bg-cyan-500" : "bg-slate-200"}`}
                          />
                        ))}
                      </div>
                      <Badge tone={toneEtapa(c.etapaAtual)}>{etapa?.curto ?? c.etapaAtual}</Badge>
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
