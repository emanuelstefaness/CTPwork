import { prisma } from "@/lib/prisma";
import { resolverLinks } from "@/lib/links-notificacao";
import { enviarEmail, urlDoSistema } from "./transporte";
import { montarEmail } from "./modelo";

/**
 * Avisos por e-mail. Toda notificação criada no sistema também vira e-mail — sem precisar mexer
 * em cada lugar que notifica: o cliente Prisma (src/lib/prisma.ts) chama `agendarDespachoEmails`
 * sempre que uma Notificacao é gravada.
 *
 * O despacho espera alguns segundos e junta tudo o que chegou para a mesma pessoa num e-mail só
 * (ex.: cinco comentários seguidos = um e-mail com cinco itens, não cinco e-mails). Respeita a
 * preferência "receber avisos por e-mail" de cada usuário e nunca reenvia: cada notificação sai
 * com emailStatus ENVIADO, IGNORADO ou FALHOU. Avisos com mais de 24 h sem envio (servidor
 * estava fora do ar, por exemplo) são descartados em vez de chegarem atrasados.
 */

const ATRASO_MS = 5_000;
const estado = globalThis as unknown as { __emailTimer?: ReturnType<typeof setTimeout>; __emailRodando?: Promise<void> };

export function agendarDespachoEmails(atraso = ATRASO_MS) {
  if (estado.__emailTimer) clearTimeout(estado.__emailTimer);
  estado.__emailTimer = setTimeout(() => {
    estado.__emailTimer = undefined;
    void despacharEmails().catch((e) => console.error("[email] falha no despacho", e));
  }, atraso);
}

export async function despacharEmails(): Promise<void> {
  // Um despacho por vez no processo; quem chegar durante um envio reagenda para depois.
  if (estado.__emailRodando) {
    await estado.__emailRodando;
    return agendarDespachoEmails(1_000);
  }
  estado.__emailRodando = processar().finally(() => {
    estado.__emailRodando = undefined;
  });
  return estado.__emailRodando;
}

async function processar() {
  const limite = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await prisma.notificacao.updateMany({ where: { emailStatus: null, createdAt: { lt: limite } }, data: { emailStatus: "IGNORADO" } });

  const pendentes = await prisma.notificacao.findMany({
    where: { emailStatus: null },
    include: { user: { select: { id: true, nome: true, email: true, receberEmail: true, ativo: true } } },
    orderBy: { createdAt: "asc" },
    take: 500,
  });
  if (!pendentes.length) return;

  const links = await resolverLinks(pendentes);
  const base = urlDoSistema();
  const porPessoa = new Map<string, typeof pendentes>();
  for (const n of pendentes) porPessoa.set(n.userId, [...(porPessoa.get(n.userId) ?? []), n]);

  for (const lista of porPessoa.values()) {
    const ids = lista.map((n) => n.id);
    const pessoa = lista[0].user;
    if (!pessoa.ativo || !pessoa.receberEmail || !pessoa.email) {
      await prisma.notificacao.updateMany({ where: { id: { in: ids } }, data: { emailStatus: "IGNORADO" } });
      continue;
    }
    const primeiroNome = pessoa.nome.split(" ")[0];
    const umSo = lista.length === 1;
    const { html, texto } = montarEmail({
      titulo: umSo ? "Você tem um novo aviso no CTP Work" : `Você tem ${lista.length} novos avisos no CTP Work`,
      introducao: `Olá, ${primeiroNome}. ${umSo ? "Aconteceu algo que precisa da sua atenção:" : "Veja o que aconteceu nos seus projetos:"}`,
      itens: lista.map((n) => ({
        texto: n.mensagem,
        url: `${base}${links.get(n.id) ?? "/notificacoes"}`,
        quando: n.createdAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }),
      })),
      botao: umSo ? { rotulo: "Abrir no CTP Work", url: `${base}${links.get(lista[0].id) ?? "/notificacoes"}` } : { rotulo: "Ver todos os avisos", url: `${base}/notificacoes` },
      rodape: `Você recebe este e-mail porque tem uma conta no CTP Work. Para parar de receber avisos por e-mail, acesse ${base}/conta.`,
    });
    const assunto = umSo ? `CTP Work: ${lista[0].mensagem.slice(0, 90)}${lista[0].mensagem.length > 90 ? "…" : ""}` : `CTP Work: ${lista.length} novos avisos`;
    try {
      await enviarEmail({ para: pessoa.email, assunto, html, texto });
      await prisma.notificacao.updateMany({ where: { id: { in: ids } }, data: { emailStatus: "ENVIADO" } });
    } catch (e) {
      console.error(`[email] falha ao enviar para ${pessoa.email}`, e);
      await prisma.notificacao.updateMany({ where: { id: { in: ids } }, data: { emailStatus: "FALHOU" } });
    }
  }
}
