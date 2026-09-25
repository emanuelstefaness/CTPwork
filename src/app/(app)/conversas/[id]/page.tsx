import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession, assertAcessoContratante } from "@/lib/tenant";
import { formatarDataHora, formatarDiaDoEvento } from "@/lib/formatters";
import { Avatar, BackLink, Badge, DetailList, Panel } from "@/components/ui";
import { ArrowTopRightOnSquareIcon, DocumentArrowDownIcon } from "@heroicons/react/24/outline";
import { RespostaConversa, StatusConversa, AtualizacaoAutomatica, RolarParaFim } from "./componentes";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const c = await prisma.conversa.findUnique({ where: { id }, select: { assunto: true } });
  return { title: c?.assunto ?? "Conversa" };
}

/** "Hoje", "Ontem" ou a data — sempre no fuso de Brasília, mesmo com o servidor em UTC. */
function rotuloDia(d: Date) {
  const dia = (x: Date) => x.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const agora = Date.now();
  if (dia(d) === dia(new Date(agora))) return "Hoje";
  if (dia(d) === dia(new Date(agora - 86_400_000))) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });
}

export default async function ConversaPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireSession();
  const { id } = await params;
  const conversa = await prisma.conversa.findUnique({
    where: { id },
    include: {
      municipio: true,
      contrato: { select: { id: true, codigo: true, objeto: true } },
      projeto: { select: { id: true, codigo: true } },
      criadoPor: { select: { nome: true, tipo: true } },
      mensagens: { orderBy: { createdAt: "asc" }, include: { autor: { select: { id: true, nome: true, tipo: true } }, anexo: true } },
    },
  });
  if (!conversa) notFound();
  try {
    assertAcessoContratante(user, conversa.municipioId);
  } catch {
    notFound();
  }

  // Abrir a conversa = ler: atualiza a marca de leitura e apaga os avisos dela no sino.
  const agora = new Date();
  await prisma.$transaction([
    prisma.leituraConversa.upsert({
      where: { conversaId_userId: { conversaId: id, userId: user.id } },
      update: { lidoEm: agora },
      create: { conversaId: id, userId: user.id, lidoEm: agora },
    }),
    prisma.notificacao.updateMany({ where: { userId: user.id, entidadeTipo: "Conversa", entidadeId: id, lida: false }, data: { lida: true } }),
  ]);

  const isInterno = user.tipo === "INTERNO";
  const encerrada = conversa.status === "ENCERRADA";
  const participantes = [...new Map(conversa.mensagens.map((m) => [m.autor.id, m.autor])).values()];
  const vinculo = conversa.projeto
    ? { href: `/projetos/${conversa.projeto.id}`, rotulo: conversa.projeto.codigo }
    : conversa.contrato
      ? { href: `/contratos/${conversa.contrato.id}`, rotulo: conversa.contrato.codigo }
      : null;

  return (
    <div className="mx-auto max-w-[1200px]">
      <AtualizacaoAutomatica />
      <BackLink href="/conversas" label="Conversas" />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">{conversa.assunto}</h1>
            <Badge tone={encerrada ? "slate" : "emerald"}>{encerrada ? "Encerrada" : "Aberta"}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {isInterno ? conversa.municipio.nome : "Conversa com a equipe do CTP"}
            {vinculo && <> · <Link href={vinculo.href} className="font-semibold text-cyan-700 hover:underline">{vinculo.rotulo}</Link></>}
          </p>
        </div>
        <StatusConversa conversaId={id} encerrada={encerrada} />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="surface-panel flex min-h-[60vh] flex-col overflow-hidden">
          <RolarParaFim total={conversa.mensagens.length} className="flex-1 space-y-4 overflow-y-auto bg-slate-50/60 px-4 py-5 sm:px-6 lg:max-h-[calc(100vh-18rem)]">
            {conversa.mensagens.map((m, i) => {
              const meuLado = m.autor.tipo === user.tipo;
              const dia = rotuloDia(m.createdAt);
              const separador = i === 0 || dia !== rotuloDia(conversa.mensagens[i - 1].createdAt);
              return (
                <div key={m.id}>
                  {separador && (
                    <div className="my-4 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      <span className="h-px flex-1 bg-slate-200" />{dia}<span className="h-px flex-1 bg-slate-200" />
                    </div>
                  )}
                  <div className={`flex gap-2.5 ${meuLado ? "flex-row-reverse" : ""}`}>
                    <Avatar name={m.autor.nome} />
                    <div className={`flex max-w-[85%] flex-col sm:max-w-[75%] ${meuLado ? "items-end" : "items-start"}`}>
                      <p className="mb-1 flex items-center gap-1.5 text-[11px] text-slate-500">
                        <span className="font-semibold text-slate-700">{m.autor.id === user.id ? "Você" : m.autor.nome}</span>
                        <span className={`rounded px-1 py-px text-[9px] font-semibold ${m.autor.tipo === "INTERNO" ? "bg-cyan-50 text-cyan-700" : "bg-violet-50 text-violet-700"}`}>
                          {m.autor.tipo === "INTERNO" ? "CTP" : conversa.municipio.nome}
                        </span>
                        <time title={formatarDataHora(m.createdAt)}>{m.createdAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}</time>
                      </p>
                      <div className={`rounded-2xl px-4 py-2.5 text-sm leading-6 shadow-sm ${meuLado ? "rounded-tr-sm bg-cyan-700 text-white" : "rounded-tl-sm bg-white text-slate-800 ring-1 ring-slate-200"}`}>
                        {m.texto !== "(arquivo anexado)" && <p className="whitespace-pre-wrap break-words">{m.texto}</p>}
                        {m.anexo && (
                          <a
                            href={m.anexo.caminho}
                            target="_blank"
                            rel="noopener"
                            className={`mt-1.5 flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold ${meuLado ? "bg-white/15 text-white hover:bg-white/25" : "bg-slate-50 text-cyan-800 ring-1 ring-slate-200 hover:bg-cyan-50"}`}
                          >
                            <DocumentArrowDownIcon className="h-4 w-4 shrink-0" />
                            <span className="truncate">{m.anexo.nomeOriginal}</span>
                            <span className="shrink-0 font-normal opacity-70">{Math.max(1, Math.round(m.anexo.tamanho / 1024))} KB</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </RolarParaFim>
          <RespostaConversa conversaId={id} encerrada={encerrada} destino={isInterno ? conversa.municipio.nome : "a equipe do CTP"} />
        </section>

        <aside className="space-y-5">
          <Panel title="Detalhes">
            <DetailList
              items={[
                { label: "Município", value: conversa.municipio.nome },
                { label: "Iniciada por", value: `${conversa.criadoPor.nome}${conversa.criadoPor.tipo === "INTERNO" ? " (CTP)" : ""}` },
                { label: "Em", value: formatarDiaDoEvento(conversa.createdAt) },
                { label: "Mensagens", value: conversa.mensagens.length },
                ...(vinculo
                  ? [{ label: conversa.projeto ? "Projeto" : "Contrato", value: <Link href={vinculo.href} className="inline-flex items-center gap-1 text-cyan-700 hover:underline">{vinculo.rotulo}<ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" /></Link> }]
                  : []),
              ]}
            />
          </Panel>
          <Panel title="Participantes">
            <ul className="space-y-3 px-5 py-4">
              {participantes.map((p) => (
                <li key={p.id} className="flex items-center gap-2.5">
                  <Avatar name={p.nome} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{p.nome}</span>
                  <span className={`rounded px-1.5 py-px text-[10px] font-semibold ${p.tipo === "INTERNO" ? "bg-cyan-50 text-cyan-700" : "bg-violet-50 text-violet-700"}`}>{p.tipo === "INTERNO" ? "CTP" : "Município"}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
