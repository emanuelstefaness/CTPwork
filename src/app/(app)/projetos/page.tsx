import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/tenant";
import { filtroProjetosVisiveis } from "@/lib/visibilidade";
import { STATUS_ETAPA_LABEL } from "@/lib/constants";
import { Avatar, Badge, EmptyState, FilterPills, PageHeader, SearchBox } from "@/components/ui";
import { BellAlertIcon, BuildingLibraryIcon, CalendarDaysIcon } from "@heroicons/react/24/outline";
import { formatarData } from "@/lib/formatters";

export const metadata: Metadata = { title: "Projetos" };

type Filtro = "aguardando" | "andamento" | "concluidos";

export default async function ProjetosPage({ searchParams }: { searchParams: Promise<{ q?: string; filtro?: string }> }) {
  const user = await requireSession();
  const isInterno = user.tipo === "INTERNO";
  const { q, filtro } = await searchParams;
  const busca = q?.trim() ?? "";

  const todos = await prisma.projeto.findMany({
    where: {
      ...filtroProjetosVisiveis(user),
      ...(busca
        ? { OR: [{ codigo: { contains: busca } }, { contratante: { nome: { contains: busca } } }, { contratoOrigem: { objeto: { contains: busca } } }] }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { contratante: true, responsavel: true, contratoOrigem: true, etapas: { orderBy: { ordem: "asc" } } },
  });
  const tiposProjeto = await prisma.tipoProjetoModelo.findMany();
  const tipoLabel = (chave: string) => tiposProjeto.find((t) => t.chave === chave)?.nome ?? chave;

  const hoje = new Date();
  const enriquecidos = todos.map((p) => {
    const atual = p.etapas.find((e) => e.status !== "CONCLUIDA") ?? p.etapas.at(-1);
    const concluidas = p.etapas.filter((e) => e.status === "CONCLUIDA").length;
    const finalizado = p.etapas.length > 0 && concluidas === p.etapas.length;
    const grupo: Filtro = finalizado ? "concluidos" : atual?.status === "AGUARDANDO_MUNICIPIO" ? "aguardando" : "andamento";
    return { p, atual, concluidas, finalizado, grupo };
  });
  const filtroAtivo = (["aguardando", "andamento", "concluidos"] as const).find((f) => f === filtro);
  const projetos = filtroAtivo ? enriquecidos.filter((e) => e.grupo === filtroAtivo) : enriquecidos;
  const contar = (f: Filtro) => enriquecidos.filter((e) => e.grupo === f).length;
  const qs = (f?: string) => {
    const p = new URLSearchParams();
    if (f) p.set("filtro", f);
    if (busca) p.set("q", busca);
    const s = p.toString();
    return `/projetos${s ? `?${s}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader
        eyebrow={isInterno ? "Portfólio técnico" : "Portal do município"}
        title={isInterno ? "Projetos" : "Meus projetos"}
        description={isInterno ? "Acompanhe a produção técnica, os responsáveis e as pendências de cada município." : "Consulte o andamento e veja o que precisa da sua atenção."}
      />

      {!isInterno && contar("aguardando") > 0 && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700"><BellAlertIcon className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-amber-900">
              {contar("aguardando") === 1 ? "1 projeto aguarda sua resposta" : `${contar("aguardando")} projetos aguardam sua resposta`}
            </p>
            <p className="text-xs text-amber-800/80">Abra o projeto para revisar documentos, responder formulários ou enviar arquivos.</p>
          </div>
          <Link href={qs("aguardando")} className="secondary-button shrink-0">Ver pendências</Link>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterPills
          options={[
            { label: "Todos", href: qs(), active: !filtroAtivo, count: enriquecidos.length },
            { label: isInterno ? "Aguardando município" : "Aguardando você", href: qs("aguardando"), active: filtroAtivo === "aguardando", count: contar("aguardando") },
            { label: "Em andamento", href: qs("andamento"), active: filtroAtivo === "andamento", count: contar("andamento") },
            { label: "Concluídos", href: qs("concluidos"), active: filtroAtivo === "concluidos", count: contar("concluidos") },
          ]}
        />
        <SearchBox defaultValue={busca} placeholder="Buscar projeto, código ou município" hidden={{ filtro: filtroAtivo }} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projetos.map(({ p: projeto, atual, concluidas, finalizado, grupo }) => {
          const diasVigencia = Math.ceil((projeto.dataVigencia.getTime() - hoje.getTime()) / 86_400_000);
          const suaVez = grupo === "aguardando";
          return (
            <Link
              key={projeto.id}
              href={`/projetos/${projeto.id}`}
              className={`surface-panel group flex flex-col p-5 transition hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-lg ${suaVez && !isInterno ? "ring-2 ring-amber-200" : ""}`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-700">{tipoLabel(projeto.tipo)}</span>
                <Badge tone={finalizado ? "emerald" : suaVez ? "amber" : "cyan"}>
                  {finalizado ? "Concluído" : suaVez && !isInterno ? "Aguardando você" : atual ? STATUS_ETAPA_LABEL[atual.status] : "Sem etapa"}
                </Badge>
              </div>

              <h2 className="mt-2 line-clamp-2 min-h-[2.75rem] text-[15px] font-bold leading-snug text-slate-950 group-hover:text-cyan-900">{projeto.contratoOrigem.objeto}</h2>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                <span className="font-semibold text-slate-600">{projeto.codigo}</span>
                <span className="text-slate-300">·</span>
                <BuildingLibraryIcon className="h-3.5 w-3.5" />
                <span className="truncate">{projeto.contratante.nome.replace(/^Prefeitura (Municipal )?de /, "")}</span>
              </p>

              <div className="mt-5">
                <div className="mb-2 flex items-baseline justify-between gap-2 text-xs">
                  <span className="truncate font-semibold text-slate-700">{finalizado ? "Todas as etapas concluídas" : atual?.nome ?? "Sem etapa"}</span>
                  <span className="shrink-0 text-slate-400">{concluidas}/{projeto.etapas.length} etapas</span>
                </div>
                <div className="flex gap-1">
                  {projeto.etapas.map((e) => (
                    <span
                      key={e.id}
                      title={`${e.nome} — ${STATUS_ETAPA_LABEL[e.status]}`}
                      className={`h-1.5 flex-1 rounded-full ${
                        e.status === "CONCLUIDA" ? "bg-emerald-400" : e.id === atual?.id ? (e.status === "AGUARDANDO_MUNICIPIO" ? "bg-amber-400" : "bg-cyan-500") : "bg-slate-200"
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4 text-xs">
                <span className="flex min-w-0 items-center gap-2 text-slate-600">
                  <Avatar name={projeto.responsavel.nome} size="sm" />
                  <span className="truncate">{projeto.responsavel.nome}</span>
                </span>
                <span
                  className={`flex shrink-0 items-center gap-1 ${diasVigencia < 0 ? "font-semibold text-red-600" : diasVigencia <= 60 ? "font-semibold text-amber-700" : "text-slate-500"}`}
                  title="Fim da vigência"
                >
                  <CalendarDaysIcon className="h-3.5 w-3.5" />
                  {formatarData(projeto.dataVigencia)}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
      {projetos.length === 0 && (
        <div className="surface-panel">
          <EmptyState
            title="Nenhum projeto encontrado"
            description={busca || filtroAtivo ? "Tente outro termo de busca ou limpe os filtros." : "Os projetos aparecerão aqui assim que forem criados a partir de um contrato."}
          />
        </div>
      )}
    </div>
  );
}
