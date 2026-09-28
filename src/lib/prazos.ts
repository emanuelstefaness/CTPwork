import { prisma } from "@/lib/prisma";
import { usuariosComPermissao } from "@/lib/usuarios-permissao";

/**
 * Decisão 9.4 (padrão recomendado): quando um prazo vence sem ação, notifica automaticamente
 * o responsável e o(s) gestor(es), sem bloquear a etapa/projeto (bloqueio automático fica como
 * política configurável futura). Não há job/cron no ambiente de dev — a verificação roda a cada
 * carregamento de página autenticada (ver AppLayout) e é idempotente: nunca duplica notificação
 * para a mesma etapa/projeto (checa existência antes de criar).
 *
 * Várias requisições simultâneas (layout + prefetch de links) podiam passar juntas pela checagem
 * de existência e criar a mesma notificação duas vezes; por isso execuções concorrentes no mesmo
 * processo compartilham uma única promessa, e a verificação roda no máximo uma vez por minuto.
 */
let emAndamento: Promise<void> | null = null;
let ultimaExecucao = 0;

export function gerarNotificacoesPrazoEstourado() {
  if (emAndamento) return emAndamento;
  if (Date.now() - ultimaExecucao < 60_000) return Promise.resolve();
  emAndamento = verificarPrazos().finally(() => {
    ultimaExecucao = Date.now();
    emAndamento = null;
  });
  return emAndamento;
}

/**
 * Prazos são datas "somente dia" salvas como meia-noite UTC (ver formatters.ts). Um prazo só
 * está vencido depois que o próprio dia termina — comparar com `new Date()` marcava como vencido
 * já na manhã do dia do prazo, divergindo da aba Prazos ("Vence hoje").
 */
export function inicioDoDiaUTC(agora = new Date()): Date {
  return new Date(Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate()));
}

async function verificarPrazos() {
  const hoje = inicioDoDiaUTC();
  // "Gestores" = quem tem acesso a Cadastros no perfil (Cadastros › Perfis).
  const idsGestores = await usuariosComPermissao("cadastros");

  const etapasVencidas = await prisma.etapaProjeto.findMany({
    where: { prazo: { lt: hoje }, status: { not: "CONCLUIDA" } },
    include: { projeto: true },
  });

  for (const etapa of etapasVencidas) {
    const jaNotificado = await prisma.notificacao.findFirst({
      where: { tipo: "PRAZO_ESTOURADO", entidadeTipo: "EtapaProjeto", entidadeId: etapa.id },
    });
    if (jaNotificado) continue;

    const destinatarios = new Set([etapa.responsavelId, ...idsGestores]);
    await prisma.notificacao.createMany({
      data: [...destinatarios].map((userId) => ({
        userId,
        tipo: "PRAZO_ESTOURADO",
        mensagem: `O prazo da etapa "${etapa.nome}" do projeto ${etapa.projeto.codigo} venceu sem conclusão.`,
        entidadeTipo: "EtapaProjeto",
        entidadeId: etapa.id,
      })),
    });
  }

  const projetosVencidos = await prisma.projeto.findMany({
    where: { dataVigencia: { lt: hoje } },
  });

  for (const projeto of projetosVencidos) {
    const jaNotificado = await prisma.notificacao.findFirst({
      where: { tipo: "VIGENCIA_ESTOURADA", entidadeTipo: "Projeto", entidadeId: projeto.id },
    });
    if (jaNotificado) continue;

    const destinatarios = new Set([projeto.responsavelId, ...idsGestores]);
    await prisma.notificacao.createMany({
      data: [...destinatarios].map((userId) => ({
        userId,
        tipo: "VIGENCIA_ESTOURADA",
        mensagem: `A vigência do projeto ${projeto.codigo} venceu.`,
        entidadeTipo: "Projeto",
        entidadeId: projeto.id,
      })),
    });
  }
}
