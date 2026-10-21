/**
 * IP de quem fez a requisição, para o limite de tentativas e o registro das assinaturas.
 * Na Vercel (e atrás de um proxy reverso que reescreve estes cabeçalhos) o valor vem do proxy,
 * não do navegador. Num servidor exposto direto à internet eles podem ser forjados: configure o
 * proxy para sobrescrevê-los.
 */
export function ipDaRequisicao(cabecalhos: Headers): string {
  const real = cabecalhos.get("x-real-ip")?.trim();
  const encaminhado = cabecalhos.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (real || encaminhado || "indisponível").slice(0, 64);
}
