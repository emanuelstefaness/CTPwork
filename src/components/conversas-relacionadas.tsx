import Link from "next/link";
import { ChatBubbleLeftRightIcon, PlusIcon } from "@heroicons/react/24/outline";
import { prisma } from "@/lib/prisma";
import type { SessaoAtual } from "@/lib/tenant";
import { estaNaoLida, incluirEstadoLeitura } from "@/lib/conversas";
import { formatarRelativo } from "@/lib/formatters";
import { Panel } from "@/components/ui";

/** Conversas gerais que citam este contrato/projeto, com atalho para abrir uma nova já vinculada. */
export async function ConversasRelacionadas({ user, contratoId, projetoId }: { user: SessaoAtual; contratoId?: string; projetoId?: string }) {
  const conversas = await prisma.conversa.findMany({
    where: projetoId ? { projetoId } : { contratoId },
    orderBy: { ultimaMensagemEm: "desc" },
    take: 5,
    include: incluirEstadoLeitura(user.id),
  });
  const novaHref = projetoId ? `/conversas/nova?projeto=${projetoId}` : `/conversas/nova?contrato=${contratoId}`;

  return (
    <Panel
      title="Conversas"
      description={conversas.length ? undefined : "Assuntos gerais com o município, fora das etapas."}
      action={<Link href={novaHref} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-cyan-700 hover:bg-cyan-50"><PlusIcon className="h-3.5 w-3.5" />Nova</Link>}
    >
      {conversas.length === 0 ? (
        <Link href={novaHref} className="flex items-center gap-2.5 px-5 py-4 text-xs text-slate-500 hover:bg-slate-50">
          <ChatBubbleLeftRightIcon className="h-5 w-5 text-slate-300" />
          Nenhuma conversa ainda. Iniciar uma?
        </Link>
      ) : (
        <ul className="divide-y divide-slate-100">
          {conversas.map((c) => {
            const naoLida = estaNaoLida(c, user);
            return (
              <li key={c.id}>
                <Link href={`/conversas/${c.id}`} className="flex items-start gap-2.5 px-5 py-3 hover:bg-slate-50">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${naoLida ? "bg-cyan-500" : c.status === "ENCERRADA" ? "bg-slate-200" : "bg-emerald-400"}`} />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm ${naoLida ? "font-bold text-slate-900" : "font-medium text-slate-700"}`}>{c.assunto}</span>
                    <span className="block text-[11px] text-slate-400">{c.status === "ENCERRADA" ? "Encerrada · " : ""}{formatarRelativo(c.ultimaMensagemEm)}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
