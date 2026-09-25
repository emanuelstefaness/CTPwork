"use client";

import { useState, type ReactNode } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import {
  ArrowUturnLeftIcon, ArrowUturnRightIcon, Bars3BottomLeftIcon, Bars3BottomRightIcon, Bars3CenterLeftIcon,
  Bars3Icon, BoldIcon, ItalicIcon, ListBulletIcon, MinusIcon, NoSymbolIcon, NumberedListIcon,
  StrikethroughIcon, TableCellsIcon, UnderlineIcon,
} from "@heroicons/react/24/outline";
import { CORES_GRIFO } from "@/lib/editor/extensoes";

function Botao({ ativo, desabilitado, titulo, onClick, children }: { ativo?: boolean; desabilitado?: boolean; titulo: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      aria-pressed={ativo}
      disabled={desabilitado}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`grid h-8 min-w-8 place-items-center rounded-md px-1.5 text-slate-600 transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
        ativo ? "bg-cyan-100 text-cyan-900" : "hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      {children}
    </button>
  );
}

const Separador = () => <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden />;

/** Barra de formatação do rascunho — o equivalente à faixa "Página Inicial" do Word. */
export function BarraFerramentas({ editor, telaCheia = false }: { editor: Editor; telaCheia?: boolean }) {
  const [menuGrifo, setMenuGrifo] = useState(false);
  const [menuTabela, setMenuTabela] = useState(false);

  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      estilo: e.isActive("heading", { level: 1 }) ? "h1" : e.isActive("heading", { level: 2 }) ? "h2" : e.isActive("heading", { level: 3 }) ? "h3" : "p",
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      grifo: e.isActive("highlight"),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      left: e.isActive({ textAlign: "left" }),
      center: e.isActive({ textAlign: "center" }),
      right: e.isActive({ textAlign: "right" }),
      justify: e.isActive({ textAlign: "justify" }),
      tabela: e.isActive("table"),
      podeDesfazer: e.can().undo(),
      podeRefazer: e.can().redo(),
    }),
  });

  const c = () => editor.chain().focus();

  return (
    <div className={`sticky ${telaCheia ? "top-0" : "top-16"} z-20 flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-white/95 px-3 py-1.5 backdrop-blur`} role="toolbar" aria-label="Formatação do documento">
      <Botao titulo="Desfazer (Ctrl+Z)" desabilitado={!s.podeDesfazer} onClick={() => c().undo().run()}><ArrowUturnLeftIcon className="h-4 w-4" /></Botao>
      <Botao titulo="Refazer (Ctrl+Y)" desabilitado={!s.podeRefazer} onClick={() => c().redo().run()}><ArrowUturnRightIcon className="h-4 w-4" /></Botao>
      <Separador />
      <select
        aria-label="Estilo do parágrafo"
        value={s.estilo}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "p") c().setParagraph().run();
          else c().setHeading({ level: Number(v.slice(1)) as 1 | 2 | 3 }).run();
        }}
        className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 focus:border-cyan-400 focus:outline-none"
      >
        <option value="p">Texto normal</option>
        <option value="h1">Título 1</option>
        <option value="h2">Título 2</option>
        <option value="h3">Título 3</option>
      </select>
      <Separador />
      <Botao titulo="Negrito (Ctrl+B)" ativo={s.bold} onClick={() => c().toggleBold().run()}><BoldIcon className="h-4 w-4" /></Botao>
      <Botao titulo="Itálico (Ctrl+I)" ativo={s.italic} onClick={() => c().toggleItalic().run()}><ItalicIcon className="h-4 w-4" /></Botao>
      <Botao titulo="Sublinhado (Ctrl+U)" ativo={s.underline} onClick={() => c().toggleUnderline().run()}><UnderlineIcon className="h-4 w-4" /></Botao>
      <Botao titulo="Tachado" ativo={s.strike} onClick={() => c().toggleStrike().run()}><StrikethroughIcon className="h-4 w-4" /></Botao>

      <div className="relative">
        <Botao titulo="Marca-texto (grifo no documento)" ativo={s.grifo} onClick={() => setMenuGrifo((v) => !v)}>
          <span className="flex items-center gap-1 text-xs font-bold">
            <span className="rounded-sm bg-amber-200 px-1 leading-4">ab</span>▾
          </span>
        </Botao>
        {menuGrifo && (
          <div className="absolute left-0 top-9 z-30 flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg" onMouseLeave={() => setMenuGrifo(false)}>
            {CORES_GRIFO.map((cor) => (
              <button
                key={cor.chave}
                type="button"
                title={cor.nome}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { c().setHighlight({ color: cor.hex }).run(); setMenuGrifo(false); }}
                className="h-6 w-6 rounded-md ring-1 ring-inset ring-black/10 transition-transform hover:scale-110"
                style={{ backgroundColor: cor.hex }}
              />
            ))}
            <button type="button" title="Remover grifo" onMouseDown={(e) => e.preventDefault()} onClick={() => { c().unsetHighlight().run(); setMenuGrifo(false); }} className="grid h-6 w-6 place-items-center rounded-md text-slate-500 hover:bg-slate-100">
              <NoSymbolIcon className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <Separador />
      <Botao titulo="Alinhar à esquerda" ativo={s.left} onClick={() => c().setTextAlign("left").run()}><Bars3BottomLeftIcon className="h-4 w-4" /></Botao>
      <Botao titulo="Centralizar" ativo={s.center} onClick={() => c().setTextAlign("center").run()}><Bars3Icon className="h-4 w-4" /></Botao>
      <Botao titulo="Alinhar à direita" ativo={s.right} onClick={() => c().setTextAlign("right").run()}><Bars3BottomRightIcon className="h-4 w-4" /></Botao>
      <Botao titulo="Justificar" ativo={s.justify} onClick={() => c().setTextAlign("justify").run()}><Bars3CenterLeftIcon className="h-4 w-4" /></Botao>
      <Separador />
      <Botao titulo="Lista com marcadores" ativo={s.bullet} onClick={() => c().toggleBulletList().run()}><ListBulletIcon className="h-4 w-4" /></Botao>
      <Botao titulo="Lista numerada" ativo={s.ordered} onClick={() => c().toggleOrderedList().run()}><NumberedListIcon className="h-4 w-4" /></Botao>
      <Botao titulo="Citação" ativo={s.quote} onClick={() => c().toggleBlockquote().run()}><span className="font-serif text-base font-bold leading-none">“</span></Botao>
      <Botao titulo="Linha horizontal" onClick={() => c().setHorizontalRule().run()}><MinusIcon className="h-4 w-4" /></Botao>

      <div className="relative">
        <Botao titulo="Tabela" ativo={s.tabela} onClick={() => setMenuTabela((v) => !v)}><TableCellsIcon className="h-4 w-4" /></Botao>
        {menuTabela && (
          <div className="absolute left-0 top-9 z-30 flex w-48 flex-col rounded-lg border border-slate-200 bg-white p-1 text-xs shadow-lg" onMouseLeave={() => setMenuTabela(false)}>
            {!s.tabela ? (
              <button type="button" className="rounded-md px-2.5 py-1.5 text-left hover:bg-slate-100" onClick={() => { c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); setMenuTabela(false); }}>Inserir tabela 3 × 3</button>
            ) : (
              [
                ["Linha acima", () => c().addRowBefore().run()],
                ["Linha abaixo", () => c().addRowAfter().run()],
                ["Coluna à esquerda", () => c().addColumnBefore().run()],
                ["Coluna à direita", () => c().addColumnAfter().run()],
                ["Excluir linha", () => c().deleteRow().run()],
                ["Excluir coluna", () => c().deleteColumn().run()],
                ["Excluir tabela", () => c().deleteTable().run()],
              ].map(([rotulo, acao]) => (
                <button key={rotulo as string} type="button" className={`rounded-md px-2.5 py-1.5 text-left hover:bg-slate-100 ${(rotulo as string).startsWith("Excluir") ? "text-red-600" : ""}`} onClick={() => { (acao as () => void)(); setMenuTabela(false); }}>
                  {rotulo as string}
                </button>
              ))
            )}
          </div>
        )}
      </div>
      <Separador />
      <Botao titulo="Limpar formatação" onClick={() => c().unsetAllMarks().clearNodes().run()}><span className="text-xs font-semibold">Tx</span></Botao>
    </div>
  );
}
