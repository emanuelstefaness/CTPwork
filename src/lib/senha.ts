import bcrypt from "bcryptjs";

/**
 * Regras de senha, as mesmas em todo lugar onde uma senha nasce: no cadastro feito pelo gestor,
 * em "Minha conta" e em "Esqueci minha senha".
 */

const SENHA_MINIMA = 8;
/** O bcrypt só considera os primeiros 72 bytes: acima disso, o resto da senha seria ignorado. */
const SENHA_MAXIMA_BYTES = 72;
const CUSTO_BCRYPT = 12;

/** Mensagem do problema da senha, ou null se ela serve. */
export function problemaDaSenha(senha: string): string | null {
  if (senha.length < SENHA_MINIMA) return `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`;
  if (Buffer.byteLength(senha, "utf8") > SENHA_MAXIMA_BYTES) return "A senha pode ter no máximo 72 caracteres.";
  if (!/\p{L}/u.test(senha) || !/\d/.test(senha)) return "Use letras e números na senha.";
  return null;
}

export const gerarHashSenha = (senha: string) => bcrypt.hash(senha, CUSTO_BCRYPT);

export const conferirSenha = (senha: string, hash: string) => bcrypt.compare(senha, hash);

/**
 * Hash de uma senha qualquer, comparado quando o e-mail não existe: o login leva o mesmo tempo
 * com e sem conta, e o tempo de resposta não revela quais e-mails estão cadastrados.
 */
const HASH_FICTICIO = "$2b$12$G4hJ2nZKHvac8LVm33wklOIagP8T4QK8Gl3eRIKfItJ3yCw9cNbje";
export const gastarTempoDeComparacao = (senha: string) => bcrypt.compare(senha, HASH_FICTICIO);
