"use client";

import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { PrinterIcon } from "@heroicons/react/24/outline";
import { extensoesDocumento, CORES_GRIFO, TIPO_ANOTACAO_LABEL, DOCUMENTO_VAZIO } from "@/lib/editor/extensoes";
import { Anotacoes, definirAnotacoes } from "./anotacoes-extension";
import type { AnotacaoView } from "./tipos";

/** Versão para impressão / "Salvar como PDF": página limpa, grifos numerados e comentários ao final. */
export function ImpressaoDocumento({
  conteudo,
  titulo,
  cabecalho,
  anotacoes,
}: {
  conteudo: unknown;
  titulo: string;
  cabecalho: string;
  anotacoes: AnotacaoView[];
}) {
  const editor = useEditor({
    extensions: [...extensoesDocumento, Anotacoes],
    content: (conteudo as object) ?? DOCUMENTO_VAZIO,
    editable: false,
    immediatelyRender: false,
    editorProps: { attributes: { class: "documento-conteudo" } },
  });

  const numeradas = anotacoes.filter((a) => a.ate > a.de && (a.texto || a.tipo !== "GRIFO")).sort((x, y) => x.de - y.de);

  useEffect(() => {
    if (!editor) return;
    definirAnotacoes(
      editor,
      anotacoes
        .filter((a) => a.ate > a.de)
        .map((a) => {
          const n = numeradas.indexOf(a);
          return {
            id: a.id,
            de: a.de,
            ate: a.ate,
            classe: a.tipo === "GRIFO"
              ? `anot anot-grifo-${a.cor ?? "amarelo"}`
              : `anot anot-${a.tipo.toLowerCase()}${(a.tipo === "SUGESTAO" ? a.decisao === "RECUSADA" : a.resolvido) ? " anot-resolvida" : ""}`,
            marcador: n >= 0 ? String(n + 1) : undefined,
          };
        }),
    );
    const t = window.setTimeout(() => window.print(), 600);
    return () => window.clearTimeout(t);
    // numeradas deriva de anotacoes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, anotacoes]);

  return (
    <div className="min-h-screen bg-slate-100 py-8 print:bg-white print:py-0">
      <div className="nao-imprimir mx-auto mb-4 flex max-w-[816px] items-center justify-between px-4">
        <p className="text-sm text-slate-500">Use “Salvar como PDF” na janela de impressão para gerar o arquivo.</p>
        <button type="button" onClick={() => window.print()} className="primary-button"><PrinterIcon className="h-4 w-4" /> Imprimir / PDF</button>
      </div>
      <article className="mx-auto max-w-[816px] bg-white px-[72px] py-16 shadow-sm print:max-w-none print:p-0 print:shadow-none">
        <p className="text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">{cabecalho}</p>
        <h1 className="mt-2 text-center font-serif text-2xl font-bold text-slate-900">{titulo}</h1>
        <hr className="mb-8 mt-5 border-slate-200" />
        <EditorContent editor={editor} />

        {numeradas.length > 0 && (
          <section className="mt-12 break-before-page border-t border-slate-300 pt-6">
            <h2 className="font-serif text-lg font-bold text-slate-900">Grifos e comentários</h2>
            <ol className="mt-4 space-y-4">
              {numeradas.map((a, i) => (
                <li key={a.id} className="break-inside-avoid text-sm leading-6">
                  <p className="font-semibold text-slate-900">
                    {i + 1}. {a.tipo === "GRIFO" ? `Grifo ${CORES_GRIFO.find((c) => c.chave === a.cor)?.nome.toLowerCase() ?? ""}` : TIPO_ANOTACAO_LABEL[a.tipo]} — {a.autor.nome}
                    <span className="font-normal text-slate-500"> ({a.autor.tipo === "INTERNO" ? "CTP" : "Município"}, {new Date(a.criadoEm).toLocaleDateString("pt-BR")}){a.resolvido ? " · resolvido" : ""}</span>
                  </p>
                  <p className="font-serif italic text-slate-600">“{a.trecho}”</p>
                  {a.tipo === "SUGESTAO" && (
                    <p className="text-slate-800">
                      <span className="font-semibold">Redação proposta:</span> {a.sugestao ? `“${a.sugestao}”` : "suprimir o trecho"}
                      {a.decisao && <span className="text-slate-500"> — {a.decisao === "ACEITA" ? "aceita pelo CTP" : "não aceita pelo CTP"}</span>}
                    </p>
                  )}
                  {a.texto && <p className="text-slate-800">{a.tipo === "SUGESTAO" ? <span className="font-semibold">Justificativa: </span> : null}{a.texto}</p>}
                  {a.respostas.map((r) => (
                    <p key={r.id} className="ml-4 text-slate-700"><span className="font-semibold">↳ {r.autor.nome}:</span> {r.texto}</p>
                  ))}
                </li>
              ))}
            </ol>
          </section>
        )}
      </article>
    </div>
  );
}
