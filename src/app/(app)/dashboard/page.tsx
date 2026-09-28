import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirPermissao } from "@/lib/tenant";
import { STATUS_ETAPA_LABEL } from "@/lib/constants";
import { garantirEtapasDosContratos, progressoDoContrato } from "@/lib/fluxo-contrato";
import { ENTIDADE_LABEL, formatarData, formatarRelativo } from "@/lib/formatters";
import type { Metadata } from "next";
import { inicioDoDiaUTC } from "@/lib/prazos";
import { ContractsDonut, ProjectsBarChart } from "@/components/dashboard-charts";
import { Avatar, Badge, PageHeader, Panel } from "@/components/ui";
import {
  BellAlertIcon,
  BriefcaseIcon,
  DocumentCheckIcon,
  FolderOpenIcon,
} from "@heroicons/react/24/outline";

export const metadata: Metadata = { title: "Visão geral" };

const auditLabels: Record<string, string> = {
  CRIAR: "Novo registro criado",
  CRIAR_PROJETO: "Projeto criado",
  CRIAR_FLUXO_ASSINATURA: "Fluxo de assinatura criado",
  ENVIAR_MINUTA: "Minuta enviada",
  ASSINAR: "Assinatura realizada",
  REVISAR_APROVADO: "Documento aprovado",
  REVISAR_REPROVADO: "Revisão solicitada",
  MUDAR_STATUS_ETAPA: "Etapa atualizada",
  AVANCAR_ETAPA: "Etapa avançada",
  RENOMEAR: "Registro renomeado",
  ATUALIZAR: "Registro atualizado",
  REMOVER: "Registro removido",
  REORDENAR: "Ordem atualizada",
  RESPONDER_FORMULARIO: "Formulário respondido",
  ENVIAR_CHECKLIST: "Item de checklist enviado",
  APROVAR_CHECKLIST: "Item de checklist aprovado",
  COMENTAR_TRECHO: "Comentário adicionado",
  RESOLVER_COMENTARIO: "Comentário resolvido",
  CONCLUIR_ETAPA: "Etapa concluída",
  REABRIR_ETAPA: "Etapa reaberta",
  INICIAR_EXECUCAO: "Execução iniciada",
  CONCLUIR: "Concluído",
  CANCELAR: "Cancelado",
  CONFIRMAR_VISUALIZACAO: "Documento visualizado",
  CRIAR_RASCUNHO: "Nova versão em edição",
  DESCARTAR_RASCUNHO: "Rascunho descartado",
  RESPONDER_ANOTACAO: "Resposta a comentário",
  REABRIR_COMENTARIO: "Comentário reaberto",
  ACEITAR_SUGESTAO: "Sugestão de redação aceita",
  RECUSAR_SUGESTAO: "Sugestão de redação recusada",
  INICIAR_CONVERSA: "Conversa iniciada",
  ENCERRAR_CONVERSA: "Conversa encerrada",
  REABRIR_CONVERSA: "Conversa reaberta",
  DESATIVAR_USUARIO: "Acesso de usuário desativado",
  REATIVAR_USUARIO: "Acesso de usuário reativado",
};

