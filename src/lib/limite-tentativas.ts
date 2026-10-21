import { prisma } from "@/lib/prisma";

/**
 * Limite de tentativas contra adivinhação de senha e abuso do "esqueci minha senha". Cada falha
 * vira uma linha em TentativaAcesso; a chave diz o que é contado ("login:<e-mail>",
 * "login-ip:<ip>"…). No banco, e não na memória, para valer entre as várias instâncias que a
 * hospedagem sobe ao mesmo tempo.
 */

const GUARDAR_POR_MS = 24 * 60 * 60 * 1000;

/** Milissegundos até a chave voltar a ser aceita; 0 = liberada. */
export async function bloqueado(chave: string, maximo: number, janelaMs: number): Promise<number> {
  const recentes = await prisma.tentativaAcesso.findMany({
    where: { chave, criadoEm: { gte: new Date(Date.now() - janelaMs) } },
    orderBy: { criadoEm: "desc" },
    take: maximo,
    select: { criadoEm: true },
  });
  if (recentes.length < maximo) return 0;
  // Libera quando a mais antiga das últimas `maximo` falhas sair da janela.
  return Math.max(0, recentes[maximo - 1].criadoEm.getTime() + janelaMs - Date.now());
}

export async function registrarFalha(chave: string) {
  await prisma.tentativaAcesso.create({ data: { chave } });
  // Faxina ocasional: falhas antigas não contam para nenhuma janela.
  if (Math.random() < 0.02) {
    await prisma.tentativaAcesso.deleteMany({ where: { criadoEm: { lt: new Date(Date.now() - GUARDAR_POR_MS) } } });
  }
}

export async function limpar(chave: string) {
  await prisma.tentativaAcesso.deleteMany({ where: { chave } });
}
