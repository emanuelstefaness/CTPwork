import { prisma } from "@/lib/prisma";

/**
 * Próximo número sequencial a partir do maior sufixo "-NNNNNN" já usado com este
 * prefixo (não conta linhas), para não colidir quando existem códigos fora de
 * sequência (ex.: dados de seed/importação com prefixo diferente).
 */
async function proximoSequencial(model: "memorando" | "contrato" | "projeto", prefixo: string): Promise<number> {
  const finders: Record<typeof model, (where: object) => Promise<{ codigo: string } | null>> = {
    memorando: (where) => prisma.memorando.findFirst({ where, orderBy: { codigo: "desc" }, select: { codigo: true } }),
    contrato: (where) => prisma.contrato.findFirst({ where, orderBy: { codigo: "desc" }, select: { codigo: true } }),
    projeto: (where) => prisma.projeto.findFirst({ where, orderBy: { codigo: "desc" }, select: { codigo: true } }),
  };
  const ultimo = await finders[model]({ codigo: { startsWith: `${prefixo}-` } });
  const match = ultimo?.codigo.match(/-(\d+)$/);
  return match ? parseInt(match[1], 10) + 1 : 1;
}

export async function gerarCodigoMemorando(): Promise<string> {
  const n = await proximoSequencial("memorando", "MEM");
  return `MEM-${String(n).padStart(6, "0")}`;
}

/** Padrão de numeração de processos públicos: CTR-AAAA-NNN, sequência reiniciando a cada ano. */
export async function gerarCodigoContrato(): Promise<string> {
  const ano = new Date().getFullYear();
  const n = await proximoSequencial("contrato", `CTR-${ano}`);
  return `CTR-${ano}-${String(n).padStart(3, "0")}`;
}

/**
 * Código do projeto vinculado ao número do contrato de origem (5.3): CTR-2026-033 → PRJ-2026-033.
 * Um segundo projeto do mesmo contrato recebe sufixo (PRJ-2026-033-2).
 */
export function gerarCodigoProjeto(codigoContrato: string, sequenciaNoContrato: number): string {
  const base = codigoContrato.replace(/^CTR-/, "PRJ-");
  return sequenciaNoContrato > 1 ? `${base}-${sequenciaNoContrato}` : base;
}
