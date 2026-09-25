import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/tenant";
import { estaNaoLida, filtroVisibilidade, incluirEstadoLeitura } from "@/lib/conversas";
import { formatarRelativo } from "@/lib/formatters";
import { Avatar, EmptyState, FilterPills, PageHeader, SearchBox } from "@/components/ui";
import { ChatBubbleLeftRightIcon, ChevronRightIcon, LinkIcon, PaperClipIcon, PlusIcon } from "@heroicons/react/24/outline";

export const metadata: Metadata = { title: "Conversas" };

const FILTROS = ["aguardando", "abertas", "encerradas", "todas"] as const;
type Filtro = (typeof FILTROS)[number];

export default async function ConversasPage({ searchParams }: { searchParams: Promise<{ filtro?: string; q?: string }> }) {
  const user = await requireSession();
  const isInterno = user.tipo === "INTERNO";
  const { filtro: filtroBruto, q } = await searchParams;
  const filtro: Filtro = FILTROS.includes(filtroBruto as Filtro) ? (filtroBruto as Filtro) : "abertas";
  const busca = q?.trim() ?? "";

  const conversas = await prisma.conversa.findMany({
    where: {
      ...filtroVisibilidade(user),
      ...(busca ? { OR: [{ assunto: { contains: busca } }, { municipio: { nome: { contains: busca } } }] } : {}),
    },
    orderBy: { ultimaMensagemEm: "desc" },
    include: {
      municipio: { select: { nome: true } },
      contrato: { select: { codigo: true } },
      projeto: { select: { codigo: true } },
      _count: { select: { mensagens: true } },
      ...incluirEstadoLeitura(user.id),
    },
    take: 200,
  });

  // "Aguardando" = a última palavra foi do outro lado: é a vez de quem está olhando responder.
  const aguardando = (c: (typeof conversas)[number]) => c.status === "ABERTA" && !!c.mensagens[0] && c.mensagens[0].autor.tipo !== user.tipo;
  const contagem: Record<Filtro, number> = {
    aguardando: conversas.filter(aguardando).length,
    abertas: conversas.filter((c) => c.status === "ABERTA").length,
    encerradas: conversas.filter((c) => c.status === "ENCERRADA").length,
    todas: conversas.length,
  };
  const visiveis = conversas.filter((c) =>
    filtro === "aguardando" ? aguardando(c) : filtro === "abertas" ? c.status === "ABERTA" : filtro === "encerradas" ? c.status === "ENCERRADA" : true,
  );

  const qs = (f: Filtro) => {
    const p = new URLSearchParams();
    if (f !== "abertas") p.set("filtro", f);
    if (busca) p.set("q", busca);
    const s = p.toString();
    return `/conversas${s ? `?${s}` : ""}`;
  };
  const rotulos: Record<Filtro, string> = {
    aguardando: isInterno ? "Aguardando o CTP" : "Aguardando você",
    abertas: "Abertas",
    encerradas: "Encerradas",
    todas: "Todas",
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow={isInterno ? "Relacionamento" : undefined}
        title="Conversas"
        description={
          isInterno
            ? "Assuntos com os municípios que não pertencem a uma etapa: dúvidas sobre contrato, reuniões, pedidos e ofícios."
            : "Fale com a equipe do CTP sobre qualquer assunto: dúvidas, reuniões, pedidos. Assuntos de uma etapa específica ficam no chat da etapa."
        }
        actions={<Link href="/conversas/nova" className="primary-button"><PlusIcon className="h-4 w-4" />Nova conversa</Link>}
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterPills options={FILTROS.map((f) => ({ label: rotulos[f], href: qs(f), active: filtro === f, count: contagem[f] }))} />
        <SearchBox defaultValue={busca} placeholder={isInterno ? "Buscar por assunto ou município" : "Buscar por assunto"} hidden={{ filtro: filtro === "abertas" ? undefined : filtro }} />
      </div>

      <div className="surface-panel overflow-hidden">
        {visiveis.length === 0 ? (
          <div className="py-4">
            <span className="mx-auto mt-6 grid h-12 w-12 place-items-center rounded-2xl bg-cyan-50 text-cyan-700"><ChatBubbleLeftRightIcon className="h-6 w-6" /></span>
            <EmptyState
              title={busca ? "Nenhuma conversa encontrada" : filtro === "aguardando" ? "Nada aguardando resposta" : filtro === "encerradas" ? "Nenhuma conversa encerrada" : "Nenhuma conversa ainda"}
              description={busca ? "Tente outro termo de busca." : "Comece uma conversa pelo botão “Nova conversa”."}
            />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {visiveis.map((c) => {
              const ultima = c.mensagens[0];
              const naoLida = estaNaoLida(c, user);
              return (
                <li key={c.id} className={`group relative flex gap-3.5 px-4 py-4 transition-colors hover:bg-slate-50 sm:px-5 ${naoLida ? "bg-cyan-50/40" : ""}`}>
                  {naoLida && <span className="absolute left-1.5 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-cyan-500" aria-label="Não lida" />}
                  <Avatar name={isInterno ? c.municipio.nome : ultima?.autor.nome ?? c.assunto} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <Link href={`/conversas/${c.id}`} className={`truncate text-sm after:absolute after:inset-0 ${naoLida ? "font-bold text-slate-950" : "font-semibold text-slate-800"}`}>
                        {c.assunto}
                      </Link>
                      <time className="shrink-0 text-[11px] text-slate-400" title={c.ultimaMensagemEm.toLocaleString("pt-BR")}>{formatarRelativo(c.ultimaMensagemEm)}</time>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
                      {isInterno && <span className="font-medium text-slate-600">{c.municipio.nome}</span>}
                      {(c.projeto || c.contrato) && (
                        <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-px font-semibold text-slate-600">
                          <LinkIcon className="h-3 w-3" />{c.projeto?.codigo ?? c.contrato?.codigo}
                        </span>
                      )}
                      {c.status === "ENCERRADA" && <span className="rounded bg-slate-100 px-1.5 py-px font-semibold text-slate-500">Encerrada</span>}
                      <span className="text-slate-400">{c._count.mensagens} mensage{c._count.mensagens === 1 ? "m" : "ns"}</span>
                    </div>
                    {ultima && (
                      <p className={`mt-1.5 line-clamp-1 text-[13px] ${naoLida ? "text-slate-800" : "text-slate-500"}`}>
                        <span className="font-medium">{ultima.autor.tipo === user.tipo && ultima.autorId === user.id ? "Você" : ultima.autor.nome.split(" ")[0]}{ultima.autor.tipo === "INTERNO" && !isInterno ? " (CTP)" : ""}:</span>{" "}
                        {ultima.anexoId && <PaperClipIcon className="-mt-0.5 mr-0.5 inline h-3.5 w-3.5" />}
                        {ultima.texto}
                      </p>
                    )}
                  </div>
                  <ChevronRightIcon className="mt-3 h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-cyan-600" />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
