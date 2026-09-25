/**
 * Limite de tentativas em memória (por processo), contra adivinhação de senha e abuso do
 * "esqueci minha senha". Suficiente para um servidor único; com vários servidores, trocar por
 * um armazenamento compartilhado (ex.: Redis) mantendo esta mesma interface.
 */

type Registro = { falhas: number; desde: number };
const estado = globalThis as unknown as { __tentativas?: Map<string, Registro> };
const registros = (estado.__tentativas ??= new Map());

export function bloqueado(chave: string, maximo: number, janelaMs: number): number {
  const r = registros.get(chave);
  if (!r) return 0;
  const restante = r.desde + janelaMs - Date.now();
  if (restante <= 0) {
    registros.delete(chave);
    return 0;
  }
  return r.falhas >= maximo ? restante : 0;
}

export function registrarFalha(chave: string, janelaMs: number) {
  const r = registros.get(chave);
  if (!r || r.desde + janelaMs < Date.now()) registros.set(chave, { falhas: 1, desde: Date.now() });
  else r.falhas++;
}

export function limpar(chave: string) {
  registros.delete(chave);
}