function Kpi({ title, value, detail, tone, icon: Icon }: { title: string; value: number; detail: string; tone: string; icon: typeof BriefcaseIcon }) {
  return (
    <div className="surface-panel p-5">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-xs font-semibold text-slate-500">{title}</p><p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{value}</p></div>
        <span className={`grid h-11 w-11 place-items-center rounded-xl ${tone}`}><Icon className="h-5 w-5" /></span>
      </div>
      <p className="mt-3 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

export default async function DashboardPage() {
  await exigirPermissao("painel");

  await garantirEtapasDosContratos((await prisma.contrato.findMany({ where: { etapas: { none: {} } }, select: { id: true } })).map((c) => c.id));
  const now = new Date();
  const criticalLimit = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 15);
  const [etapasPorStatus, contratosPorEtapa, projetosAtivos, memorandosAbertos, assinaturasPendentes, prazos, atividades, criticos] = await Promise.all([
    prisma.etapaProjeto.groupBy({ by: ["status"], _count: true }),
    // Etapa atual de cada contrato, com a posição dela no fluxo do próprio contrato.
    prisma.contrato.findMany({ select: { etapaAtual: true, etapas: { select: { chave: true, curto: true, ordem: true, exigeAssinaturas: true, liberaProjeto: true }, orderBy: { ordem: "asc" } } } }),
    prisma.projeto.count(),
    prisma.memorando.count({ where: { status: { in: ["ABERTO", "EM_EXECUCAO"] } } }),
    prisma.signatario.count({ where: { status: "PENDENTE" } }),
    prisma.etapaProjeto.findMany({
      where: { prazo: { not: null }, status: { not: "CONCLUIDA" } },
      include: { projeto: { include: { contratante: true } }, responsavel: true },
      orderBy: { prazo: "asc" }, take: 5,
    }),
    prisma.auditLog.findMany({ include: { user: true }, orderBy: { createdAt: "desc" }, take: 6 }),
    prisma.etapaProjeto.count({ where: { prazo: { not: null, lte: criticalLimit }, status: { not: "CONCLUIDA" } } }),
  ]);

  const emAndamento = etapasPorStatus.find((e) => e.status === "EM_ANDAMENTO")?._count ?? 0;
  const aguardando = etapasPorStatus.find((e) => e.status === "AGUARDANDO_MUNICIPIO")?._count ?? 0;
  const corStatus: Record<string, string> = { NAO_INICIADA: "#cbd5e1", EM_ANDAMENTO: "#06b6d4", AGUARDANDO_MUNICIPIO: "#f59e0b", CONCLUIDA: "#10b981" };
  const barData = ["NAO_INICIADA", "EM_ANDAMENTO", "AGUARDANDO_MUNICIPIO", "CONCLUIDA"].map((status) => ({
    name: STATUS_ETAPA_LABEL[status], value: etapasPorStatus.find((e) => e.status === status)?._count ?? 0, color: corStatus[status],
  }));
  // Fluxos diferentes têm etapas diferentes: agrupa pelo nome curto da etapa atual, na ordem em que
  // aparecem nos fluxos; concluídos em verde, em assinatura em âmbar, demais em tons de azul.
  const porEtapa = new Map<string, { value: number; ordem: number; situacao: string }>();
  for (const c of contratosPorEtapa) {
    const p = progressoDoContrato(c.etapas, c.etapaAtual);
    if (!p.atual) continue;
    const item = porEtapa.get(p.atual.curto) ?? { value: 0, ordem: p.indice, situacao: p.situacao };
    item.value++;
    porEtapa.set(p.atual.curto, item);
  }
  const azuis = ["#cbd5e1", "#93c5fd", "#3b82f6", "#06b6d4", "#0891b2", "#6366f1"];
  const donutData = [...porEtapa.entries()]
    .sort((a, b) => a[1].ordem - b[1].ordem)
    .map(([name, d], i) => ({ name, value: d.value, color: d.situacao === "concluido" ? "#10b981" : d.situacao === "assinatura" ? "#f59e0b" : azuis[i % azuis.length] }));

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader title="Visão geral" description="Acompanhe contratos, projetos e demandas dos municípios em tempo real."  />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi title="Projetos ativos" value={projetosAtivos} detail={emAndamento === 1 ? "1 etapa em execução agora" : `${emAndamento} etapas em execução agora`} tone="bg-emerald-50 text-emerald-600" icon={FolderOpenIcon} />
        <Kpi title="Aguardando município" value={aguardando} detail="Etapas esperando resposta do município" tone="bg-blue-50 text-blue-600" icon={BriefcaseIcon} />
        <Kpi title="Assinaturas pendentes" value={assinaturasPendentes} detail="Em memorandos e contratos" tone="bg-cyan-50 text-cyan-600" icon={DocumentCheckIcon} />
        <Kpi title="Prazos críticos" value={criticos} detail="Vencidos ou vencendo em 15 dias" tone="bg-red-50 text-red-600" icon={BellAlertIcon} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <Panel title="Projetos por etapa" description="Distribuição das etapas em todos os projetos ativos"><div className="px-4 py-4"><ProjectsBarChart data={barData} /></div></Panel>
        <Panel title="Contratos por status" description="Posição atual dos fluxos contratuais"><div className="px-5 py-3"><ContractsDonut data={donutData.length ? donutData : [{ name: "Sem contratos", value: 0 }]} /></div></Panel>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.45fr_0.85fr]">
        <Panel title="Próximos prazos" description="Itens que exigem atenção da equipe" action={<Link href="/prazos" className="text-xs font-semibold text-cyan-700 hover:text-cyan-900">Ver todos</Link>}>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Prazo</th><th>Projeto</th><th>Município</th><th>Responsável</th><th>Status</th></tr></thead>
              <tbody>
                {prazos.map((item) => { const overdue = !!item.prazo && item.prazo < inicioDoDiaUTC(now); const critical = !!item.prazo && item.prazo <= criticalLimit; return (
                  <tr key={item.id}>
                    <td className="font-semibold text-slate-900">{formatarData(item.prazo!)}</td>
                    <td><Link href={`/projetos/${item.projetoId}?etapa=${item.id}`} className="font-medium text-slate-700 hover:text-cyan-700">{item.projeto.codigo}<span className="block text-[11px] font-normal text-slate-400">{item.nome}</span></Link></td>
                    <td className="text-slate-500">{item.projeto.contratante.nome}</td>
                    <td className="text-slate-500">{item.responsavel.nome}</td>
                    <td><Badge tone={overdue ? "red" : critical ? "amber" : "emerald"}>{overdue ? "Vencido" : critical ? "Atenção" : "No prazo"}</Badge></td>
                  </tr>
                ); })}
                {prazos.length === 0 && <tr><td colSpan={5} className="py-10 text-center text-slate-400">Nenhum prazo pendente.</td></tr>}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Atividades recentes" description={`${memorandosAbertos} memorandos ainda abertos`}>
          <div className="divide-y divide-slate-100 px-5">
            {atividades.map((item) => (
              <div key={item.id} className="flex gap-3 py-3.5">
                <Avatar name={item.user.nome} />
                <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-slate-800">{auditLabels[item.acao] ?? item.acao.replaceAll("_", " ").toLowerCase().replace(/^./, (c) => c.toUpperCase())}</p><p className="mt-0.5 truncate text-[11px] text-slate-400">{item.user.nome} · {ENTIDADE_LABEL[item.entidadeTipo] ?? item.entidadeTipo} · {formatarRelativo(item.createdAt)}</p></div>
              </div>
            ))}
            {atividades.length === 0 && <p className="py-10 text-center text-sm text-slate-400">Nenhuma atividade recente.</p>}
          </div>
        </Panel>
      </div>
    </div>
  );
}
