import type { DecisaoSugestao, TipoAnotacao } from "@/lib/editor/extensoes";

// Formas serializáveis que o servidor (EtapaPanel) entrega ao editor no navegador.

export type PessoaView = { id: string; nome: string; tipo: string };

/** Quem está usando o editor, com as permissões do perfil (ver src/lib/permissoes.ts). */
export type UsuarioEditor = { id: string; nome: string; tipo: string; permissoes: readonly string[] };

export type RespostaView = { id: string; autor: PessoaView; texto: string; criadoEm: string };

export type AnotacaoView = {
  id: string;
  autor: PessoaView;
  de: number;
  ate: number;
  trecho: string;
  tipo: TipoAnotacao;
  cor: string | null;
  texto: string | null;
  /** Só SUGESTAO: redação proposta ("" = suprimir o trecho) e o que o CTP decidiu. */
  sugestao: string | null;
  decisao: DecisaoSugestao | null;
  resolvido: boolean;
  resolvidoPor: string | null;
  criadoEm: string;
  respostas: RespostaView[];
};

export type VersaoView = {
  id: string;
  versao: number;
  titulo: string;
  /** JSON do editor; nulo em versões antigas, anteriores ao editor (só arquivo anexado). */
  conteudo: unknown | null;
  enviadoEm: string | null;
  atualizadoEm: string;
  criadoPor: string;
  arquivoLegado: { nome: string; url: string } | null;
  avaliacao: { status: string; comentario: string | null; autor: string } | null;
  visualizacoes: { nome: string; em: string }[];
  lidaPorMim: boolean;
  anotacoes: AnotacaoView[];
};

type NoJSON = { type?: string; text?: string; content?: NoJSON[] };

/** Texto corrido do documento (blocos separados por linha em branco), para comparar versões. */
export function textoDoConteudo(conteudo: unknown): string {
  const blocos: string[] = [];
  const visitar = (no: NoJSON) => {
    if (!no) return;
    const ehBloco = no.type === "paragraph" || no.type === "heading" || no.type === "tableCell" || no.type === "tableHeader";
    if (ehBloco) {
      const juntar = (n: NoJSON): string => (n.text ?? "") + (n.type === "hardBreak" ? "\n" : "") + (n.content ?? []).map(juntar).join("");
      const t = juntar(no).trim();
      if (t) blocos.push(t);
      return;
    }
    (no.content ?? []).forEach(visitar);
  };
  visitar(conteudo as NoJSON);
  return blocos.join("\n\n");
}
