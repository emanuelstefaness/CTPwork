"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { Fragment, Slice } from "@tiptap/pm/model";
import { Placeholder } from "@tiptap/extensions";
import {
  ArrowDownTrayIcon, ArrowUpTrayIcon, ArrowsPointingInIcon, ArrowsPointingOutIcon, ChatBubbleLeftEllipsisIcon, CheckCircleIcon, CheckIcon,
  CloudArrowUpIcon, EyeIcon, HandThumbDownIcon, HandThumbUpIcon, LockClosedIcon, PaperAirplaneIcon,
  PencilSquareIcon, PrinterIcon, TrashIcon, XMarkIcon,
} from "@heroicons/react/24/outline";
import { extensoesDocumento, CORES_GRIFO, DOCUMENTO_VAZIO, TIPO_ANOTACAO_LABEL, limparSugestao, type TipoAnotacao } from "@/lib/editor/extensoes";
import { ajustarAPalavras, localizarAncora, textoDoTrecho } from "@/lib/editor/ancoras";
import {
  avaliarVersao, confirmarLeitura, criarAnotacao, decidirSugestoes, descartarRascunho, enviarVersao, importarDocx, salvarRascunho,
} from "@/lib/actions/documentos";
import { formatarDataHora } from "@/lib/formatters";
import { Anotacoes, definirAnotacoes, posicoesAtuais, type AncoraVisual } from "./anotacoes-extension";
import { BarraFerramentas } from "./BarraFerramentas";
import { PainelAnotacoes, pedeAcao } from "./PainelAnotacoes";
import type { AnotacaoView, UsuarioEditor, VersaoView } from "./tipos";

type Selecao = { de: number; ate: number; trecho: string; x: number; y: number };
type Compositor = { tipo: TipoAnotacao; de: number; ate: number; trecho: string };
type EstadoSalvo = "salvo" | "pendente" | "salvando" | "erro";

function classeDe(a: AnotacaoView, ativa: boolean) {
  const base = a.tipo === "GRIFO" ? `anot anot-grifo-${a.cor ?? "amarelo"}` : `anot anot-${a.tipo.toLowerCase()}`;
  // Sugestão aceita continua riscada (o texto vai mudar); recusada volta a parecer texto normal.
  const apagada = a.tipo === "SUGESTAO" ? a.decisao === "RECUSADA" : a.resolvido;
  return `${base}${apagada ? " anot-resolvida" : ""}${ativa ? " anot-ativa" : ""}`;
}

/**
 * Troca cada trecho pela redação sugerida numa única transação (desfazível com Ctrl+Z). Aplica de
 * trás para frente para as posições das seguintes não mudarem; sugestões sobrepostas a uma já
 * aplicada ficam de fora. Devolve quais foram aplicadas e a posição da primeira no texto.
 */
function aplicarNoTexto(editor: Editor, lista: AnotacaoView[]) {
  const { state } = editor;
  const { schema } = state;
  const alvos = lista.map((a) => ({ a, pos: localizarAncora(state.doc, a.trecho, a.de, a.ate) }));
  const naoEncontradas = alvos.filter((x) => !x.pos).map((x) => x.a);
  const tr = state.tr;
  const aplicadas: AnotacaoView[] = [];
  const sobrepostas: AnotacaoView[] = [];
  let limite = Infinity;
  let primeira: { de: number; ate: number } | null = null;
  for (const { a, pos } of alvos.filter((x) => x.pos).sort((x, y) => y.pos!.de - x.pos!.de)) {
    const { de, ate } = pos!;
    if (ate > limite) { sobrepostas.push(a); continue; }
    const texto = a.sugestao ?? "";
    const linhas = texto.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    if (linhas.length === 0) tr.delete(de, ate);
    else if (linhas.length === 1) tr.insertText(linhas[0], de, ate);
    else tr.replaceRange(de, ate, new Slice(Fragment.fromArray(linhas.map((l) => schema.nodes.paragraph.create(null, schema.text(l)))), 1, 1));
    limite = de;
    aplicadas.push(a);
    primeira = { de, ate: de + (linhas.length === 1 ? linhas[0].length : 0) };
  }
  if (aplicadas.length) editor.view.dispatch(tr.scrollIntoView());
  return { aplicadas, falhas: [...naoEncontradas, ...sobrepostas], primeira };
}

