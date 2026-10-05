import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/tenant";
import { pode } from "@/lib/permissoes";
import { STATUS_ETAPA_LABEL } from "@/lib/constants";
import {
  aprovarItemChecklistSeguro, avancarStatusEtapaSeguro, concluirEtapaComRevisaoSeguro, criarEventoCronogramaSeguro,
  criarItemChecklistSeguro, definirPrazoEtapaSeguro, enviarMensagemChatSeguro, reabrirEtapaSeguro,
  removerEventoCronogramaSeguro, responderFormularioEtapaSeguro,
} from "@/lib/actions/formularios";
import { formatarData } from "@/lib/formatters";
import { limiteAnexoTexto } from "@/lib/limite-anexo";
import { Badge, Panel, ProgressBar } from "@/components/ui";
import { FormSeguro } from "@/components/form-seguro";
import { EnviarArquivoChecklist } from "./EnviarArquivoChecklist";
import { DocumentoWorkspace } from "@/components/editor/DocumentoWorkspace";
import type { VersaoView } from "@/components/editor/tipos";
import type { DecisaoSugestao, TipoAnotacao } from "@/lib/editor/extensoes";
import {
  ArrowRightCircleIcon, CalendarDaysIcon, DocumentArrowDownIcon, DocumentTextIcon, PaperAirplaneIcon, PaperClipIcon, PlusIcon, UserIcon,
} from "@heroicons/react/24/outline";

const itemTone = (status: string) => status === "APROVADO" ? "emerald" : status === "ENVIADO" ? "blue" : "amber";

function initials(name: string) { return name.split(" ").map((part) => part[0]).slice(0, 2).join(""); }

