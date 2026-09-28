import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireInterno } from "@/lib/tenant";
import { pode } from "@/lib/permissoes";
import { STATUS_MEMORANDO_LABEL } from "@/lib/constants";
import { formatarDataHora, formatarRelativo } from "@/lib/formatters";
import { Avatar, BackLink, Badge, DetailList, Panel } from "@/components/ui";
import {
  assinarMemorandoSeguro, cancelarMemorandoSeguro, concluirMemorandoSeguro, iniciarExecucaoMemorandoSeguro,
} from "@/lib/actions/formularios";
import { FormSeguro } from "@/components/form-seguro";
import { CheckIcon, ClockIcon, PencilSquareIcon } from "@heroicons/react/24/outline";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Memorando" };

const statusTone: Record<string, "blue" | "amber" | "emerald" | "slate"> = {
  ABERTO: "blue",
  EM_EXECUCAO: "amber",
  CONCLUIDO: "emerald",
  CANCELADO: "slate",
};

export default async function MemorandoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireInterno();

  const memorando = await prisma.memorando.findUnique({
    where: { id },
    include: {
      setores: { include: { setor: true } },
      ac: true,
      criadoPor: true,
      modelo: true,
      fluxoAssinatura: { include: { signatarios: { include: { user: true }, orderBy: { createdAt: "asc" } } } },
      marcadosCiencia: { include: { user: true } },
    },
  });
  if (!memorando) notFound();

  const camposModelo = memorando.camposModelo ? (JSON.parse(memorando.camposModelo) as Record<string, string>) : null;
  const rotulosModelo = memorando.modelo
    ? Object.fromEntries((JSON.parse(memorando.modelo.campos) as { chave: string; label?: string }[]).map((c) => [c.chave, c.label ?? c.chave]))
    : {};
  const podeExecutar = memorando.acUserId === user.id || memorando.setores.some((s) => s.setorId === user.setorId);
  const podeCancelar = memorando.criadoPorId === user.id || pode(user, "memorando.gerenciar");
  const meuSignatario = memorando.fluxoAssinatura?.signatarios.find((s) => s.userId === user.id);
  const signatarios = memorando.fluxoAssinatura?.signatarios ?? [];
  const assinados = signatarios.filter((s) => s.status === "ASSINADO").length;
  const assinaturaPendente = !!memorando.fluxoAssinatura && !memorando.fluxoAssinatura.concluido;
  const ativo = memorando.status !== "CONCLUIDO" && memorando.status !== "CANCELADO";

  return (
    <div className="mx-auto max-w-6xl">
      <BackLink href="/memorandos" label="Memorandos" />

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold tracking-wide text-cyan-700">{memorando.codigo}</span>
            <Badge tone={statusTone[memorando.status] ?? "slate"}>{STATUS_MEMORANDO_LABEL[memorando.status]}</Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{memorando.assunto}</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Enviado por {memorando.criadoPor.nome} · {formatarRelativo(memorando.createdAt)}
          </p>
        </div>

        {ativo && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {memorando.status !== "CANCELADO" && podeCancelar && (
              <FormSeguro acao={cancelarMemorandoSeguro}>
                <input type="hidden" name="memorandoId" value={memorando.id} />
                <button className="secondary-button">Cancelar memorando</button>
              </FormSeguro>
            )}
            {memorando.status === "ABERTO" && podeExecutar && (
              <FormSeguro acao={iniciarExecucaoMemorandoSeguro}>
                <input type="hidden" name="memorandoId" value={memorando.id} />
                <button className="primary-button">Iniciar execução</button>
              </FormSeguro>
            )}
            {memorando.status === "EM_EXECUCAO" && (
              <FormSeguro acao={concluirMemorandoSeguro}>
                <input type="hidden" name="memorandoId" value={memorando.id} />
                <button
                  className="primary-button"
                  disabled={assinaturaPendente}
                  title={assinaturaPendente ? "Todos os signatários precisam assinar antes de concluir." : undefined}
                >
                  <CheckIcon className="h-4 w-4" />
                  Concluir
                </button>
              </FormSeguro>
            )}
          </div>
        )}
      </div>

      {memorando.status === "ABERTO" && !podeExecutar && (
        <p className="mb-5 rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm text-blue-800">
          Aguardando o setor destinatário{memorando.ac ? ` (A/C ${memorando.ac.nome})` : ""} iniciar a execução.
        </p>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-5">
          <Panel title="Conteúdo">
            <div className="px-5 py-5">
              {camposModelo && memorando.modelo && (
                <>
                  <p className="mb-2 text-xs font-semibold text-slate-500">Modelo: {memorando.modelo.nome}</p>
                  <dl className="mb-5 grid gap-x-6 gap-y-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
                    {Object.entries(camposModelo).map(([k, v]) => (
                      <div key={k}>
                        <dt className="text-xs text-slate-500">{rotulosModelo[k] ?? k}</dt>
                        <dd className="mt-0.5 font-medium text-slate-800">{/^\d{4}-\d{2}-\d{2}$/.test(v) ? v.split("-").reverse().join("/") : v || "—"}</dd>
                      </div>
                    ))}
                  </dl>
                </>
              )}
              {memorando.corpo ? (
                <p className="whitespace-pre-wrap text-[15px] leading-7 text-slate-700">{memorando.corpo}</p>
              ) : (
                <p className="text-sm text-slate-400">Sem observações adicionais.</p>
              )}
            </div>
          </Panel>

          {memorando.fluxoAssinatura && (
            <Panel
              title="Assinaturas"
              description={memorando.fluxoAssinatura.concluido ? "Todos os signatários assinaram." : `${assinados} de ${signatarios.length} assinaturas coletadas`}
              action={<Badge tone={memorando.fluxoAssinatura.concluido ? "emerald" : "amber"}>{memorando.fluxoAssinatura.concluido ? "Concluído" : "Pendente"}</Badge>}
            >
              <ol className="px-5 py-4">
                {signatarios.map((s, i) => {
                  const ok = s.status === "ASSINADO";
                  return (
                    <li key={s.id} className="relative flex gap-3 pb-5 last:pb-0">
                      {i < signatarios.length - 1 && <span className={`absolute left-[15px] top-8 h-[calc(100%-2rem)] w-px ${ok ? "bg-emerald-200" : "bg-slate-200"}`} />}
                      <span className={`z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full ring-4 ring-white ${ok ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400"}`}>
                        {ok ? <CheckIcon className="h-4 w-4" /> : <ClockIcon className="h-4 w-4" />}
                      </span>
                      <div className="min-w-0 pt-1">
                        <p className="text-sm font-semibold text-slate-800">{s.user?.nome ?? s.nomeExterno}</p>
                        <p className="text-xs text-slate-500">
                          {ok && s.assinadoEm ? `Assinou em ${formatarDataHora(s.assinadoEm)}` : "Aguardando assinatura"}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
              {meuSignatario && meuSignatario.status === "PENDENTE" && (
                <FormSeguro acao={assinarMemorandoSeguro} className="border-t border-slate-100 bg-cyan-50/50 px-5 py-4">
                  <input type="hidden" name="memorandoId" value={memorando.id} />
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-slate-600">Sua assinatura é necessária. Registramos data, hora e IP.</p>
                    <button className="primary-button"><PencilSquareIcon className="h-4 w-4" />Assinar</button>
                  </div>
                </FormSeguro>
              )}
            </Panel>
          )}
        </div>

        <aside className="flex flex-col gap-5">
          <Panel title="Detalhes">
            <DetailList
              items={[
                {
                  label: "Emissor",
                  value: <span className="inline-flex items-center gap-2"><Avatar name={memorando.criadoPor.nome} size="sm" />{memorando.criadoPor.nome}</span>,
                },
                { label: "Destino", value: memorando.setores.map((s) => s.setor.nome).join(", ") },
                { label: "A/C", value: memorando.ac?.nome ?? <span className="text-slate-400">—</span> },
                { label: "Criado em", value: formatarDataHora(memorando.createdAt) },
                { label: "Atualizado", value: formatarRelativo(memorando.updatedAt) },
              ]}
            />
          </Panel>

          <Panel title="Para ciência" description="Notificados, sem necessidade de assinar.">
            {memorando.marcadosCiencia.length === 0 ? (
              <p className="px-5 py-4 text-sm text-slate-400">Ninguém foi marcado.</p>
            ) : (
              <ul className="flex flex-col gap-2.5 px-5 py-4">
                {memorando.marcadosCiencia.map((m) => (
                  <li key={m.userId} className="flex items-center gap-2.5 text-sm text-slate-700">
                    <Avatar name={m.user.nome} size="sm" />
                    {m.user.nome}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </aside>
      </div>
    </div>
  );
}
