import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/tenant";
import { podeVerContrato } from "@/lib/visibilidade";
import { lerIds, pode } from "@/lib/permissoes";

import { garantirEtapasDosContratos, podeAprovarEtapa, podeAvancarEtapa, progressoDoContrato } from "@/lib/fluxo-contrato";
import { aprovarEtapaContratoSeguro, assinarContratoSeguro, criarProjetoDoContratoSeguro, pedirRevisaoEtapaContratoSeguro } from "@/lib/actions/formularios";
import { DocumentosDaEtapa } from "./DocumentosDaEtapa";
import { FormSeguro } from "@/components/form-seguro";
import { formatarDataHora, formatarDiaDoEvento, formatarRelativo } from "@/lib/formatters";
import { notFound } from "next/navigation";
import { Avatar, BackLink, Badge, DetailList, Panel } from "@/components/ui";
import {
  ArrowRightCircleIcon,
  ArrowTopRightOnSquareIcon,
  CheckIcon,
  ClockIcon,
  DocumentTextIcon,
  FolderOpenIcon,
  PencilSquareIcon,
} from "@heroicons/react/24/outline";
import { ConversasRelacionadas } from "@/components/conversas-relacionadas";
import AbrirFluxoAssinaturaForm from "./AbrirFluxoAssinaturaForm";
import AvancarEtapaForm from "./AvancarEtapaForm";

export const metadata: Metadata = { title: "Contrato" };

