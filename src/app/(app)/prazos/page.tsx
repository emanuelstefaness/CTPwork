import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireInterno } from "@/lib/tenant";
import { formatarData } from "@/lib/formatters";
import { Badge, PageHeader } from "@/components/ui";
import { CheckCircleIcon, ClockIcon, ExclamationTriangleIcon, FunnelIcon } from "@heroicons/react/24/outline";

type PrazoRow = {
  data: Date;
  tipo: string;
  descricao: string;
  responsavel: string;
  contratante: string;
  href: string;
};

type Urgencia = "vencido" | "atencao" | "no_prazo";

import { inicioDoDiaUTC } from "@/lib/prazos";

export const metadata: Metadata = { title: "Prazos" };

export default async function PrazosPage({
  searchParams,
}: {
  searchParams: Promise<{ responsavel?: string; contratante?: string; urgencia?: string }>;
}) {
  await requireInterno();
  const { responsavel, contratante, urgencia } = await searchParams;

  const [projetos, etapas, usuarios, municipios] = await Promise.all([
    prisma.projeto.findMany({
      include: { contratante: true, responsavel: true },
      where: {
        ...(responsavel ? { responsavelId: responsavel } : {}),
        ...(contratante ? { contratanteId: contratante } : {}),
      },
    }),
    prisma.etapaProjeto.findMany({
      where: {
        prazo: { not: null },
        status: { not: "CONCLUIDA" },
        ...(responsavel ? { responsavelId: responsavel } : {}),
      },
      include: { responsavel: true, projeto: { include: { contratante: true } } },
    }),
    prisma.user.findMany({ where: { tipo: "INTERNO" }, orderBy: { nome: "asc" } }),
    prisma.municipio.findMany({ orderBy: { nome: "asc" } }),
  ]);

  const linhas: PrazoRow[] = [
    ...projetos.map((p): PrazoRow => ({
      data: p.dataVigencia,
      tipo: "Vigência de projeto",
      descricao: p.codigo,
      responsavel: p.responsavel.nome,
      contratante: p.contratante.nome,
      href: `/projetos/${p.id}`,
    })),
    ...etapas
      .filter((e) => !contratante || e.projeto.contratanteId === contratante)
      .map((e): PrazoRow => ({
        data: e.prazo as Date,
        tipo: "Prazo de etapa",
        descricao: `${e.projeto.codigo} — ${e.nome}`,
        responsavel: e.responsavel.nome,
        contratante: e.projeto.contratante.nome,
        href: `/projetos/${e.projetoId}?etapa=${e.id}`,
      })),
  ].sort((a, b) => a.data.getTime() - b.data.getTime());

  const hoje = inicioDoDiaUTC();

  const linhasComUrgencia = linhas.map((l) => {
    const diasRestantes = Math.round((l.data.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
    const urgenciaLinha: Urgencia = diasRestantes < 0 ? "vencido" : diasRestantes <= 15 ? "atencao" : "no_prazo";
    return { ...l, diasRestantes, urgenciaLinha };
  });

  const contagens = {
    vencido: linhasComUrgencia.filter((l) => l.urgenciaLinha === "vencido").length,
    atencao: linhasComUrgencia.filter((l) => l.urgenciaLinha === "atencao").length,
    no_prazo: linhasComUrgencia.filter((l) => l.urgenciaLinha === "no_prazo").length,
  };

  const linhasFiltradas = urgencia && urgencia !== "todos" ? linhasComUrgencia.filter((l) => l.urgenciaLinha === urgencia) : linhasComUrgencia;

  const urgenciaHref = (valor: string) => {
    const params = new URLSearchParams();
    if (responsavel) params.set("responsavel", responsavel);
    if (contratante) params.set("contratante", contratante);
    if (valor !== "todos") params.set("urgencia", valor);
    const qs = params.toString();
    return qs ? `/prazos?${qs}` : "/prazos";
  };

  const filtros: { valor: string; label: string }[] = [
    { valor: "todos", label: `Todos (${linhasComUrgencia.length})` },
    { valor: "vencido", label: `Vencido (${contagens.vencido})` },
    { valor: "atencao", label: `Atenção (${contagens.atencao})` },
    { valor: "no_prazo", label: `No prazo (${contagens.no_prazo})` },
  ];
  const filtroAtivo = urgencia && ["vencido", "atencao", "no_prazo"].includes(urgencia) ? urgencia : "todos";

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader eyebrow="Planejamento" title="Prazos consolidados" description="Todos os vencimentos de projetos e etapas, ordenados por prioridade." />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <div className="surface-panel flex items-center justify-between border-l-4 border-l-red-400 p-5">
          <div>
            <p className="text-xs font-semibold text-slate-500">Vencidos</p>
            <p className="mt-1 text-2xl font-bold text-red-600">{contagens.vencido} {contagens.vencido === 1 ? "prazo" : "prazos"}</p>
          </div>
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-red-50 text-red-600"><ExclamationTriangleIcon className="h-5 w-5" /></span>
        </div>
        <div className="surface-panel flex items-center justify-between border-l-4 border-l-amber-400 p-5">
          <div>
            <p className="text-xs font-semibold text-slate-500">Vencem em até 15 dias</p>
            <p className="mt-1 text-2xl font-bold text-amber-600">{contagens.atencao} {contagens.atencao === 1 ? "prazo" : "prazos"}</p>
          </div>
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600"><ClockIcon className="h-5 w-5" /></span>
        </div>
        <div className="surface-panel flex items-center justify-between border-l-4 border-l-emerald-400 p-5">
          <div>
            <p className="text-xs font-semibold text-slate-500">No prazo</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">{contagens.no_prazo} {contagens.no_prazo === 1 ? "prazo" : "prazos"}</p>
          </div>
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><CheckCircleIcon className="h-5 w-5" /></span>
        </div>
      </div>

      <form className="surface-panel mb-5 flex flex-col gap-3 p-4 sm:flex-row">
        <select aria-label="Responsável" name="responsavel" defaultValue={responsavel ?? ""} className="form-control sm:max-w-xs">
          <option value="">Todos os responsáveis</option>
          {usuarios.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nome}
            </option>
          ))}
        </select>
        <select aria-label="Contratante" name="contratante" defaultValue={contratante ?? ""} className="form-control sm:max-w-xs">
          <option value="">Todos os contratantes</option>
          {municipios.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome}
            </option>
          ))}
        </select>
        {urgencia && <input type="hidden" name="urgencia" value={urgencia} />}
        <button className="primary-button"><FunnelIcon className="h-4 w-4" />Filtrar</button>
      </form>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-500">Filtrar urgência:</span>
        {filtros.map((f) => (
          <Link
            key={f.valor}
            href={urgenciaHref(f.valor)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              filtroAtivo === f.valor ? "bg-cyan-700 text-white" : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="surface-panel overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Descrição</th>
              <th className="px-4 py-3">Contratante</th>
              <th className="px-4 py-3">Responsável</th>
              <th className="px-4 py-3">Dias restantes</th>
              <th className="px-4 py-3">Situação</th>
            </tr>
          </thead>
          <tbody>
            {linhasFiltradas.map((l, i) => (
              <tr key={i}>
                <td className={`font-semibold ${l.urgenciaLinha === "vencido" ? "text-red-600" : "text-slate-900"}`}>
                  {formatarData(l.data)}
                </td>
                <td className="text-slate-500">{l.tipo}</td>
                <td>
                  <Link href={l.href} className="font-medium text-cyan-800 hover:text-cyan-950">
                    {l.descricao}
                  </Link>
                </td>
                <td className="text-slate-500">{l.contratante}</td>
                <td className="text-slate-500">{l.responsavel}</td>
                <td className={`font-semibold ${l.urgenciaLinha === "vencido" ? "text-red-600" : l.urgenciaLinha === "atencao" ? "text-amber-600" : "text-emerald-600"}`}>
                  {l.diasRestantes < 0 ? `${-l.diasRestantes} ${l.diasRestantes === -1 ? "dia" : "dias"} de atraso` : l.diasRestantes === 0 ? "Vence hoje" : l.diasRestantes === 1 ? "Amanhã" : `${l.diasRestantes} dias`}
                </td>
                <td><Badge tone={l.urgenciaLinha === "vencido" ? "red" : l.urgenciaLinha === "atencao" ? "amber" : "emerald"}>{l.urgenciaLinha === "vencido" ? "Vencido" : l.urgenciaLinha === "atencao" ? "Atenção" : "No prazo"}</Badge></td>
              </tr>
            ))}
            {linhasFiltradas.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  Nenhum prazo encontrado para este filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
