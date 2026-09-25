import { expect, test, type Page } from "@playwright/test";
import { CTP, MUNICIPIO, entrar, esperarEmail, selecionarTrecho } from "./ajuda";

/**
 * Ciclo completo de revisão de uma minuta entre o município e o CTP, na minuta do Estatuto e
 * PCCS de Guarapuava (versão 3 enviada no seed). Os testes dependem um do outro: rodam em série.
 */
test.describe.configure({ mode: "serial" });

const ETAPA = "/projetos/projeto-demo-guarapuava?etapa=etapa-minuta-demo";
const documento = (page: Page) => page.locator(".documento-conteudo");

async function confirmarLeituraSePreciso(page: Page) {
  const botao = page.getByRole("button", { name: "Confirmar leitura" });
  if (await botao.isVisible()) {
    await botao.click();
    await expect(botao).toHaveCount(0);
  }
}

async function sugerir(page: Page, trecho: string, novoTexto: string, justificativa?: string) {
  await selecionarTrecho(page, trecho);
  await page.getByRole("button", { name: "Sugerir redação" }).click();
  await expect(page.getByLabel("Nova redação")).toHaveValue(trecho); // começa como cópia do trecho
  await page.getByLabel("Nova redação").fill(novoTexto);
  if (justificativa) await page.getByLabel(/Justificativa/).fill(justificativa);
  await page.getByRole("button", { name: "Enviar sugestão" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Sugestão enviada ao CTP." })).toBeVisible();
  await expect(page.locator(".anot-insercao", { hasText: novoTexto })).toBeVisible();
}

test("município confirma a leitura, sugere redação, comenta e pede ajustes", async ({ page }) => {
  await entrar(page, MUNICIPIO.marina);
  await page.goto(ETAPA);
  await expect(documento(page)).toContainText("24 (vinte e quatro) meses");
  await confirmarLeituraSePreciso(page);

  await sugerir(page, "24 (vinte e quatro) meses", "36 (trinta e seis) meses", "Alinhar ao interstício do estatuto vigente.");
  await sugerir(page, "5 (cinco) anos", "3 (três) anos");

  // Comentário comum num trecho.
  await selecionarTrecho(page, "avaliação de desempenho satisfatória");
  await page.getByRole("button", { name: "Comentar" }).click();
  await page.getByPlaceholder("Escreva seu comentário…").fill("Quem compõe a comissão de avaliação?");
  await page.getByRole("button", { name: "Registrar" }).click();
  await expect(page.getByRole("article").filter({ hasText: "Quem compõe a comissão de avaliação?" })).toBeVisible();

  // Texto da versão enviada não muda: a proposta aparece ao lado, como controle de alterações.
  await expect(documento(page)).toContainText("24 (vinte e quatro) meses");

  await page.getByRole("button", { name: "Pedir ajustes" }).click();
  await page.getByPlaceholder(/Resuma os ajustes/).fill("Ver sugestões nos Arts. 10 e 11.");
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(page.getByText("Ajustes solicitados")).toBeVisible();

  // O responsável pela etapa no CTP é avisado por e-mail.
  await esperarEmail(CTP.ana, "sugestão de redação");
});

test("CTP aceita uma sugestão, recusa outra com motivo e envia a nova versão", async ({ page }) => {
  await entrar(page, CTP.ana);
  await page.goto(ETAPA);

  // Na versão enviada, "Aceitar" leva ao rascunho da próxima versão.
  await page.getByRole("button", { name: /Aceitar na nova versão/ }).first().click();
  await expect(page.getByRole("tab", { name: /Rascunho v4/ })).toHaveAttribute("aria-selected", "true");
  const editor = page.locator(".ProseMirror[contenteditable=true]");
  await expect(editor).toContainText("24 (vinte e quatro) meses");

  const cartao = (texto: string) => page.getByRole("article").filter({ hasText: texto });
  await cartao("36 (trinta e seis) meses").getByRole("button", { name: "Aceitar e aplicar no texto" }).click();
  await expect(editor).toContainText("36 (trinta e seis) meses de efetivo exercício");
  await expect(editor).not.toContainText("24 (vinte e quatro) meses");
  await expect(cartao("36 (trinta e seis) meses")).toContainText("Aceita");

  await cartao("3 (três) anos").getByRole("button", { name: "Recusar" }).click();
  await cartao("3 (três) anos").getByPlaceholder(/por que a redação atual fica/).fill("O prazo de 5 anos vem da Lei Municipal 1.234/2019.");
  await cartao("3 (três) anos").getByRole("button", { name: "Recusar sugestão" }).click();
  await expect(cartao("3 (três) anos")).toContainText("Não aceita");
  await expect(editor).toContainText("5 (cinco) anos");

  await expect(page.getByText(/^Salvo \d/)).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Enviar ao município" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Versão 4 enviada ao município." })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Versão 4/ })).toBeVisible();

  // A autora da sugestão é avisada das decisões.
  await esperarEmail(MUNICIPIO.marina, "aceitou sua sugestão de redação");
});

test("município recebe a versão 4 com o texto novo e vê o motivo da recusa na versão 3", async ({ page }) => {
  await entrar(page, MUNICIPIO.marina);
  await page.goto(ETAPA);
  await expect(page.getByRole("tab", { name: /Versão 4/ })).toHaveAttribute("aria-selected", "true");
  await expect(documento(page)).toContainText("36 (trinta e seis) meses de efetivo exercício");
  await expect(documento(page)).toContainText("5 (cinco) anos");
  await expect(page.getByRole("button", { name: "Confirmar leitura" })).toBeVisible(); // nova versão = nova leitura

  await page.getByRole("tab", { name: /Versão 3/ }).click();
  const recusada = page.getByRole("article").filter({ hasText: "3 (três) anos" });
  await expect(recusada).toContainText("Não aceita");
  await expect(recusada).toContainText("Lei Municipal 1.234/2019");

  // Comparar versões mostra a mudança palavra por palavra (v3 → v4 por padrão).
  await page.getByRole("button", { name: "Comparar versões" }).click();
  await expect(page.getByText("+3 palavras")).toBeVisible();
  await expect(page.locator("ins", { hasText: "36" })).toBeVisible();
  await expect(page.locator("del", { hasText: "24" })).toBeVisible();
});

test("exportação para Word leva as sugestões como comentários", async ({ page }) => {
  await entrar(page, CTP.ana);
  const resposta = await page.request.get("/api/documentos/documento-minuta-demo/docx");
  expect(resposta.status()).toBe(200);
  expect(resposta.headers()["content-type"]).toContain("wordprocessingml");
  expect((await resposta.body()).length).toBeGreaterThan(5000);
});
