import { Extension, type Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/**
 * Camada de anotações por cima do texto: cada grifo/comentário é uma decoração (não altera o
 * documento). Quando o CTP edita o rascunho, `DecorationSet.map` desloca as decorações junto com
 * o texto, então a âncora continua no trecho certo; as posições atualizadas são lidas com
 * `posicoesAtuais` e gravadas no salvamento automático.
 */

/**
 * `marcador` (opcional) desenha um número sobrescrito ao fim do trecho — usado na impressão.
 * `insercao` (opcional) mostra, logo depois do trecho, o texto proposto numa sugestão de redação,
 * como no "controlar alterações" do Word: trecho atual riscado, texto novo sublinhado em verde.
 */
export type AncoraVisual = { id: string; de: number; ate: number; classe: string; marcador?: string; insercao?: string };

export const anotacoesKey = new PluginKey<DecorationSet>("anotacoes");

function construir(doc: Parameters<typeof DecorationSet.create>[0], lista: AncoraVisual[]) {
  const max = doc.content.size;
  return DecorationSet.create(
    doc,
    lista
      .filter((a) => a.ate > a.de && a.de >= 0 && a.ate <= max)
      .flatMap((a) => {
        const decos = [Decoration.inline(a.de, a.ate, { class: a.classe, "data-anotacao": a.id }, { id: a.id })];
        if (a.insercao !== undefined) {
          decos.push(
            Decoration.widget(a.ate, () => {
              const ins = document.createElement("ins");
              ins.className = a.insercao ? "anot-insercao" : "anot-insercao anot-insercao-vazia";
              ins.textContent = a.insercao || "suprimir";
              ins.setAttribute("data-anotacao", a.id);
              ins.contentEditable = "false";
              return ins;
            }, { side: 1, id: `${a.id}-insercao`, ignoreSelection: true, key: `${a.id}-ins-${a.insercao}` }),
          );
        }
        if (a.marcador) {
          decos.push(
            Decoration.widget(a.ate, () => {
              const sup = document.createElement("sup");
              sup.className = "anot-marcador";
              sup.textContent = a.marcador!;
              return sup;
            }, { side: 1, id: `${a.id}-marcador`, ignoreSelection: true }),
          );
        }
        return decos;
      }),
  );
}

export const Anotacoes = Extension.create({
  name: "anotacoes",
  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: anotacoesKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, set) {
            const nova = tr.getMeta(anotacoesKey) as AncoraVisual[] | undefined;
            if (nova) return construir(tr.doc, nova);
            return tr.docChanged ? set.map(tr.mapping, tr.doc) : set;
          },
        },
        props: {
          decorations(state) {
            return anotacoesKey.getState(state);
          },
        },
      }),
    ];
  },
});

export function definirAnotacoes(editor: Editor, lista: AncoraVisual[]) {
  if (editor.isDestroyed) return;
  editor.view.dispatch(editor.state.tr.setMeta(anotacoesKey, lista).setMeta("addToHistory", false));
}

/** Posições atuais (já deslocadas pelas edições) de cada anotação desenhada. */
export function posicoesAtuais(editor: Editor): { id: string; de: number; ate: number }[] {
  const set = anotacoesKey.getState(editor.state);
  if (!set) return [];
  const porId = new Map<string, { id: string; de: number; ate: number }>();
  for (const d of set.find()) {
    if (d.from === d.to) continue; // widgets (marcador, texto sugerido) não são âncoras
    const id = (d.spec as { id: string }).id;
    const atual = porId.get(id);
    // Uma decoração pode ter sido partida em duas por uma edição no meio; junta de volta.
    porId.set(id, atual ? { id, de: Math.min(atual.de, d.from), ate: Math.max(atual.ate, d.to) } : { id, de: d.from, ate: d.to });
  }
  return [...porId.values()];
}