export default async function EtapaPanel({ etapaId, projeto }: { etapaId: string; projeto: { id: string; tipo: string; tipoLabel: string; contratanteId: string; codigo: string } }) {
  const user = await requireSession();
  const isInterno = user.tipo === "INTERNO";
  // O que o perfil da pessoa permite nesta etapa (Cadastros › Perfis).
  const gerencia = pode(user, "projeto.gerenciar");
  const reabre = pode(user, "projeto.reabrir");
  const enviaDocumentos = pode(user, "etapa.enviar");
  const etapa = await prisma.etapaProjeto.findUniqueOrThrow({
    where: { id: etapaId },
    include: {
      responsavel: true, respostaFormulario: true,
      checklistItens: { include: { arquivo: true }, orderBy: { createdAt: "asc" } },
      documentos: {
        // Rascunho é só do CTP: para o município ele nem sai do servidor.
        where: isInterno ? {} : { enviadoEm: { not: null } },
        include: {
          arquivo: true,
          unidadesRevisao: { include: { autor: true }, orderBy: { createdAt: "asc" } },
          visualizacoes: { include: { user: true }, orderBy: { visualizadoEm: "asc" } },
          anotacoes: {
            include: { autor: true, resolvidoPor: true, respostas: { include: { autor: true }, orderBy: { createdAt: "asc" } } },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { versao: "desc" },
      },
      mensagens: { include: { autor: true, anexo: true }, orderBy: { createdAt: "asc" } },
      projeto: { include: { contratante: true, contratoOrigem: true, eventosCronograma: { orderBy: { data: "asc" } } } },
    },
  });
  const modelo = etapa.temFormulario ? await prisma.modeloFormulario.findFirst({ where: { tipo: "CONTRATO" } }) : null;
  const respostas = etapa.respostaFormulario ? JSON.parse(etapa.respostaFormulario.respostas) as Record<string, string> : null;
  const aprovadosChecklist = etapa.checklistItens.filter((item) => item.status === "APROVADO").length;
  const checklistProgress = etapa.checklistItens.length ? Math.round((aprovadosChecklist / etapa.checklistItens.length) * 100) : 0;

  // Formato serializável que o editor (client component) recebe.
  const versoes: VersaoView[] = etapa.documentos.map((d) => {
    const avaliacao = d.unidadesRevisao.find((u) => u.tipo === "DOCUMENTO_INTEIRO");
    return {
      id: d.id,
      versao: d.versao,
      titulo: d.titulo ?? d.nomeArquivo,
      conteudo: d.conteudo ? JSON.parse(d.conteudo) : null,
      enviadoEm: d.enviadoEm?.toISOString() ?? null,
      atualizadoEm: d.updatedAt.toISOString(),
      criadoPor: "",
      arquivoLegado: d.arquivo ? { nome: d.arquivo.nomeOriginal, url: `/api/files/${d.arquivo.id}` } : null,
      avaliacao: avaliacao ? { status: avaliacao.status, comentario: avaliacao.comentario, autor: avaliacao.autor.nome } : null,
      visualizacoes: d.visualizacoes.map((v) => ({ nome: v.user.nome, em: v.visualizadoEm.toISOString() })),
      lidaPorMim: d.visualizacoes.some((v) => v.userId === user.id),
      anotacoes: d.anotacoes.map((a) => ({
        id: a.id,
        autor: { id: a.autor.id, nome: a.autor.nome, tipo: a.autor.tipo },
        de: a.de,
        ate: a.ate,
        trecho: a.trecho,
        tipo: a.tipo as TipoAnotacao,
        cor: a.cor,
        texto: a.texto,
        sugestao: a.sugestao,
        decisao: a.decisao as DecisaoSugestao | null,
        resolvido: a.resolvido,
        resolvidoPor: a.resolvidoPor?.nome ?? null,
        criadoEm: a.createdAt.toISOString(),
        respostas: a.respostas.map((r) => ({ id: r.id, autor: { id: r.autor.id, nome: r.autor.nome, tipo: r.autor.tipo }, texto: r.texto, criadoEm: r.createdAt.toISOString() })),
      })),
    };
  });
  const ultimaEnviada = etapa.documentos.find((d) => d.enviadoEm);
  const avaliacaoAtual = ultimaEnviada?.unidadesRevisao.find((u) => u.tipo === "DOCUMENTO_INTEIRO");

  // ── O que falta nesta etapa e quem deve agir (linha "Próximo passo" do cabeçalho) ──
  const pendentes = etapa.checklistItens.filter((item) => item.status === "PENDENTE").length;
  const emAnalise = etapa.checklistItens.filter((item) => item.status === "ENVIADO").length;
  const camposFormulario = modelo ? (JSON.parse(modelo.campos) as { chave: string; label: string; tipo: string; obrigatorio: boolean }[]) : [];
  const formularioPendente = etapa.temFormulario && !!modelo && !respostas;
  const docs = (n: number) => `${n} documento${n === 1 ? "" : "s"}`;
  const faltaDoMunicipio = [pendentes > 0 && `enviar ${docs(pendentes)}`, formularioPendente && "preencher o formulário"].filter(Boolean).join(" e ");

  function proximoPasso(): string | null {
    if (etapa.temRevisao) return null; // o editor de minutas já orienta cada lado
    if (etapa.status === "CONCLUIDA") return "Etapa concluída. Nada a fazer aqui.";
    if (etapa.status === "NAO_INICIADA") {
      return gerencia ? "Clique em \"Iniciar etapa\" quando o trabalho começar." : "O CTP ainda não iniciou esta etapa.";
    }
    if (!isInterno) {
      if (faltaDoMunicipio) return `Falta ${faltaDoMunicipio}. O CTP confere e responde por aqui.`;
      return emAnalise ? `O CTP está conferindo ${docs(emAnalise)} que você enviou.` : "Tudo enviado. O CTP está analisando.";
    }
    if (emAnalise) return `Confira e aprove ${docs(emAnalise)} enviado${emAnalise === 1 ? "" : "s"} pelo município.`;
    if (faltaDoMunicipio) {
      return etapa.status === "AGUARDANDO_MUNICIPIO"
        ? `Aguardando o município ${faltaDoMunicipio}.`
        : `O município ainda precisa ${faltaDoMunicipio}. Use "Solicitar ação do município" para avisá-lo.`;
    }
    return etapa.temChecklist || etapa.temFormulario
      ? "Tudo recebido e aprovado. Conclua a etapa quando terminar a análise."
      : "Quando o trabalho desta etapa terminar, clique em \"Concluir etapa\".";
  }
  const passo = proximoPasso();
  const tomStatus = ({ CONCLUIDA: "emerald", AGUARDANDO_MUNICIPIO: "amber", EM_ANDAMENTO: "blue" } as const)[etapa.status as "CONCLUIDA"] ?? "slate";

  const StatusActions = () => (
    <div className="surface-panel mb-5 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">{etapa.nome}</h2>
            <Badge tone={tomStatus}>{STATUS_ETAPA_LABEL[etapa.status]}</Badge>
          </div>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><UserIcon className="h-3.5 w-3.5 text-slate-400" />Responsável no CTP: <strong className="font-semibold text-slate-700">{etapa.responsavel.nome}</strong></span>
            <span className="flex items-center gap-1.5"><CalendarDaysIcon className="h-3.5 w-3.5 text-slate-400" />Prazo: <strong className="font-semibold text-slate-700">{etapa.prazo ? formatarData(etapa.prazo) : "sem prazo"}</strong></span>
          </p>
        </div>
        {gerencia && etapa.status !== "CONCLUIDA" && (
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            {[
              etapa.status === "NAO_INICIADA" && { status: "EM_ANDAMENTO", rotulo: "Iniciar etapa", classe: "primary-button" },
              etapa.status === "EM_ANDAMENTO" && { status: "AGUARDANDO_MUNICIPIO", rotulo: "Solicitar ação do município", classe: "primary-button" },
              etapa.status === "AGUARDANDO_MUNICIPIO" && { status: "EM_ANDAMENTO", rotulo: "Retomar análise", classe: "secondary-button" },
              etapa.status === "EM_ANDAMENTO" && !etapa.temRevisao && { status: "CONCLUIDA", rotulo: "Concluir etapa", classe: "primary-button bg-emerald-600 hover:bg-emerald-700" },
            ].filter((b): b is { status: string; rotulo: string; classe: string } => !!b).map((b) => (
              <FormSeguro key={b.status + b.rotulo} acao={avancarStatusEtapaSeguro} className="flex flex-col items-end">
                <input type="hidden" name="etapaId" value={etapaId} />
                <input type="hidden" name="status" value={b.status} />
                <button className={`${b.classe} min-h-9 py-1.5 text-xs`}>{b.rotulo}</button>
              </FormSeguro>
            ))}
          </div>
        )}
      </div>

      {passo && (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-cyan-50 px-3.5 py-2.5 text-sm text-cyan-900">
          <ArrowRightCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" />
          <span><strong className="font-semibold">Próximo passo:</strong> {passo}</span>
        </p>
      )}

      {/* Ajustes menos usados ficam recolhidos para não competir com o próximo passo. */}
      {(gerencia && etapa.status !== "CONCLUIDA") || (reabre && etapa.status === "CONCLUIDA") ? (
        <details className="group mt-3">
          <summary className="cursor-pointer list-none text-xs font-medium text-slate-400 hover:text-slate-600">
            <span className="group-open:hidden">{etapa.status === "CONCLUIDA" ? "Reabrir etapa…" : "Alterar prazo…"}</span>
            <span className="hidden group-open:inline">Fechar</span>
          </summary>
          {etapa.status === "CONCLUIDA" ? (
            <FormSeguro acao={reabrirEtapaSeguro} className="mt-3 flex flex-wrap items-center gap-2">
              <input type="hidden" name="etapaId" value={etapaId} />
              <input name="motivo" required placeholder="Motivo da reabertura" className="form-control w-64 py-2 text-xs" />
              <button className="secondary-button min-h-9 py-1.5 text-xs">Reabrir</button>
            </FormSeguro>
          ) : (
            <FormSeguro acao={definirPrazoEtapaSeguro} limparAoEnviar={false} className="mt-3 flex flex-wrap items-center gap-2">
              <input type="hidden" name="etapaId" value={etapaId} />
              <input aria-label="Prazo da etapa" type="date" name="prazo" defaultValue={etapa.prazo?.toISOString().slice(0, 10) ?? ""} className="form-control w-auto py-2 text-xs" />
              <button className="secondary-button min-h-9 py-1.5 text-xs">Salvar prazo</button>
            </FormSeguro>
          )}
        </details>
      ) : null}
    </div>
  );

  const ChatPanel = () => (
    <Panel title="Chat da etapa" description="Conversa entre o CTP e o município sobre esta etapa. Assuntos gerais vão em Conversas.">
      <div className="max-h-[480px] space-y-4 overflow-y-auto px-4 py-4">
        {etapa.mensagens.map((m) => <div key={m.id} className="flex gap-2.5"><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[10px] font-bold ${m.autor.tipo === "EXTERNO" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}>{initials(m.autor.nome)}</span><div className="min-w-0 flex-1"><div className="flex items-baseline justify-between gap-2"><p className="truncate text-xs font-semibold text-slate-800">{m.autor.nome} <span className="font-normal text-slate-400">({m.autor.tipo === "EXTERNO" ? "Município" : "CTP"})</span></p><time className="shrink-0 text-[10px] text-slate-400">{m.createdAt.toLocaleDateString("pt-BR")}</time></div><div className="mt-1 rounded-xl rounded-tl-sm bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">{m.texto}{m.anexo && <a href={m.anexo.caminho} target="_blank" className="mt-1 flex items-center gap-1 font-semibold text-cyan-700"><PaperClipIcon className="h-3.5 w-3.5" />{m.anexo.nomeOriginal}</a>}</div></div></div>)}
        {etapa.mensagens.length === 0 && <p className="py-10 text-center text-xs text-slate-400">Nenhuma mensagem nesta etapa.</p>}
      </div>
      <FormSeguro acao={enviarMensagemChatSeguro} className="border-t border-slate-100 p-3"><input type="hidden" name="etapaId" value={etapaId} /><div className="flex gap-2"><input name="texto" aria-label="Mensagem" placeholder="Digite sua mensagem..." className="form-control min-w-0 flex-1 py-2 text-xs" /><label className="secondary-button min-h-9 cursor-pointer px-2.5 py-1.5" title={`Anexar arquivo (até ${limiteAnexoTexto()})`}><PaperClipIcon className="h-4 w-4" /><input type="file" name="arquivo" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" className="sr-only" /></label><button type="submit" className="primary-button min-h-9 px-3 py-1.5" aria-label="Enviar mensagem"><PaperAirplaneIcon className="h-4 w-4" /></button></div></FormSeguro>
    </Panel>
  );

  const Checklist = () => (
    <Panel
      title="Documentos solicitados"
      description={`${isInterno ? "Arquivos que o município precisa enviar; o CTP confere e aprova cada um." : "Envie cada arquivo pedido; o CTP confere e aprova."} ${aprovadosChecklist} de ${etapa.checklistItens.length} aprovados.`}
      action={<span className="w-24"><ProgressBar value={checklistProgress} tone="emerald" /></span>}
    >
      <div className="divide-y divide-slate-100">
        {etapa.checklistItens.map((item) => (
          <div key={item.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-50 text-slate-500"><DocumentTextIcon className="h-4 w-4" /></span>
            <div className="min-w-[180px] flex-1">
              <p className="text-sm font-semibold text-slate-800">{item.nome}</p>
              {item.arquivo
                ? <a href={item.arquivo.caminho} target="_blank" className="mt-0.5 flex max-w-full items-center gap-1 text-xs text-cyan-700"><DocumentArrowDownIcon className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{item.arquivo.nomeOriginal}</span></a>
                : <p className="mt-0.5 text-xs text-slate-400">Nenhum arquivo enviado</p>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge tone={itemTone(item.status) as "amber" | "blue" | "emerald"}>{item.status === "APROVADO" ? "Aprovado" : item.status === "ENVIADO" ? "Em análise" : "Pendente"}</Badge>
              {enviaDocumentos && item.status === "PENDENTE" && <EnviarArquivoChecklist itemId={item.id} />}
              {gerencia && item.status === "ENVIADO" && <FormSeguro acao={aprovarItemChecklistSeguro}><input type="hidden" name="itemId" value={item.id} /><button className="secondary-button min-h-8 border-emerald-200 px-2.5 py-1 text-[11px] text-emerald-700">Aprovar</button></FormSeguro>}
            </div>
          </div>
        ))}
        {etapa.checklistItens.length === 0 && <p className="px-5 py-10 text-center text-xs text-slate-400">Nenhum documento solicitado ainda.</p>}
      </div>
      {gerencia && <FormSeguro acao={criarItemChecklistSeguro} className="border-t border-slate-100 p-3"><div className="flex gap-2"><input type="hidden" name="etapaId" value={etapaId} /><input name="nome" required placeholder="Pedir outro documento ao município" className="form-control flex-1 py-2 text-xs" /><button className="secondary-button min-h-9 px-3 py-1.5 text-xs"><PlusIcon className="h-4 w-4" />Adicionar</button></div></FormSeguro>}
    </Panel>
  );

  const Formulario = () => modelo && (
    <Panel title={`Formulário — ${modelo.nome}`} description={isInterno ? "Informações que o município preenche nesta etapa." : "Preencha as informações pedidas pelo CTP."}>
      <div className="p-5">
        {enviaDocumentos && !respostas ? (
          <FormSeguro acao={responderFormularioEtapaSeguro} limparAoEnviar={false} className="space-y-4">
            <input type="hidden" name="etapaId" value={etapaId} />
            {camposFormulario.map((campo) => <label key={campo.chave} className="block text-xs font-semibold text-slate-600">{campo.label}{campo.obrigatorio && <span className="text-red-500"> *</span>}{campo.tipo === "textarea" ? <textarea name={campo.chave} required={campo.obrigatorio} rows={3} className="form-control mt-1" /> : <input name={campo.chave} required={campo.obrigatorio} className="form-control mt-1" />}</label>)}
            <button className="primary-button">Enviar respostas</button>
          </FormSeguro>
        ) : respostas ? (
          <dl className="divide-y divide-slate-100">
            {Object.entries(respostas).map(([chave, valor]) => (
              <div key={chave} className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-4">
                <dt className="text-xs font-semibold text-slate-500">{camposFormulario.find((c) => c.chave === chave)?.label ?? chave.replaceAll("_", " ")}</dt>
                <dd className="text-sm text-slate-700">{valor || "—"}</dd>
              </div>
            ))}
          </dl>
        ) : <p className="py-8 text-center text-sm text-slate-400">Aguardando o município preencher.</p>}
      </div>
    </Panel>
  );

  // Dados e cronograma valem para o projeto todo: aparecem só em "Informações iniciais".
  const DadosDoProjeto = () => (
    <Panel title="Dados do projeto" description="Herdados do contrato de origem.">
      <dl className="grid gap-4 p-5 text-xs sm:grid-cols-2">
        <div><dt className="text-slate-400">Código</dt><dd className="mt-0.5 font-semibold text-slate-800">{etapa.projeto.codigo}</dd></div>
        <div><dt className="text-slate-400">Contratante</dt><dd className="mt-0.5 font-semibold text-slate-800">{etapa.projeto.contratante.nome}</dd></div>
        <div><dt className="text-slate-400">Contrato de origem</dt><dd className="mt-0.5 font-semibold text-slate-800">{etapa.projeto.contratoOrigem.codigo}</dd></div>
        <div><dt className="text-slate-400">Vigência</dt><dd className="mt-0.5 font-semibold text-slate-800">{formatarData(etapa.projeto.dataVigencia)}</dd></div>
      </dl>
    </Panel>
  );

  const Cronograma = () => (
    <Panel title="Cronograma do projeto" description="Reuniões, oficinas e entregas combinadas com o município, do projeto inteiro.">
      <div className="px-5 py-4">
        <ol className="space-y-5">
          {etapa.projeto.eventosCronograma.map((event) => <li key={event.id} className="relative flex gap-3"><span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-cyan-500 ring-4 ring-cyan-50" /><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-800">{event.titulo}</p><p className="mt-0.5 text-xs text-slate-400">{formatarData(event.data)} · {event.responsavelNome}</p>{event.descricao && <p className="mt-1 text-xs leading-5 text-slate-500">{event.descricao}</p>}</div>{gerencia && <FormSeguro acao={removerEventoCronogramaSeguro}><input type="hidden" name="eventoId" value={event.id} /><button className="text-[11px] text-slate-400 hover:text-red-600">remover</button></FormSeguro>}</li>)}
          {etapa.projeto.eventosCronograma.length === 0 && <p className="py-8 text-center text-xs text-slate-400">Nenhum evento cadastrado.</p>}
        </ol>
      </div>
      {gerencia && (
        <FormSeguro acao={criarEventoCronogramaSeguro} className="space-y-2 border-t border-slate-100 bg-slate-50/70 p-4">
          <input type="hidden" name="projetoId" value={projeto.id} />
          <p className="text-xs font-semibold text-slate-600">Adicionar evento</p>
          <div className="grid gap-2 sm:grid-cols-[160px_minmax(0,1fr)_minmax(0,1fr)]">
            <input type="date" name="data" required aria-label="Data do evento" className="form-control py-2 text-xs" />
            <input name="titulo" required placeholder="Título do evento" className="form-control py-2 text-xs" />
            <input name="responsavelNome" required placeholder="Responsável" className="form-control py-2 text-xs" />
          </div>
          <div className="flex gap-2">
            <input name="descricao" placeholder="Descrição opcional" className="form-control min-w-0 flex-1 py-2 text-xs" />
            <button className="secondary-button min-h-9 py-1.5 text-xs"><PlusIcon className="h-4 w-4" />Adicionar</button>
          </div>
        </FormSeguro>
      )}
    </Panel>
  );

  if (etapa.temRevisao) {
    const podeConcluir = !!avaliacaoAtual && avaliacaoAtual.status !== "PENDENTE";
    return <>
      {StatusActions()}
      {/* Etapa de revisão que também pede documentos ou formulário: eles vêm antes do editor. */}
      {(etapa.temChecklist || (etapa.temFormulario && !!modelo)) && (
        <div className="mb-5 space-y-5">
          {etapa.temChecklist && Checklist()}
          {etapa.temFormulario && Formulario()}
        </div>
      )}
      <DocumentoWorkspace etapaId={etapaId} versoes={versoes} usuario={{ id: user.id, nome: user.name ?? "Usuário", tipo: user.tipo, permissoes: user.permissoes }} tipoLabel={projeto.tipoLabel} />
      {gerencia && ultimaEnviada && etapa.status !== "CONCLUIDA" && (
        <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">Concluir a revisão desta etapa</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {!avaliacaoAtual || avaliacaoAtual.status === "PENDENTE"
                ? `Disponível depois que o município der o parecer sobre a versão ${ultimaEnviada.versao}.`
                : avaliacaoAtual.status === "APROVADO"
                  ? `O município aprovou a versão ${ultimaEnviada.versao}. Você já pode concluir a etapa.`
                  : `O município pediu ajustes na versão ${ultimaEnviada.versao}. Normalmente você cria uma nova versão antes de concluir.`}
            </p>
          </div>
          <FormSeguro acao={concluirEtapaComRevisaoSeguro} className="flex flex-col items-end">
            <input type="hidden" name="etapaId" value={etapaId} />
            <button disabled={!podeConcluir} className="primary-button bg-emerald-600 hover:bg-emerald-700">Concluir revisão</button>
          </FormSeguro>
        </div>
      )}
      <div className="mt-5">{ChatPanel()}</div>
    </>;
  }

  const temTrabalho = etapa.temChecklist || (etapa.temFormulario && !!modelo) || etapa.temInformacoesProjeto;
  // Duas colunas só quando o espaço da etapa comporta (container query): trabalho à esquerda, chat à direita.
  return <>
    {StatusActions()}
    <div className="@container">
      <div className="grid gap-5 @4xl:grid-cols-[minmax(0,1fr)_360px] @4xl:items-start">
        <div className="min-w-0 space-y-5">
          {etapa.temChecklist && Checklist()}
          {etapa.temFormulario && Formulario()}
          {etapa.temInformacoesProjeto && DadosDoProjeto()}
          {etapa.temInformacoesProjeto && Cronograma()}
          {!temTrabalho && (
            <div className="surface-panel px-6 py-10 text-center">
              <p className="text-sm font-semibold text-slate-700">Esta etapa não pede documentos nem formulário.</p>
              <p className="mt-1 text-xs text-slate-500">Use o chat ao lado para combinar o andamento com {isInterno ? "o município" : "o CTP"}.</p>
            </div>
          )}
        </div>
        <div className="@4xl:sticky @4xl:top-20">{ChatPanel()}</div>
      </div>
    </div>
  </>;
}