function tamanhoLegivel(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default async function ContratoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireSession();
  const isInterno = user.tipo === "INTERNO";

  await garantirEtapasDosContratos([id]);
  const contrato = await prisma.contrato.findUnique({
    where: { id },
    include: {
      contratante: true,
      responsavel: true,
      fluxo: { select: { nome: true } },
      etapas: { orderBy: { ordem: "asc" }, include: { concluidaPor: { select: { nome: true } } } },
      fluxoAssinatura: { include: { signatarios: { include: { user: true }, orderBy: { createdAt: "asc" } } } },
      projetos: true,
      anexos: { orderBy: { createdAt: "asc" } },
      documentos: { include: { anexo: { select: { id: true, nomeOriginal: true } } }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!contrato) notFound();
  // Outra prefeitura (ou contrato fora do alcance do perfil): "não encontrado", sem revelar que existe.
  if (!(await podeVerContrato(user, contrato.id))) notFound();

  // Tudo vem do fluxo do próprio contrato (Cadastros › Fluxos de contrato), não de etapas fixas.
  const { indice: idxAtual, atual: etapaAtual, proxima: proximaEtapa, concluido: naEtapaFinal, situacao, temEtapaDeAssinatura } = progressoDoContrato(contrato.etapas, contrato.etapaAtual);
  const naEtapaAssinatura = !!etapaAtual?.exigeAssinaturas;
  const assinaturasOk = !temEtapaDeAssinatura || !!contrato.fluxoAssinatura?.concluido;
  const podeCriarProjeto = !!etapaAtual?.liberaProjeto && assinaturasOk && contrato.projetos.length === 0;
  const avancoBloqueadoPorAssinatura = naEtapaAssinatura && !contrato.fluxoAssinatura?.concluido;
  // Permissões do perfil (Cadastros › Perfis) e restrição de quem conclui a etapa atual.
  const gerencia = pode(user, "contrato.gerenciar");
  const podeAvancar = !!etapaAtual && podeAvancarEtapa(user, etapaAtual);
  const perfisDaEtapa = etapaAtual ? lerIds(etapaAtual.perfisQueAvancam) : [];
  const nomesPerfisDaEtapa = perfisDaEtapa.length
    ? (await prisma.perfil.findMany({ where: { id: { in: perfisDaEtapa } }, select: { nome: true } })).map((p) => p.nome).join(", ")
    : "";

  const usuariosInternos = isInterno ? await prisma.user.findMany({ where: { tipo: "INTERNO", ativo: true }, orderBy: { nome: "asc" } }) : [];
  const tiposProjeto = isInterno ? await prisma.tipoProjetoModelo.findMany({
    // Tipos gerais + os exclusivos desta prefeitura.
    where: { OR: [{ municipioId: null }, { municipioId: contrato.contratanteId }] },
    include: { _count: { select: { etapas: true } } },
    orderBy: { nome: "asc" },
  }) : [];

  // Documentos pedidos na etapa atual, aprovação pela prefeitura e o "próximo passo" de quem está vendo.
  const enviaDocumentos = pode(user, "etapa.enviar");
  const documentosEtapa = etapaAtual ? contrato.documentos.filter((d) => d.etapaChave === etapaAtual.chave) : [];
  const emAberto = documentosEtapa.filter((d) => d.status !== "APROVADO");
  const daPrefeituraPendentes = emAberto.filter((d) => d.enviaQuem === "PREFEITURA" && d.status === "PENDENTE");
  const doCtpPendentes = emAberto.filter((d) => d.enviaQuem === "CTP");
  const paraConferir = emAberto.filter((d) => d.status === "ENVIADO");
  const etapaDaPrefeitura = !naEtapaFinal && !!etapaAtual?.concluidaPelaPrefeitura;
  const aprova = !!etapaAtual && podeAprovarEtapa(user, etapaAtual);
  const etapaAnterior = idxAtual > 0 ? contrato.etapas[idxAtual - 1] : null;
  // O que a prefeitura analisa na aprovação: os arquivos entregues na etapa anterior (ex.: o orçamento).
  const paraAnalisar = etapaAnterior ? contrato.documentos.filter((d) => d.etapaChave === etapaAnterior.chave && d.anexo) : [];
  const docs = (n: number) => `${n} documento${n === 1 ? "" : "s"}`;
  const meuSignatarioPendente = (contrato.fluxoAssinatura?.signatarios ?? []).some((s) =>
    s.status === "PENDENTE" && (user.tipo === "EXTERNO" ? s.tipo === "EXTERNO" && pode(user, "contrato.assinar") : s.userId === user.id));

  const temFluxoAssinatura = !!contrato.fluxoAssinatura;
  function proximoPasso(): string {
    if (naEtapaFinal) return "Contrato concluído. Nada a fazer aqui.";
    if (etapaDaPrefeitura) {
      if (isInterno) return `Aguardando a decisão da prefeitura em "${etapaAtual?.nome}".`;
      return aprova ? `Analise ${paraAnalisar.length ? "o que o CTP enviou" : "a etapa"} e aprove, ou peça revisão explicando o motivo.` : `Aguardando a aprovação de quem responde pela prefeitura (ex.: o prefeito).`;
    }
    if (naEtapaAssinatura && meuSignatarioPendente) return "Sua assinatura é necessária no contrato.";
    if (!isInterno) {
      if (daPrefeituraPendentes.length && enviaDocumentos) return `Envie ${docs(daPrefeituraPendentes.length)} pedido${daPrefeituraPendentes.length === 1 ? "" : "s"} pelo CTP.`;
      if (paraConferir.length) return `O CTP está conferindo ${docs(paraConferir.length)} que vocês enviaram.`;
      return naEtapaAssinatura ? "Aguardando as assinaturas." : "O CTP está trabalhando nesta etapa.";
    }
    if (paraConferir.length) return `Confira e aprove ${docs(paraConferir.length)} enviado${paraConferir.length === 1 ? "" : "s"} pela prefeitura.`;
    if (doCtpPendentes.length) return `Envie ${docs(doCtpPendentes.length)} que cabe${doCtpPendentes.length === 1 ? "" : "m"} ao CTP.`;
    if (daPrefeituraPendentes.length) return `Aguardando a prefeitura enviar ${docs(daPrefeituraPendentes.length)}.`;
    if (naEtapaAssinatura && !temFluxoAssinatura) return "Abra a coleta de assinaturas.";
    if (avancoBloqueadoPorAssinatura) return "Aguardando as assinaturas.";
    return proximaEtapa ? `Tudo certo nesta etapa. Avance para "${proximaEtapa.nome}" quando concluir.` : "";
  }
  const passo = proximoPasso();

  const signatarios = contrato.fluxoAssinatura?.signatarios ?? [];
  const assinados = signatarios.filter((s) => s.status === "ASSINADO").length;
  // Pela prefeitura, só assina quem tem a permissão no perfil (ex.: o prefeito).
  const meuSignatario = contrato.fluxoAssinatura?.signatarios.find((s) =>
    user.tipo === "EXTERNO" ? s.tipo === "EXTERNO" && pode(user, "contrato.assinar") : s.userId === user.id
  );
  const tags = contrato.tags ? (JSON.parse(contrato.tags) as string[]) : [];
  const statusGeral =
    situacao === "concluido" ? { label: etapaAtual?.curto ?? "Concluído", tone: "emerald" as const }
    : situacao === "assinatura" ? { label: "Em assinatura", tone: "amber" as const }
    : { label: "Em andamento", tone: "blue" as const };

  return (
    <div className="mx-auto max-w-[1300px]">
      <BackLink href="/contratos" label={isInterno ? "Contratos" : "Meus contratos"} />

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold tracking-wide text-cyan-700">{contrato.codigo}</span>
            <Badge tone={statusGeral.tone}>{statusGeral.label}</Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{contrato.objeto}</h1>
          <p className="mt-1.5 text-sm text-slate-500">{contrato.contratante.nome} · atualizado {formatarRelativo(contrato.updatedAt)}</p>
        </div>
        {contrato.projetos[0] && (
          <Link href={`/projetos/${contrato.projetos[0].id}`} className="secondary-button shrink-0">
            <FolderOpenIcon className="h-4 w-4" />
            Abrir projeto {contrato.projetos[0].codigo}
          </Link>
        )}
      </div>

      {/* Stepper conectado: concluídas em verde, atual em destaque, futuras em cinza. */}
      <div className="surface-panel mb-6 overflow-x-auto px-6 py-5">
        {contrato.fluxo && <p className="mb-4 text-xs font-medium text-slate-500">Tipo de contrato: <span className="font-semibold text-slate-700">{contrato.fluxo.nome}</span></p>}
        <ol className="flex items-start" style={{ minWidth: `${Math.max(480, contrato.etapas.length * 110)}px` }}>
          {contrato.etapas.map((etapa, i) => {
            const feita = i < idxAtual || (naEtapaFinal && i === idxAtual);
            const atual = i === idxAtual && !naEtapaFinal;
            return (
              <li
                key={etapa.chave}
                className="relative flex flex-1 flex-col items-center text-center"
                title={etapa.concluidaEm ? `Concluída em ${formatarDataHora(etapa.concluidaEm)}${etapa.concluidaPor ? ` por ${etapa.concluidaPor.nome}` : ""}` : undefined}
              >
                {i > 0 && <span className={`absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2 ${i <= idxAtual ? "bg-emerald-400" : "bg-slate-200"}`} />}
                <span
                  className={`relative z-10 grid h-8 w-8 place-items-center rounded-full text-xs font-bold ring-4 ring-white ${
                    feita ? "bg-emerald-500 text-white" : atual ? "bg-cyan-600 text-white shadow-lg shadow-cyan-600/30" : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {feita ? <CheckIcon className="h-4 w-4" /> : i + 1}
                </span>
                <span className={`mt-2 px-1 text-xs font-semibold ${atual ? "text-cyan-800" : feita ? "text-slate-700" : "text-slate-400"}`}>{etapa.curto}</span>
                <span className="mt-0.5 hidden px-2 text-[10px] leading-4 text-slate-400 md:block">{etapa.nome}</span>
                {etapa.concluidaEm && (
                  <span className="mt-1 hidden px-1 text-[10px] leading-4 text-emerald-700 md:block">
                    {formatarDiaDoEvento(etapa.concluidaEm)}{etapa.concluidaPor ? ` · ${etapa.concluidaPor.nome.split(" ")[0]}` : ""}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-5">
          {passo && (
            <p className="flex items-start gap-2 rounded-xl bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
              <ArrowRightCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" />
              <span><strong className="font-semibold">Próximo passo:</strong> {passo}</span>
            </p>
          )}
          {etapaAtual?.motivoDevolucao && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <strong className="font-semibold">A prefeitura pediu revisão:</strong> {etapaAtual.motivoDevolucao}
            </p>
          )}

          {etapaDaPrefeitura && (
            <Panel title="Aprovação da prefeitura" description={`"${etapaAtual?.nome}" é decidida pela prefeitura: aprovar segue o contrato; pedir revisão devolve à etapa anterior.`}>
              {paraAnalisar.length > 0 && (
                <ul className="divide-y divide-slate-100 border-b border-slate-100">
                  {paraAnalisar.map((d) => (
                    <li key={d.id}>
                      <a href={`/api/files/${d.anexo!.id}`} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-red-50 text-red-600"><DocumentTextIcon className="h-5 w-5" /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-slate-800 group-hover:text-cyan-800">{d.nome}</span>
                          <span className="block truncate text-xs text-slate-400">{d.anexo!.nomeOriginal}</span>
                        </span>
                        <ArrowTopRightOnSquareIcon className="h-4 w-4 text-slate-300 group-hover:text-cyan-600" />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              {aprova ? (
                <div className="flex flex-col gap-3 px-5 py-4">
                  <FormSeguro acao={aprovarEtapaContratoSeguro} className="flex flex-col items-start">
                    <input type="hidden" name="contratoId" value={contrato.id} />
                    <button className="primary-button bg-emerald-600 hover:bg-emerald-700"><CheckIcon className="h-4 w-4" />Aprovar e seguir para {proximaEtapa?.curto}</button>
                  </FormSeguro>
                  <details>
                    <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-700">Pedir revisão ao CTP…</summary>
                    <FormSeguro acao={pedirRevisaoEtapaContratoSeguro} className="mt-2 flex flex-col gap-2">
                      <input type="hidden" name="contratoId" value={contrato.id} />
                      <textarea name="motivo" required rows={3} aria-label="O que precisa ser revisto" placeholder="O que precisa ser revisto" className="form-control text-sm" />
                      <button className="secondary-button self-start border-amber-200 text-amber-800">Pedir revisão</button>
                    </FormSeguro>
                  </details>
                </div>
              ) : (
                <p className="px-5 py-4 text-xs text-slate-500">
                  {isInterno ? "O CTP não conclui esta etapa: a prefeitura aprova ou pede revisão pelo portal." : "Só quem tem no perfil a permissão \"Aprovar etapas do contrato\" decide esta etapa."}
                </p>
              )}
            </Panel>
          )}

          {gerencia && proximaEtapa && !etapaDaPrefeitura && (
            <Panel title="Próxima etapa" description={`Etapa atual: ${etapaAtual?.nome}`}>
              <div className="px-5 py-4">
                <AvancarEtapaForm
                  contratoId={contrato.id}
                  proximaEtapaNome={proximaEtapa.curto}
                  bloqueado={avancoBloqueadoPorAssinatura || !podeAvancar || emAberto.length > 0}
                  motivoBloqueio={
                    !podeAvancar
                      ? `A etapa "${etapaAtual?.nome}" só pode ser concluída por: ${nomesPerfisDaEtapa}.`
                      : avancoBloqueadoPorAssinatura ? `A etapa "${etapaAtual?.nome}" exige todas as assinaturas antes de avançar.`
                      : emAberto.length ? `Faltam ${docs(emAberto.length)} desta etapa (veja abaixo).` : undefined
                  }
                />
              </div>
            </Panel>
          )}

          {etapaAtual && !naEtapaFinal && (documentosEtapa.length > 0 || gerencia) && (
            <DocumentosDaEtapa
              contratoId={contrato.id}
              etapaNome={etapaAtual.nome}
              documentos={documentosEtapa}
              isInterno={isInterno}
              gerencia={gerencia}
              enviaDocumentos={enviaDocumentos}
            />
          )}

          {naEtapaAssinatura && gerencia && !contrato.fluxoAssinatura && (
            <Panel title="Abrir fluxo de assinatura" description="Escolha quem assina a minuta pelo CTP e pelo município.">
              <div className="px-5 py-5">
                <AbrirFluxoAssinaturaForm contratoId={contrato.id} usuariosInternos={usuariosInternos.map((u) => ({ id: u.id, nome: u.nome }))} />
              </div>
            </Panel>
          )}

          {contrato.fluxoAssinatura && (
            <Panel
              title="Assinaturas"
              description={contrato.fluxoAssinatura.concluido ? "Todas as partes assinaram." : `${assinados} de ${signatarios.length} assinaturas coletadas`}
              action={<Badge tone={contrato.fluxoAssinatura.concluido ? "emerald" : "amber"}>{contrato.fluxoAssinatura.concluido ? "Concluído" : "Pendente"}</Badge>}
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
                      <div className="min-w-0 flex-1 pt-1">
                        <p className="text-sm font-semibold text-slate-800">
                          {s.user?.nome ?? s.nomeExterno}
                          <span className={`ml-2 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${s.tipo === "INTERNO" ? "bg-cyan-50 text-cyan-700" : "bg-violet-50 text-violet-700"}`}>
                            {s.tipo === "INTERNO" ? "CTP" : "Município"}
                          </span>
                        </p>
                        <p className="text-xs text-slate-500">{ok && s.assinadoEm ? `Assinou em ${formatarDataHora(s.assinadoEm)}` : "Aguardando assinatura"}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
              {meuSignatario && meuSignatario.status === "PENDENTE" && (
                <FormSeguro acao={assinarContratoSeguro} className="border-t border-slate-100 bg-cyan-50/50 px-5 py-4" erroClassName="mt-2 flex items-center gap-1.5 text-xs text-red-600 sm:justify-end">
                  <input type="hidden" name="contratoId" value={contrato.id} />
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-slate-600">Sua assinatura é necessária. Registramos data, hora e IP para valor probatório.</p>
                    <button className="primary-button shrink-0"><PencilSquareIcon className="h-4 w-4" />Assinar digitalmente</button>
                  </div>
                </FormSeguro>
              )}
            </Panel>
          )}

          {podeCriarProjeto && gerencia && (
            <Panel title="Criar projeto técnico" description="O contrato chegou à etapa que libera o projeto. Gere o projeto com o fluxo de etapas do tipo escolhido.">
              <FormSeguro acao={criarProjetoDoContratoSeguro} limparAoEnviar={false} className="grid gap-4 px-5 py-5 sm:grid-cols-3" erroClassName="flex items-center gap-1.5 text-sm text-red-600 sm:col-span-3">
                <input type="hidden" name="contratoId" value={contrato.id} />
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">Tipo de projeto</span>
                  <select name="tipo" required className="form-control">
                    {tiposProjeto.map((t) => (
                      <option key={t.chave} value={t.chave} disabled={t._count.etapas === 0}>
                        {t.nome}{t._count.etapas === 0 ? " (sem fluxo configurado)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">Vigência até</span>
                  <input type="date" name="dataVigencia" required className="form-control" />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">Responsável</span>
                  <select name="responsavelId" required className="form-control" defaultValue={contrato.responsavelId}>
                    {usuariosInternos.map((u) => (
                      <option key={u.id} value={u.id}>{u.nome}</option>
                    ))}
                  </select>
                </label>
                <div className="flex flex-col gap-2 sm:col-span-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-slate-400">Não encontrou o tipo? Crie em Cadastros › Fluxos de projeto.</p>
                  <button className="primary-button"><FolderOpenIcon className="h-4 w-4" />Criar projeto</button>
                </div>
              </FormSeguro>
            </Panel>
          )}

          <Panel title="Arquivos do contrato" description="Tudo o que foi enviado ao longo do contrato, inclusive versões substituídas.">
            {contrato.anexos.length === 0 ? (
              <p className="px-5 py-5 text-sm text-slate-400">Nenhum documento anexado ainda.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {contrato.anexos.map((a) => (
                  <li key={a.id}>
                    <a href={`/api/files/${a.id}`} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-red-50 text-red-600"><DocumentTextIcon className="h-5 w-5" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-800 group-hover:text-cyan-800">{a.nomeOriginal}</span>
                        <span className="text-xs text-slate-400">{tamanhoLegivel(a.tamanho)} · {formatarDiaDoEvento(a.createdAt)}</span>
                      </span>
                      <ArrowTopRightOnSquareIcon className="h-4 w-4 text-slate-300 group-hover:text-cyan-600" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <aside className="flex flex-col gap-5">
          <Panel title="Detalhes">
            <DetailList
              items={[
                { label: "Município", value: contrato.contratante.nome },
                { label: "Responsável", value: <span className="inline-flex items-center gap-2"><Avatar name={contrato.responsavel.nome} size="sm" />{contrato.responsavel.nome}</span> },
                { label: "Tipo", value: contrato.fluxo?.nome ?? "—" },
                { label: "Etapa", value: `${idxAtual + 1} de ${contrato.etapas.length}` },
                { label: "Aberto em", value: formatarDiaDoEvento(contrato.createdAt) },
                { label: "Projeto", value: contrato.projetos[0] ? <Link href={`/projetos/${contrato.projetos[0].id}`} className="text-cyan-700 hover:underline">{contrato.projetos[0].codigo}</Link> : <span className="text-slate-400">Ainda não criado</span> },
              ]}
            />
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 border-t border-slate-100 px-5 py-3.5">
                {tags.map((t) => (
                  <span key={t} className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">#{t}</span>
                ))}
              </div>
            )}
          </Panel>
          <ConversasRelacionadas user={user} contratoId={contrato.id} />
        </aside>
      </div>
    </div>
  );
}
