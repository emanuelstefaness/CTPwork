import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/tenant";
import { marcarNotificacaoLida, marcarTodasNotificacoesLidas } from "@/lib/actions/notificacoes";
import { formatarRelativo } from "@/lib/formatters";
import { resolverLinks } from "@/lib/links-notificacao";
import { EmptyState, FilterPills, PageHeader } from "@/components/ui";
import {
  BellIcon,
  ChatBubbleLeftRightIcon,
  CheckIcon,
  ClockIcon,
  DocumentCheckIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  InboxArrowDownIcon,
} from "@heroicons/react/24/outline";

export const metadata: Metadata = { title: "Notificações" };

const estiloPorTipo: Record<string, { icon: typeof BellIcon; cor: string; rotulo: string }> = {
  ETAPA_AGUARDANDO_VOCE: { icon: InboxArrowDownIcon, cor: "bg-amber-50 text-amber-600", rotulo: "Aguardando você" },
  MUNICIPIO_RESPONDEU: { icon: ChatBubbleLeftRightIcon, cor: "bg-cyan-50 text-cyan-700", rotulo: "Resposta do município" },
  PRAZO_ESTOURADO: { icon: ExclamationTriangleIcon, cor: "bg-red-50 text-red-600", rotulo: "Prazo vencido" },
  VIGENCIA_ESTOURADA: { icon: ClockIcon, cor: "bg-red-50 text-red-600", rotulo: "Vigência vencida" },
  MEMORANDO_CIENCIA: { icon: EyeIcon, cor: "bg-violet-50 text-violet-600", rotulo: "Para ciência" },
  CTP_COMENTOU: { icon: ChatBubbleLeftRightIcon, cor: "bg-blue-50 text-blue-700", rotulo: "Comentário do CTP" },
  ASSINATURA_PENDENTE: { icon: DocumentCheckIcon, cor: "bg-emerald-50 text-emerald-600", rotulo: "Assinatura" },
  NOVA_MENSAGEM: { icon: ChatBubbleLeftRightIcon, cor: "bg-violet-50 text-violet-600", rotulo: "Conversa" },
};
const estiloPadrao = { icon: BellIcon, cor: "bg-slate-100 text-slate-500", rotulo: "Aviso" };

function grupoDaData(d: Date, agora: Date): string {
  const inicioHoje = new Date(agora);
  inicioHoje.setHours(0, 0, 0, 0);
  const dias = (inicioHoje.getTime() - d.getTime()) / 86_400_000;
  if (dias <= 0) return "Hoje";
  if (dias <= 1) return "Ontem";
  if (dias <= 7) return "Últimos 7 dias";
  return "Anteriores";
}

export default async function NotificacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string }>;
}) {
  const user = await requireSession();
  const { filtro } = await searchParams;
  const somenteNaoLidas = filtro === "nao_lidas";

  const todasNotificacoes = await prisma.notificacao.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const links = await resolverLinks(todasNotificacoes);

  const naoLidasCount = todasNotificacoes.filter((n) => !n.lida).length;
  const notificacoes = somenteNaoLidas ? todasNotificacoes.filter((n) => !n.lida) : todasNotificacoes;

  const agora = new Date();
  const grupos: { titulo: string; itens: typeof notificacoes }[] = [];
  for (const n of notificacoes) {
    const titulo = grupoDaData(n.createdAt, agora);
    const g = grupos.find((x) => x.titulo === titulo);
    if (g) g.itens.push(n);
    else grupos.push({ titulo, itens: [n] });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Notificações"
        description="Mudanças de etapa, respostas do município, prazos e marcações para você."
        actions={
          naoLidasCount > 0 ? (
            <form action={marcarTodasNotificacoesLidas}>
              <button className="secondary-button"><CheckIcon className="h-4 w-4" />Marcar todas como lidas</button>
            </form>
          ) : undefined
        }
      />

      <div className="mb-5">
        <FilterPills
          options={[
            { label: "Todas", href: "/notificacoes", active: !somenteNaoLidas, count: todasNotificacoes.length },
            { label: "Não lidas", href: "/notificacoes?filtro=nao_lidas", active: somenteNaoLidas, count: naoLidasCount },
          ]}
        />
      </div>

      {notificacoes.length === 0 ? (
        <div className="surface-panel">
          <EmptyState
            title={somenteNaoLidas ? "Tudo em dia" : "Nenhuma notificação ainda"}
            description={somenteNaoLidas ? "Você leu todas as notificações." : "Avisos sobre seus projetos, contratos e memorandos aparecerão aqui."}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {grupos.map((g) => (
            <section key={g.titulo}>
              <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{g.titulo}</h2>
              <ul className="surface-panel divide-y divide-slate-100">
                {g.itens.map((n) => {
                  const href = links.get(n.id) ?? "/notificacoes";
                  const estilo = estiloPorTipo[n.tipo] ?? estiloPadrao;
                  const Icone = estilo.icon;
                  return (
                    <li key={n.id} className={`relative flex items-start gap-3.5 px-5 py-4 transition-colors hover:bg-slate-50 ${n.lida ? "" : "bg-cyan-50/40"}`}>
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${estilo.cor}`}><Icone className="h-[18px] w-[18px]" /></span>
                      <div className="min-w-0 flex-1">
                        <Link href={href} className="after:absolute after:inset-0">
                          <p className={`text-sm leading-6 ${n.lida ? "text-slate-600" : "font-medium text-slate-900"}`}>{n.mensagem}</p>
                        </Link>
                        <p className="mt-0.5 text-xs text-slate-400" title={n.createdAt.toLocaleString("pt-BR")}>
                          {estilo.rotulo} · {formatarRelativo(n.createdAt, agora)}
                        </p>
                      </div>
                      {!n.lida && (
                        <form
                          action={async () => {
                            "use server";
                            await marcarNotificacaoLida(n.id);
                          }}
                          className="relative z-10 shrink-0"
                        >
                          <button className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-white hover:text-cyan-700 hover:shadow-sm" aria-label="Marcar como lida" title="Marcar como lida">
                            <CheckIcon className="h-4 w-4" />
                          </button>
                        </form>
                      )}
                      {!n.lida && <span className="absolute left-1.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-cyan-500" aria-hidden />}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
