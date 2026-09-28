import { prisma } from "@/lib/prisma";
import { lerIds } from "@/lib/permissoes";

/**
 * Fluxos de contrato configuráveis (Cadastros › Fluxos de contrato). Cada contrato tem a sua
 * própria cópia das etapas (EtapaContrato), feita na criação; `Contrato.etapaAtual` guarda a
 * chave da etapa em que ele está. A última etapa é o estado final ("concluído").
 */

export const FLUXO_PADRAO_ID = "fluxo-contrato-padrao";

export type EtapaDoContrato = {
  chave: string;
  nome: string;
  curto: string;
  ordem: number;
  exigeAssinaturas: boolean;
  liberaProjeto: boolean;
  concluidaEm: Date | null;
  concluidaPor: { nome: string } | null;
};

/** Onde o contrato está no próprio fluxo. */
export function progressoDoContrato<E extends Pick<EtapaDoContrato, "chave" | "exigeAssinaturas" | "liberaProjeto">>(etapas: E[], etapaAtual: string) {
  const indice = Math.max(0, etapas.findIndex((e) => e.chave === etapaAtual));
  const atual = etapas[indice];
  const concluido = indice === etapas.length - 1;
  return {
    indice,
    atual,
    proxima: concluido ? null : etapas[indice + 1],
    concluido,
    /** Situação para filtros e cores: em andamento, aguardando assinaturas ou concluído. */
    situacao: (concluido ? "concluido" : atual?.exigeAssinaturas ? "assinatura" : "andamento") as "andamento" | "assinatura" | "concluido",
    temEtapaDeAssinatura: etapas.some((e) => e.exigeAssinaturas),
  };
}

export const SITUACAO_CONTRATO = {
  andamento: { rotulo: "Em andamento", tom: "blue" as const },
  assinatura: { rotulo: "Em assinatura", tom: "amber" as const },
  concluido: { rotulo: "Concluídos", tom: "emerald" as const },
};

/**
 * Garante que os contratos tenham as etapas copiadas do seu fluxo — contratos criados antes dos
 * fluxos configuráveis, ou direto no banco (seed), ainda não têm. Idempotente.
 */
export async function garantirEtapasDosContratos(contratoIds: string[]) {
  if (!contratoIds.length) return;
  const semEtapas = await prisma.contrato.findMany({
    where: { id: { in: contratoIds }, etapas: { none: {} } },
    select: { id: true, fluxoId: true },
  });
  for (const c of semEtapas) {
    const fluxoId = c.fluxoId ?? FLUXO_PADRAO_ID;
    const modelo = await prisma.etapaFluxoContrato.findMany({ where: { fluxoId }, orderBy: { ordem: "asc" } });
    if (!modelo.length) continue;
    try {
      await prisma.$transaction([
        prisma.contrato.update({ where: { id: c.id }, data: { fluxoId } }),
        prisma.etapaContrato.createMany({
          data: modelo.map((e) => ({
            contratoId: c.id,
            ordem: e.ordem,
            chave: e.chave,
            nome: e.nome,
            curto: e.curto,
            exigeAssinaturas: e.exigeAssinaturas,
            liberaProjeto: e.liberaProjeto,
            perfisQueAvancam: e.perfisQueAvancam,
          })),
        }),
      ]);
    } catch {
      // Outra requisição copiou as etapas ao mesmo tempo (chave única contrato+etapa) — tudo certo.
    }
  }
}

/**
 * Quem pode concluir a etapa atual: se a etapa lista perfis, só eles; senão, quem gerencia contratos.
 */
export function podeAvancarEtapa(user: { perfilId: string; permissoes: readonly string[] }, etapa: { perfisQueAvancam: string }) {
  if (!user.permissoes.includes("contrato.gerenciar")) return false;
  const perfis = lerIds(etapa.perfisQueAvancam);
  return perfis.length === 0 || perfis.includes(user.perfilId);
}

/** Cria o identificador interno de uma etapa a partir do nome ("Análise jurídica" → ANALISE_JURIDICA). */
export function chaveDaEtapa(nome: string) {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60) || "ETAPA";
}
