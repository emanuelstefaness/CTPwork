import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, type Page } from "@playwright/test";

/** Contas do seed de demonstração (senha comum a todas). */
export const SENHA = "ctpwork123";
export const CTP = { ana: "gestor@ctp.org.br", bruno: "colaborador@ctp.org.br" };
export const MUNICIPIO = {
  marina: "marina.kowalski@guarapuava.pr.gov.br", // Guarapuava
  helena: "helena.bittencourt@mariopolis.pr.gov.br", // Mariópolis
  rogerio: "rogerio.dallacosta@mariopolis.pr.gov.br", // Mariópolis
  juliana: "juliana.menegatti@patobranco.pr.gov.br", // Pato Branco
  ricardo: "ricardo.sartori@patobranco.pr.gov.br", // Pato Branco
  tatiane: "tatiane.wolff@coronelvivida.pr.gov.br", // Coronel Vivida
};

/**
 * Entra com a conta. Se já houver alguém logado, sai antes: primeiro sai da página (senão uma
 * requisição ainda em andamento devolve o cookie de sessão logo depois de apagado) e depois
 * limpa os cookies.
 */
export async function entrar(page: Page, email: string, senha = SENHA) {
  await page.goto("about:blank");
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/** Mensagem de erro de um formulário (ignora o anunciador de rotas do Next, que também é role=alert). */
export const erroDoFormulario = (page: Page) => page.locator("form [role=alert]");

/**
 * Seleciona um trecho do documento como o usuário faria com o mouse: cria a seleção no texto e
 * solta o botão (o editor abre o menu de grifo/comentário/sugestão no mouseup).
 */
export async function selecionarTrecho(page: Page, trecho: string) {
  const achou = await page.evaluate((alvo) => {
    const raiz = document.querySelector(".documento-conteudo");
    if (!raiz) return false;
    const caminhante = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
    for (let no = caminhante.nextNode(); no; no = caminhante.nextNode()) {
      const i = no.textContent?.indexOf(alvo) ?? -1;
      if (i >= 0) {
        const faixa = document.createRange();
        faixa.setStart(no, i);
        faixa.setEnd(no, i + alvo.length);
        const sel = window.getSelection()!;
        sel.removeAllRanges();
        sel.addRange(faixa);
        no.parentElement?.scrollIntoView({ block: "center" });
        document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
        return true;
      }
    }
    return false;
  }, trecho);
  expect(achou, `trecho "${trecho}" deveria estar no documento`).toBe(true);
}

/** E-mails que o sistema "enviou" (sem SMTP nos testes, eles são gravados em storage-teste/emails). */
export function emailsPara(destinatario: string): string[] {
  const pasta = path.join(process.cwd(), "storage-teste", "emails");
  let arquivos: string[] = [];
  try {
    arquivos = readdirSync(pasta).sort();
  } catch {
    return [];
  }
  return arquivos.filter((a) => a.includes(destinatario)).map((a) => readFileSync(path.join(pasta, a), "utf8"));
}

/** Espera chegar um e-mail para a pessoa que contenha o texto (o despacho junta avisos por ~5 s). */
export async function esperarEmail(destinatario: string, contem: string | RegExp): Promise<string> {
  let achado = "";
  await expect
    .poll(() => {
      achado = emailsPara(destinatario).find((h) => (typeof contem === "string" ? h.includes(contem) : contem.test(h))) ?? "";
      return achado.length > 0;
    }, { timeout: 30_000, message: `e-mail para ${destinatario} contendo ${contem}` })
    .toBe(true);
  return achado;
}
