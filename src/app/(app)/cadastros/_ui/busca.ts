/** Comparação de busca sem acento e sem diferença de maiúsculas ("joão" acha "Joao"). */
export const normalizar = (texto: string) => texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function combina(termo: string | undefined, ...campos: (string | null | undefined)[]) {
  if (!termo?.trim()) return true;
  const busca = normalizar(termo.trim());
  return campos.some((c) => c && normalizar(c).includes(busca));
}

/** Monta a URL da página mantendo só os filtros informados (vazios saem). */
export function urlCom(base: string, params: Record<string, string | undefined>) {
  const q = new URLSearchParams(Object.entries(params).filter((p): p is [string, string] => !!p[1])).toString();
  return q ? `${base}?${q}` : base;
}
