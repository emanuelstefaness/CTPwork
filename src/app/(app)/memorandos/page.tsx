import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireInterno } from "@/lib/tenant";
import { STATUS_MEMORANDO_LABEL } from "@/lib/constants";
import { formatarRelativo } from "@/lib/formatters";
import { Avatar, Badge, EmptyState, FilterPills, PageHeader, SearchBox } from "@/components/ui";
import { ChevronRightIcon, PencilSquareIcon, PlusIcon } from "@heroicons/react/24/outline";

export const metadata: Metadata = { title: "Memorandos" };

const statusTone: Record<string, "blue" | "amber" | "emerald" | "slate"> = {
  ABERTO: "blue",
  EM_EXECUCAO: "amber",
  CONCLUIDO: "emerald",
  CANCELADO: "slate",
};

const FILTROS = ["ABERTO", "EM_EXECUCAO", "CONCLUIDO", "CANCELADO"] as const;

export default async function MemorandosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  await requireInterno();
  const { status, q } = await searchParams;
  const busca = q?.trim() ?? "";

  const [memorandos, contagem] = await Promise.all([
    prisma.memorando.findMany({
      where: {
        ...(status && FILTROS.includes(status as (typeof FILTROS)[number]) ? { status } : {}),
        ...(busca ? { OR: [{ assunto: { contains: busca } }, { codigo: { contains: busca } }, { corpo: { contains: busca } }] } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: { setores: { include: { setor: true } }, criadoPor: true, fluxoAssinatura: { include: { signatarios: true } } },
      take: 100,
    }),
    prisma.memorando.groupBy({ by: ["status"], _count: true }),
  ]);

  const total = contagem.reduce((s, c) => s + c._count, 0);
  const qs = (s?: string) => {
    const p = new URLSearchParams();
    if (s) p.set("status", s);
    if (busca) p.set("q", busca);
    const str = p.toString();
    return `/memorandos${str ? `?${str}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader
        eyebrow="Comunicação interna"
        title="Memorandos"
        description="Solicitações rastreáveis entre os setores do Cilla Tech Park."
        actions={<Link href="/memorandos/novo" className="primary-button"><PlusIcon className="h-4 w-4" />Novo memorando</Link>}
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterPills
          options={[
            { label: "Todos", href: qs(), active: !status, count: total },
            ...FILTROS.map((f) => ({ label: STATUS_MEMORANDO_LABEL[f], href: qs(f), active: status === f, count: contagem.find((c) => c.status === f)?._count ?? 0 })),
          ]}
        />
        <SearchBox defaultValue={busca} placeholder="Buscar por código ou assunto" hidden={{ status }} />
      </div>

      <div className="surface-panel overflow-x-auto">
        {memorandos.length === 0 ? (
          <EmptyState
            title={busca || status ? "Nenhum memorando encontrado" : "Nenhum memorando ainda"}
            description={busca || status ? "Tente outro termo de busca ou limpe os filtros." : "Crie o primeiro memorando para registrar uma solicitação entre setores."}
          />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Memorando</th>
                <th>Destino</th>
                <th>Emissor</th>
                <th>Assinaturas</th>
                <th>Status</th>
                <th>Criado</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {memorandos.map((m) => {
                const sig = m.fluxoAssinatura?.signatarios ?? [];
                const assinados = sig.filter((s) => s.status === "ASSINADO").length;
                return (
                  <tr key={m.id} className="group relative">
                    <td className="max-w-md">
                      <Link href={`/memorandos/${m.id}`} className="after:absolute after:inset-0">
                        <span className="block text-[11px] font-semibold text-cyan-700">{m.codigo}</span>
                        <span className="block truncate font-medium text-slate-900">{m.assunto}</span>
                      </Link>
                    </td>
                    <td className="text-slate-600">{m.setores.map((s) => s.setor.nome).join(", ")}</td>
                    <td>
                      <span className="flex items-center gap-2 text-slate-600"><Avatar name={m.criadoPor.nome} size="sm" />{m.criadoPor.nome}</span>
                    </td>
                    <td className="text-slate-500">
                      {sig.length === 0 ? (
                        <span className="text-slate-300">—</span>
                      ) : (
                        <span className={`inline-flex items-center gap-1 ${assinados === sig.length ? "text-emerald-700" : ""}`}>
                          <PencilSquareIcon className="h-3.5 w-3.5" />
                          {assinados}/{sig.length}
                        </span>
                      )}
                    </td>
                    <td><Badge tone={statusTone[m.status] ?? "slate"}>{STATUS_MEMORANDO_LABEL[m.status]}</Badge></td>
                    <td className="whitespace-nowrap text-slate-500" title={m.createdAt.toLocaleString("pt-BR")}>{formatarRelativo(m.createdAt)}</td>
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