export function VersaoDocumento({
  versao,
  ehUltimaEnviada,
  anteriores,
  versaoAnterior,
  usuario,
  tipoLabel,
  onIrParaRascunho,
  onEnviada,
}: {
  versao: VersaoView;
  ehUltimaEnviada: boolean;
  /** Apontamentos da versão enviada anterior — o que o CTP precisa endereçar neste rascunho. */
  anteriores: AnotacaoView[];
  versaoAnterior: number | null;
  usuario: UsuarioEditor;
  tipoLabel: string;
  /** CTP numa versão enviada: abre (ou cria) o rascunho da próxima versão para aplicar sugestões. */
  onIrParaRascunho?: () => void;
  /** Rascunho enviado. O aviso fica com quem chamou: este componente é recriado logo em seguida. */
  onEnviada?: (versao: number) => void;
}) {
  const isInterno = usuario.tipo === "INTERNO";
  const rascunho = !versao.enviadoEm;
  // Permissões do perfil: escrever (CTP), revisar e dar o parecer (prefeitura).
  const escreve = usuario.permissoes.includes("minuta.escrever");
  const revisa = usuario.permissoes.includes("minuta.revisar");
  const daParecer = usuario.permissoes.includes("minuta.parecer");
  const editavel = isInterno && rascunho && escreve;
  const precisaLer = !isInterno && !rascunho && !versao.lidaPorMim;
  const podeAnotar = rascunho ? editavel : ehUltimaEnviada && (isInterno || (versao.lidaPorMim && revisa));
  const tiposPermitidos: TipoAnotacao[] = rascunho ? ["COMENTARIO"] : isInterno ? ["GRIFO", "COMENTARIO"] : ["GRIFO", "COMENTARIO", "SUGESTAO", "CONCORDO", "DISCORDO"];
  const avaliacaoPendente = versao.avaliacao?.status === "PENDENTE";

  const [titulo, setTitulo] = useState(versao.titulo);
  const [selecao, setSelecao] = useState<Selecao | null>(null);
  const [compositor, setCompositor] = useState<Compositor | null>(null);
  const [textoCompositor, setTextoCompositor] = useState("");
  const [textoSugestao, setTextoSugestao] = useState("");
  const [ativaId, setAtivaId] = useState<string | null>(null);
  const [estadoSalvo, setEstadoSalvo] = useState<EstadoSalvo>("salvo");
  const [salvoEm, setSalvoEm] = useState(versao.atualizadoEm);
  const [aviso, setAviso] = useState<{ tipo: "erro" | "ok"; texto: string } | null>(null);
  const [dialogoEnviar, setDialogoEnviar] = useState(false);
  const [decisao, setDecisao] = useState<"APROVADO" | "REPROVADO" | null>(null);
  const [comentarioDecisao, setComentarioDecisao] = useState("");
  const [pendente, iniciar] = useTransition();
  const [telaCheia, setTelaCheia] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const tituloRef = useRef(titulo);
  const timerRef = useRef<number | undefined>(undefined);
  const filaRef = useRef<Promise<boolean>>(Promise.resolve(true));
  const conhecidasRef = useRef(new Set<string>());
  const salvarRef = useRef<() => Promise<boolean>>(async () => true);
  const agendarRef = useRef<() => void>(() => {});

  const mostrar = useCallback((texto: string, tipo: "erro" | "ok" = "erro") => {
    setAviso({ tipo, texto });
    window.setTimeout(() => setAviso((a) => (a?.texto === texto ? null : a)), 5000);
  }, []);

  const editor = useEditor({
    extensions: [
      ...extensoesDocumento,
      Placeholder.configure({ placeholder: "Comece a escrever o documento — ou importe um arquivo .docx pelo botão acima." }),
      Anotacoes,
    ],
    content: (versao.conteudo as object) ?? DOCUMENTO_VAZIO,
    editable: editavel,
    immediatelyRender: false,
    editorProps: { attributes: { class: "documento-conteudo", spellcheck: editavel ? "true" : "false" } },
    onUpdate: ({ transaction }) => {
      if (editavel && transaction.docChanged) agendarRef.current();
    },
  });

  /* ── Tela cheia: o documento ocupa a janela inteira, como no Word (Esc para sair) ── */
  useEffect(() => {
    if (!telaCheia) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("[role=dialog]")) setTelaCheia(false);
    };
    window.addEventListener("keydown", aoTeclar);
    return () => {
      document.body.style.overflow = anterior;
      window.removeEventListener("keydown", aoTeclar);
    };
  }, [telaCheia]);

  /* ── Salvamento automático do rascunho (fila: nunca dois salvamentos ao mesmo tempo) ── */
  useEffect(() => {
    salvarRef.current = async () => {
      if (!editor || !editavel) return true;
      window.clearTimeout(timerRef.current);
      const tarefa = filaRef.current.then(async () => {
        setEstadoSalvo("salvando");
        const r = await salvarRascunho(versao.id, JSON.stringify(editor.getJSON()), tituloRef.current, posicoesAtuais(editor));
        if (r.ok) {
          setEstadoSalvo("salvo");
          setSalvoEm(r.dados.salvoEm);
          return true;
        }
        setEstadoSalvo("erro");
        mostrar(r.erro);
        return false;
      });
      filaRef.current = tarefa.catch(() => false);
      return tarefa;
    };
    agendarRef.current = () => {
      setEstadoSalvo("pendente");
      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => void salvarRef.current(), 1500);
    };
  }, [editor, editavel, versao.id, mostrar]);

  useEffect(() => {
    if (!editavel) return;
    const aviso = (e: BeforeUnloadEvent) => {
      if (estadoSalvo === "pendente" || estadoSalvo === "salvando") e.preventDefault();
    };
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [editavel, estadoSalvo]);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  /* ── Desenha as anotações sobre o texto ── */
  useEffect(() => {
    if (!editor) return;
    const atuais = new Map(posicoesAtuais(editor).map((p) => [p.id, p]));
    const lista: AncoraVisual[] = [];
    for (const a of versao.anotacoes) {
      if (a.ate <= a.de) continue;
      let de = a.de;
      let ate = a.ate;
      if (editavel && conhecidasRef.current.has(a.id)) {
        // No rascunho a posição viva é a do editor (o texto pode ter mudado desde o último salvamento).
        const p = atuais.get(a.id);
        if (!p) continue; // trecho apagado durante a edição
        de = p.de;
        ate = p.ate;
      }
      conhecidasRef.current.add(a.id);
      const mostraProposta = a.tipo === "SUGESTAO" && a.decisao !== "RECUSADA";
      lista.push({ id: a.id, de, ate, classe: classeDe(a, a.id === ativaId), insercao: mostraProposta ? a.sugestao ?? "" : undefined });
    }
    if (compositor) lista.push({ id: "__novo", de: compositor.de, ate: compositor.ate, classe: "anot anot-nova" });
    definirAnotacoes(editor, lista);
  }, [editor, versao.anotacoes, ativaId, compositor, editavel]);

  /* ── Seleção de texto → menu flutuante ── */
  const capturarSelecao = useCallback(() => {
    if (!editor || !podeAnotar || compositor) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return setSelecao(null);
    const range = sel.getRangeAt(0);
    if (!editor.view.dom.contains(range.commonAncestorContainer)) return setSelecao(null);
    let de: number;
    let ate: number;
    try {
      de = editor.view.posAtDOM(range.startContainer, range.startOffset);
      ate = editor.view.posAtDOM(range.endContainer, range.endOffset);
    } catch {
      return setSelecao(null);
    }
    if (ate < de) [de, ate] = [ate, de];
    ({ de, ate } = ajustarAPalavras(editor.state.doc, de, ate));
    const trecho = textoDoTrecho(editor.state.doc, de, ate);
    if (!trecho || !canvasRef.current) return setSelecao(null);
    const r = range.getBoundingClientRect();
    const base = canvasRef.current.getBoundingClientRect();
    const x = Math.max(150, Math.min(r.left + r.width / 2 - base.left, base.width - 150));
    setSelecao({ de, ate, trecho, x, y: r.top - base.top });
  }, [editor, podeAnotar, compositor]);

  useEffect(() => {
    const limpar = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) setSelecao(null);
    };
    // No documento inteiro: quem arrasta a seleção costuma soltar o mouse fora da página.
    const aoSoltar = (e: MouseEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.("[data-menu-selecao]")) return;
      window.setTimeout(capturarSelecao, 0);
    };
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.shiftKey) capturarSelecao();
    };
    document.addEventListener("selectionchange", limpar);
    document.addEventListener("mouseup", aoSoltar);
    document.addEventListener("keyup", aoTeclar);
    return () => {
      document.removeEventListener("selectionchange", limpar);
      document.removeEventListener("mouseup", aoSoltar);
      document.removeEventListener("keyup", aoTeclar);
    };
  }, [capturarSelecao]);

  const criar = (tipo: TipoAnotacao, alvo: { de: number; ate: number; trecho: string }, extra: { cor?: string; texto?: string; sugestao?: string } = {}) =>
    iniciar(async () => {
      if (rascunho && !(await salvarRef.current())) return;
      const r = await criarAnotacao({ documentoId: versao.id, de: alvo.de, ate: alvo.ate, trecho: alvo.trecho, tipo, ...extra });
      if (!r.ok) return mostrar(r.erro);
      window.getSelection()?.removeAllRanges();
      setSelecao(null);
      setCompositor(null);
      setTextoCompositor("");
      setTextoSugestao("");
      setAtivaId(r.dados.id);
      mostrar(tipo === "SUGESTAO" ? "Sugestão enviada ao CTP." : `${TIPO_ANOTACAO_LABEL[tipo]} registrado.`, "ok");
    });

  const abrirCompositor = (tipo: TipoAnotacao) => {
    if (!selecao) return;
    setCompositor({ tipo, de: selecao.de, ate: selecao.ate, trecho: selecao.trecho });
    setTextoCompositor("");
    // A nova redação começa como cópia do trecho: o município só edita o que quer mudar.
    setTextoSugestao(tipo === "SUGESTAO" ? selecao.trecho : "");
    setSelecao(null);
  };

  const propostaSugestao = limparSugestao(textoSugestao);
  const sugestaoIgual = !!compositor && propostaSugestao.replace(/\s+/g, " ") === compositor.trecho;
  const enviarSugestao = (e: React.FormEvent) => {
    e.preventDefault();
    if (compositor && !sugestaoIgual) criar("SUGESTAO", compositor, { sugestao: propostaSugestao, texto: textoCompositor });
  };

  /* ── Sugestões de redação do município (aceitas aqui, no rascunho da próxima versão) ── */
  const aceitarSugestoes = (lista: AnotacaoView[]) =>
    iniciar(async () => {
      if (!editor || !editavel) return;
      const { aplicadas, falhas, primeira } = aplicarNoTexto(editor, lista);
      if (aplicadas.length === 0) {
        return mostrar("Não encontramos o trecho original no rascunho — ele já foi alterado. Aplique a redação manualmente e recuse ou reabra a sugestão.");
      }
      if (lista.length === 1 && primeira) editor.chain().focus().setTextSelection({ from: primeira.de, to: primeira.ate }).scrollIntoView().run();
      if (!(await salvarRef.current())) return;
      const r = await decidirSugestoes(aplicadas.map((a) => a.id), "ACEITA");
      if (!r.ok) return mostrar(r.erro);
      mostrar(
        falhas.length
          ? `${aplicadas.length} sugestão(ões) aplicada(s). ${falhas.length} não puderam ser aplicadas automaticamente (trecho já alterado) — faça manualmente.`
          : aplicadas.length === 1 ? "Sugestão aplicada no texto. Ctrl+Z desfaz." : `${aplicadas.length} sugestões aplicadas no texto.`,
        falhas.length ? "erro" : "ok",
      );
    });

  /* ── Ligação texto ⇄ painel ── */
  const ativar = (id: string) => {
    setAtivaId(id);
    const el = editor?.view.dom.querySelector(`[data-anotacao="${id}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  const aoClicarNoTexto = (e: React.MouseEvent) => {
    const alvo = (e.target as HTMLElement).closest("[data-anotacao]");
    const id = alvo?.getAttribute("data-anotacao");
    if (id && id !== "__novo") {
      setAtivaId(id);
      document.getElementById(`anotacao-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  };
  const localizarAnterior = (a: AnotacaoView) => {
    if (!editor) return;
    const pos = localizarAncora(editor.state.doc, a.trecho, a.de, a.ate);
    if (!pos) return mostrar("Esse trecho não existe mais no rascunho — provavelmente já foi alterado.");
    editor.chain().focus().setTextSelection({ from: pos.de, to: pos.ate }).scrollIntoView().run();
  };

  /* ── Ações do rascunho ── */
  const importar = (arquivo: File) =>
    iniciar(async () => {
      if (!editor) return;
      const fd = new FormData();
      fd.append("arquivo", arquivo);
      const r = await importarDocx(fd);
      if (!r.ok) return mostrar(r.erro);
      const estavaVazio = !editor.state.doc.textContent.trim();
      if (!estavaVazio && !confirm("Substituir todo o conteúdo atual pelo texto do arquivo importado?")) return;
      editor.commands.setContent(r.dados.html, { emitUpdate: true });
      // Documento novo: o nome do arquivo vira o título. Versão seguinte mantém o título herdado.
      if (estavaVazio) {
        const nome = arquivo.name.replace(/\.docx$/i, "").replace(/[_-]+/g, " ").trim();
        setTitulo(nome);
        tituloRef.current = nome;
      }
      mostrar(r.dados.avisos > 0 ? "Arquivo importado. Parte da formatação do Word foi simplificada." : "Arquivo importado.", "ok");
    });

  const enviar = () =>
    iniciar(async () => {
      if (!(await salvarRef.current())) return;
      const r = await enviarVersao(versao.id);
      setDialogoEnviar(false);
      if (!r.ok) return mostrar(r.erro);
      if (onEnviada) onEnviada(versao.versao);
      else mostrar("Versão enviada ao município.", "ok");
    });

  const descartar = () => {
    if (!confirm("Descartar este rascunho? Todo o conteúdo editado desde a última versão enviada será perdido.")) return;
    iniciar(async () => {
      window.clearTimeout(timerRef.current);
      const r = await descartarRascunho(versao.id);
      if (!r.ok) mostrar(r.erro);
    });
  };

  const confirmar = () =>
    iniciar(async () => {
      const r = await confirmarLeitura(versao.id);
      if (!r.ok) mostrar(r.erro);
    });

  const avaliar = () =>
    iniciar(async () => {
      if (!decisao) return;
      const r = await avaliarVersao(versao.id, decisao, comentarioDecisao);
      if (!r.ok) return mostrar(r.erro);
      setDecisao(null);
      mostrar(decisao === "APROVADO" ? "Versão aprovada. O CTP foi notificado." : "Pedido de ajustes enviado ao CTP.", "ok");
    });

  const abertosAnteriores = anteriores.filter((a) => pedeAcao(a) && !a.resolvido).length;

  return (
    <div className={telaCheia ? "fixed inset-0 z-40 grid grid-cols-[minmax(0,1fr)] overflow-y-auto bg-white xl:grid-cols-[minmax(0,1fr)_380px]" : "grid grid-cols-[minmax(0,1fr)] rounded-2xl border border-slate-200 bg-white xl:grid-cols-[minmax(0,1fr)_360px]"}>
      {/* ─────────── Área do documento ─────────── */}
      <div className="min-w-0 rounded-t-2xl bg-slate-100 xl:rounded-l-2xl xl:rounded-tr-none">
        {/* Faixa de estado + ações da versão */}
        <div className="flex flex-wrap items-center gap-2 rounded-t-2xl border-b border-slate-200 bg-white px-4 py-2.5 xl:rounded-tr-none">
          {rascunho ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
              <LockClosedIcon className="h-3.5 w-3.5" /> Rascunho v{versao.versao} · só o CTP vê
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
              <PaperAirplaneIcon className="h-3.5 w-3.5" /> Versão {versao.versao} · enviada em {formatarDataHora(new Date(versao.enviadoEm!))}
            </span>
          )}
          {editavel && (
            <span className="text-[11px] text-slate-400" aria-live="polite">
              {estadoSalvo === "salvando" ? "Salvando…" : estadoSalvo === "pendente" ? "Alterações não salvas" : estadoSalvo === "erro" ? <span className="text-red-600">Erro ao salvar</span> : <span suppressHydrationWarning>Salvo {new Date(salvoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>}
            </span>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setTelaCheia((v) => !v)}
              className="secondary-button min-h-8 px-2.5 py-1 text-xs"
              title={telaCheia ? "Sair da tela cheia (Esc)" : "Abrir o documento em tela cheia"}
            >
              {telaCheia ? <ArrowsPointingInIcon className="h-3.5 w-3.5" /> : <ArrowsPointingOutIcon className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{telaCheia ? "Sair da tela cheia" : "Tela cheia"}</span>
            </button>
            {editavel && (
              <>
                <label className={`secondary-button min-h-8 cursor-pointer px-2.5 py-1 text-xs ${pendente ? "pointer-events-none opacity-50" : ""}`} title="Carregar o texto de um arquivo Word (.docx)">
                  <ArrowUpTrayIcon className="h-3.5 w-3.5" /> Importar .docx
                  <input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) importar(f); }} />
                </label>
                <button type="button" onClick={descartar} className="secondary-button min-h-8 px-2.5 py-1 text-xs text-slate-500" title="Descartar rascunho"><TrashIcon className="h-3.5 w-3.5" /></button>
                <button type="button" disabled={pendente} onClick={() => setDialogoEnviar(true)} className="primary-button min-h-8 px-3 py-1 text-xs">
                  <PaperAirplaneIcon className="h-3.5 w-3.5" /> Enviar ao município
                </button>
              </>
            )}
            {!rascunho && (
              <>
                <a href={`/api/documentos/${versao.id}/docx`} className="secondary-button min-h-8 px-2.5 py-1 text-xs"><ArrowDownTrayIcon className="h-3.5 w-3.5" /> Word</a>
                <a href={`/documentos/${versao.id}/imprimir`} target="_blank" rel="noopener" className="secondary-button min-h-8 px-2.5 py-1 text-xs"><PrinterIcon className="h-3.5 w-3.5" /> PDF</a>
              </>
            )}
          </div>
        </div>

        {editavel && editor && <BarraFerramentas editor={editor} telaCheia={telaCheia} />}

        <div ref={canvasRef} className="relative px-2 py-4 sm:px-8 sm:py-10">
          <div className="mx-auto min-h-[900px] w-full max-w-[816px] rounded-sm bg-white px-5 py-8 shadow-[0_1px_3px_rgba(15,23,42,0.08),0_8px_24px_rgba(15,23,42,0.06)] sm:px-[72px] sm:py-[64px]">
            <p className="text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">{tipoLabel}</p>
            {editavel ? (
              <textarea
                aria-label="Título do documento"
                rows={1}
                value={titulo}
                onChange={(e) => { const v = e.target.value.replace(/\n/g, " "); setTitulo(v); tituloRef.current = v; agendarRef.current(); }}
                className="mt-2 w-full resize-none border-0 border-b border-transparent bg-transparent pb-1 text-center font-serif text-2xl font-bold leading-snug text-slate-900 outline-none transition-colors [field-sizing:content] hover:border-slate-200 focus:border-cyan-400"
              />
            ) : (
              <h2 className="mt-2 text-center font-serif text-2xl font-bold text-slate-900">{versao.titulo}</h2>
            )}
            {isInterno && !rascunho && (
              <p className="mt-1.5 flex items-center justify-center gap-1 text-[11px] text-slate-400">
                <EyeIcon className="h-3.5 w-3.5" />
                {versao.visualizacoes.length === 0 ? "Ainda não lida pelo município" : `Lida por ${versao.visualizacoes.map((v) => v.nome).join(", ")}`}
              </p>
            )}
            <hr className="mb-8 mt-5 border-slate-200" />

            {precisaLer && (
              <div className="mb-8 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-amber-900">Leitura obrigatória</p>
                  <p className="mt-0.5 text-xs leading-5 text-amber-800">Leia o documento abaixo e confirme. Depois disso você poderá grifar, comentar, concordar ou discordar de qualquer trecho.</p>
                </div>
                <button type="button" onClick={confirmar} disabled={pendente} className="primary-button shrink-0 text-xs"><CheckIcon className="h-4 w-4" /> Confirmar leitura</button>
              </div>
            )}

            <div onClick={aoClicarNoTexto}>
              <EditorContent editor={editor} />
            </div>
          </div>

          {/* Menu que aparece ao selecionar um trecho */}
          {selecao && (
            <div
              className="absolute z-30 flex -translate-x-1/2 -translate-y-full items-center gap-0.5 rounded-xl border border-slate-200 bg-white p-1 shadow-xl"
              style={{ left: selecao.x, top: selecao.y - 8 }}
              data-menu-selecao
              onMouseDown={(e) => e.preventDefault()}
            >
              {tiposPermitidos.includes("GRIFO") && (
                <div className="flex items-center gap-1 border-r border-slate-100 px-1.5">
                  {CORES_GRIFO.map((c) => (
                    <button key={c.chave} type="button" title={`Grifar em ${c.nome.toLowerCase()}`} aria-label={`Grifar em ${c.nome.toLowerCase()}`} onClick={() => criar("GRIFO", selecao, { cor: c.chave })} className="h-5 w-5 rounded-full ring-1 ring-black/10 transition-transform hover:scale-125" style={{ backgroundColor: c.hex }} />
                  ))}
                </div>
              )}
              {tiposPermitidos.includes("COMENTARIO") && (
                <button type="button" onClick={() => abrirCompositor("COMENTARIO")} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-cyan-50 hover:text-cyan-800">
                  <ChatBubbleLeftEllipsisIcon className="h-4 w-4" /> {rascunho ? "Nota" : "Comentar"}
                </button>
              )}
              {tiposPermitidos.includes("SUGESTAO") && (
                <button type="button" onClick={() => abrirCompositor("SUGESTAO")} title="Propor uma nova redação para este trecho" className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-50">
                  <PencilSquareIcon className="h-4 w-4" /> Sugerir redação
                </button>
              )}
              {tiposPermitidos.includes("CONCORDO") && (
                <button type="button" onClick={() => criar("CONCORDO", selecao)} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50">
                  <HandThumbUpIcon className="h-4 w-4" /> Concordo
                </button>
              )}
              {tiposPermitidos.includes("DISCORDO") && (
                <button type="button" onClick={() => abrirCompositor("DISCORDO")} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50">
                  <HandThumbDownIcon className="h-4 w-4" /> Discordo
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─────────── Painel lateral ─────────── */}
      <aside className={`min-w-0 border-t border-slate-200 p-4 xl:sticky xl:self-start xl:overflow-y-auto xl:border-l xl:border-t-0 ${telaCheia ? "xl:top-0 xl:max-h-screen" : "xl:top-16 xl:max-h-[calc(100vh-4rem)]"}`}>
        {compositor?.tipo === "SUGESTAO" && (
            <form
              className="mb-4 rounded-xl border-2 border-violet-200 bg-violet-50/40 p-3.5"
              onSubmit={enviarSugestao}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-800">Sugerir nova redação</p>
                <button type="button" aria-label="Cancelar" onClick={() => setCompositor(null)} className="rounded p-0.5 text-slate-400 hover:bg-white hover:text-slate-700"><XMarkIcon className="h-4 w-4" /></button>
              </div>
              <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-red-500">Texto atual</p>
              <p className="mt-0.5 line-clamp-4 rounded-md bg-red-50 px-2 py-1 font-serif text-xs leading-5 text-red-800 line-through decoration-red-300">{compositor.trecho}</p>
              <label className="mt-2.5 block text-[10px] font-bold uppercase tracking-wide text-emerald-700" htmlFor="nova-redacao">Nova redação</label>
              <textarea
                id="nova-redacao"
                autoFocus
                value={textoSugestao}
                onChange={(e) => setTextoSugestao(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) e.currentTarget.form?.requestSubmit(); }}
                rows={Math.min(8, Math.max(3, Math.ceil(textoSugestao.length / 45)))}
                className="form-control mt-1 font-serif text-sm leading-6"
              />
              <p className="mt-1 text-[10px] leading-4 text-slate-400">{propostaSugestao ? "Edite o texto como ele deve ficar. O CTP aceita ou recusa na próxima versão." : "Texto em branco: você está sugerindo suprimir este trecho."}</p>
              <label className="mt-2.5 block text-[10px] font-bold uppercase tracking-wide text-slate-500" htmlFor="justificativa">Justificativa <span className="font-normal normal-case tracking-normal text-slate-400">(opcional)</span></label>
              <textarea id="justificativa" value={textoCompositor} onChange={(e) => setTextoCompositor(e.target.value)} rows={2} placeholder="Por que mudar? Ex.: adequar à Lei Orgânica, art. 12." className="form-control mt-1 text-sm" />
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-[10px] text-slate-400">{sugestaoIgual ? "Altere o texto para enviar." : "Ctrl + Enter para enviar"}</span>
                <button type="submit" disabled={pendente || sugestaoIgual} className="primary-button min-h-8 bg-violet-600 px-3 py-1 text-xs hover:bg-violet-700">Enviar sugestão</button>
              </div>
            </form>
        )}

        {compositor && compositor.tipo !== "SUGESTAO" && (
          <form
            className={`mb-4 rounded-xl border-2 p-3.5 ${compositor.tipo === "DISCORDO" ? "border-red-200 bg-red-50/40" : "border-cyan-200 bg-cyan-50/40"}`}
            onSubmit={(e) => { e.preventDefault(); criar(compositor.tipo, compositor, { texto: textoCompositor }); }}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-800">{compositor.tipo === "DISCORDO" ? "Por que discorda?" : rascunho ? "Nota para o município" : "Novo comentário"}</p>
              <button type="button" aria-label="Cancelar" onClick={() => setCompositor(null)} className="rounded p-0.5 text-slate-400 hover:bg-white hover:text-slate-700"><XMarkIcon className="h-4 w-4" /></button>
            </div>
            <blockquote className="mt-2 line-clamp-3 border-l-2 border-slate-300 pl-2.5 font-serif text-xs italic text-slate-600">“{compositor.trecho}”</blockquote>
            <textarea
              autoFocus
              required
              value={textoCompositor}
              onChange={(e) => setTextoCompositor(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) e.currentTarget.form?.requestSubmit(); }}
              rows={3}
              placeholder={compositor.tipo === "DISCORDO" ? "Explique o que deve mudar neste trecho…" : "Escreva seu comentário…"}
              className="form-control mt-2.5 text-sm"
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[10px] text-slate-400">Ctrl + Enter para enviar</span>
              <button type="submit" disabled={pendente || !textoCompositor.trim()} className="primary-button min-h-8 px-3 py-1 text-xs">Registrar</button>
            </div>
          </form>
        )}

        {/* Avaliação da versão inteira */}
        {!rascunho && versao.avaliacao && (
          <section className={`mb-5 rounded-xl border p-3.5 ${versao.avaliacao.status === "APROVADO" ? "border-emerald-200 bg-emerald-50/60" : versao.avaliacao.status === "REPROVADO" ? "border-red-200 bg-red-50/50" : "border-slate-200 bg-slate-50"}`}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Avaliação desta versão</p>
            {avaliacaoPendente ? (
              !isInterno && daParecer && ehUltimaEnviada && versao.lidaPorMim ? (
                decisao ? (
                  <div className="mt-2">
                    <p className="text-sm font-semibold text-slate-800">{decisao === "APROVADO" ? "Aprovar a versão inteira" : "Solicitar ajustes ao CTP"}</p>
                    <textarea value={comentarioDecisao} onChange={(e) => setComentarioDecisao(e.target.value)} rows={3} className="form-control mt-2 text-sm" placeholder={decisao === "APROVADO" ? "Observação (opcional)" : "Resuma os ajustes necessários (obrigatório)"} />
                    <div className="mt-2 flex justify-end gap-1.5">
                      <button type="button" onClick={() => setDecisao(null)} className="secondary-button min-h-8 px-2.5 py-1 text-xs">Voltar</button>
                      <button type="button" disabled={pendente || (decisao === "REPROVADO" && !comentarioDecisao.trim())} onClick={avaliar} className={`primary-button min-h-8 px-3 py-1 text-xs ${decisao === "REPROVADO" ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"}`}>Confirmar</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="mt-1 text-xs leading-5 text-slate-600">Depois de grifar e comentar o que precisar, dê seu parecer sobre a versão.</p>
                    <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                      <button type="button" onClick={() => setDecisao("APROVADO")} className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-600 px-2 py-2 text-xs font-semibold text-white hover:bg-emerald-700"><CheckCircleIcon className="h-4 w-4" /> Aprovar</button>
                      <button type="button" onClick={() => setDecisao("REPROVADO")} className="inline-flex items-center justify-center gap-1 rounded-lg border border-red-200 bg-white px-2 py-2 text-xs font-semibold text-red-600 hover:bg-red-50">Pedir ajustes</button>
                    </div>
                  </>
                )
              ) : (
                <p className="mt-1 text-sm font-semibold text-slate-700">{ehUltimaEnviada ? "Aguardando parecer do município" : "Substituída por uma versão mais nova"}</p>
              )
            ) : (
              <>
                <p className={`mt-1 text-sm font-semibold ${versao.avaliacao.status === "APROVADO" ? "text-emerald-800" : "text-red-700"}`}>
                  {versao.avaliacao.status === "APROVADO" ? "Aprovada" : "Ajustes solicitados"} <span className="font-normal text-slate-500">por {versao.avaliacao.autor}</span>
                </p>
                {versao.avaliacao.comentario && <p className="mt-1.5 whitespace-pre-wrap text-xs leading-5 text-slate-700">{versao.avaliacao.comentario}</p>}
              </>
            )}
          </section>
        )}

        {rascunho && anteriores.length > 0 && (
          <section className="mb-6">
            <h3 className="mb-1 text-sm font-semibold text-slate-900">Apontamentos da versão {versaoAnterior}</h3>
            <p className="mb-3 text-xs leading-5 text-slate-500">{abertosAnteriores > 0 ? `${abertosAnteriores} ponto(s) pendente(s). Ajuste o texto e resolva cada comentário; sugestões de redação podem ser aceitas com um clique.` : "Nenhum ponto pendente — os demais são grifos e concordâncias."}</p>
            <PainelAnotacoes
              anotacoes={anteriores}
              usuario={usuario}
              ativaId={null}
              podeResponder
              onAtivar={() => {}}
              onLocalizar={localizarAnterior}
              onErro={mostrar}
              vazio="Nenhum apontamento na versão anterior."
              sugestoes={{ aceitar: (a) => aceitarSugestoes([a]) }}
              onAceitarTodas={aceitarSugestoes}
            />
          </section>
        )}

        <section>
          <h3 className="mb-1 text-sm font-semibold text-slate-900">{rascunho ? "Notas do CTP neste rascunho" : "Grifos e comentários"}</h3>
          <p className="mb-3 text-xs leading-5 text-slate-500">
            {rascunho
              ? "Selecione um trecho do texto para deixar uma nota que o município verá junto com esta versão."
              : precisaLer
                ? "Confirme a leitura para começar a anotar."
                : podeAnotar
                  ? isInterno
                    ? "Selecione qualquer trecho do documento para grifar ou comentar."
                    : "Selecione qualquer trecho para grifar, comentar, sugerir outra redação, concordar ou discordar."
                  : "Histórico desta versão."}
          </p>
          <PainelAnotacoes
            anotacoes={versao.anotacoes}
            usuario={usuario}
            ativaId={ativaId}
            podeResponder={isInterno || (versao.lidaPorMim && revisa)}
            onAtivar={ativar}
            onErro={mostrar}
            vazio={rascunho ? "Nenhuma nota ainda." : "Nenhum grifo ou comentário nesta versão."}
            sugestoes={!rascunho && ehUltimaEnviada && onIrParaRascunho ? { irParaRascunho: onIrParaRascunho } : undefined}
          />
        </section>
      </aside>

      {/* Confirmação de envio */}
      {dialogoEnviar && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="titulo-enviar">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-cyan-50 text-cyan-700"><CloudArrowUpIcon className="h-6 w-6" /></span>
            <h3 id="titulo-enviar" className="mt-4 text-lg font-bold text-slate-900">Enviar versão {versao.versao} ao município?</h3>
            <ul className="mt-3 space-y-1.5 text-sm leading-6 text-slate-600">
              <li>• O texto fica congelado — ajustes posteriores vão para uma nova versão.</li>
              <li>• O município é notificado e precisa confirmar a leitura.</li>
              <li>• A etapa passa para <strong>Aguardando município</strong>.</li>
              {abertosAnteriores > 0 && <li className="text-amber-700">• Ainda há {abertosAnteriores} ponto(s) pendente(s) da versão anterior.</li>}
            </ul>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setDialogoEnviar(false)} className="secondary-button">Cancelar</button>
              <button type="button" onClick={enviar} disabled={pendente} className="primary-button"><PaperAirplaneIcon className="h-4 w-4" />{pendente ? "Enviando…" : "Enviar"}</button>
            </div>
          </div>
        </div>
      )}

      {aviso && (
        <div role="status" className={`fixed bottom-5 right-5 z-50 max-w-sm rounded-xl px-4 py-3 text-sm font-medium shadow-xl ${aviso.tipo === "erro" ? "bg-red-600 text-white" : "bg-slate-900 text-white"}`}>
          {aviso.texto}
        </div>
      )}
    </div>
  );
}
