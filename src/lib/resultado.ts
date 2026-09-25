import { unstable_rethrow } from "next/navigation";
import { AcessoNegadoError, SessaoInvalidaError } from "@/lib/tenant";

/**
 * Resultado de server action chamada por formulário no navegador.
 *
 * Em build de produção o Next/React substitui a mensagem de qualquer erro LANÇADO por uma server
 * action ("Minified React error #441…"), então uma validação como "Selecione ao menos um setor"
 * nunca chegava ao usuário. Erros esperados precisam voltar como valor — ver
 * node_modules/next/dist/docs/01-app/01-getting-started/10-error-handling.md.
 */
export type Resultado<T = undefined> = { ok: true; dados: T } | { ok: false; erro: string };

/** Erro com mensagem pensada para o usuário final. */
export class ErroUsuario extends Error {}

const ERRO_GENERICO = "Não foi possível concluir a operação. Recarregue a página e tente novamente.";

/**
 * Executa a ação e converte erros de validação (`new Error("…")`, ErroUsuario, acesso negado)
 * em `{ ok: false, erro }`. `redirect()`/`notFound()` do Next continuam funcionando
 * (unstable_rethrow), e erros inesperados (banco, bug) viram mensagem genérica + log no servidor.
 */
export async function capturar<T>(fn: () => Promise<T>): Promise<Resultado<T>> {
  try {
    return { ok: true, dados: await fn() };
  } catch (e) {
    unstable_rethrow(e);
    const ehValidacao =
      e instanceof ErroUsuario ||
      e instanceof AcessoNegadoError ||
      e instanceof SessaoInvalidaError ||
      (e instanceof Error && Object.getPrototypeOf(e) === Error.prototype);
    if (ehValidacao) return { ok: false, erro: (e as Error).message };
    console.error("[acao]", e);
    return { ok: false, erro: ERRO_GENERICO };
  }
}
