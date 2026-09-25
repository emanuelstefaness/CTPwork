import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession, assertAcessoContratante } from "@/lib/tenant";
import { STATUS_ETAPA_LABEL } from "@/lib/constants";
import { notFound } from "next/navigation";
import EtapaPanel from "./EtapaPanel";
import { Badge } from "@/components/ui";
import { BriefcaseIcon, BuildingLibraryIcon, CalendarDaysIcon, DocumentTextIcon } from "@heroicons/react/24/outline";
import { formatarData } from "@/lib/formatters";
import { ConversasRelacionadas } from "@/components/conversas-relacionadas";

export const metadata: Metadata = { title: "Projeto" };

export default async function ProjetoDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ etapa?: string }> }) {
  const { id } = await params;
  const { etapa: etapaIdParam } = await searchParams;
  const user = await requireSession();
  const projeto = await prisma.projeto.findUnique({
    where: { id },
    include: { contratante: true, contratoOrigem: true, etapas: { orderBy: { ordem: "asc" } } },
  });
  if (!projeto) notFound();
  assertAcessoContratante(user, projeto.contratanteId);
  const etapaSelecionada = projeto.etapas.find((e) => e.id === etapaIdParam) ?? projeto.etapas.find((e) => e.status !== "CONCLUIDA") ?? projeto.etapas[0];
  const concluidaCount = projeto.etapas.filter((e) => e.status === "CONCLUIDA").length;
  const isInterno = user.tipo === "INTERNO";
  const tipoModelo = await prisma.tipoProjetoModelo.findUnique({ where: { chave: projeto.tipo } });
  const tipoLabel = tipoModelo?.nome ?? projeto.tipo;

  return (
    <div className="mx-auto max-w-[1500px]">
      <p className="mb-3 text-xs font-medium text-slate-400">Projetos <span className="mx-1.5 text-slate-300">›</span> {tipoLabel} <span className="mx-1.5 text-slate-300">›</span> <span className="text-cyan-700">{etapaSelecionada?.nome}</span></p>
      <div className="mb-5 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{isInterno ? `${tipoLabel} — ${projeto.contratante.nome}` : `Projeto ${tipoLabel}`}</h1><Badge tone="cyan">{projeto.codigo}</Badge></div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><BuildingLibraryIcon className="h-3.5 w-3.5 text-slate-400" />{projeto.contratante.nome}</span>
            <span className="flex items-center gap-1.5"><BriefcaseIcon className="h-3.5 w-3.5 text-slate-400" />Contrato {projeto.contratoOrigem.codigo}</span>
            <span className="flex items-center gap-1.5"><CalendarDaysIcon className="h-3.5 w-3.5 text-slate-400" />Vigência até {formatarData(projeto.dataVigencia)}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2"><Link href={`/contratos/${projeto.contratoOrigemId}`} className="secondary-button"><DocumentTextIcon className="h-4 w-4" />Ver contrato</Link></div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start">
        <div className="flex flex-col gap-5 lg:sticky lg:top-20">
          <div className="surface-panel p-5">
          <p className="mb-4 text-sm font-semibold text-slate-800">Cronograma de etapas</p>
          <ol className="flex flex-col">
            {projeto.etapas.map((etapa, index) => {
              const selected = etapaSelecionada?.id === etapa.id;
              const done = etapa.status === "CONCLUIDA";
              const isLast = index === projeto.etapas.length - 1;
              return (
                <li key={etapa.id} className="relative flex gap-3 pb-6 last:pb-0">
                  {!isLast && <span className={`absolute left-[11px] top-6 h-full w-0.5 ${done ? "bg-emerald-400" : "bg-slate-200"}`} />}
                  <Link
                    href={`/projetos/${projeto.id}?etapa=${etapa.id}`}
                    className={`relative z-10 mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
                      done ? "bg-emerald-500 text-white" : selected ? "bg-cyan-500 text-white ring-4 ring-cyan-100" : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {done ? "✓" : index + 1}
                  </Link>
                  <div className="min-w-0 pt-0.5">
                    <Link
                      href={`/projetos/${projeto.id}?etapa=${etapa.id}`}
                      className={`block text-xs font-semibold leading-4 hover:underline ${selected ? "text-cyan-700" : done ? "text-emerald-700" : "text-slate-600"}`}
                    >
                      {etapa.nome}
                    </Link>
                    <p className="mt-0.5 text-[10px] text-slate-400">
                      {selected ? STATUS_ETAPA_LABEL[etapa.status] : done ? "Concluída" : etapa.prazo ? `Prazo: ${formatarData(etapa.prazo)}` : "Sem prazo definido"}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="mt-2 border-t border-slate-100 pt-3 text-[10px] font-medium text-slate-400">{concluidaCount} de {projeto.etapas.length} etapas concluídas</p>
          </div>
          <ConversasRelacionadas user={user} projetoId={projeto.id} />
        </div>

        <div>
          {etapaSelecionada && <EtapaPanel etapaId={etapaSelecionada.id} projeto={{ id: projeto.id, tipo: projeto.tipo, tipoLabel, contratanteId: projeto.contratanteId, codigo: projeto.codigo }} />}
        </div>
      </div>
    </div>
  );
}
