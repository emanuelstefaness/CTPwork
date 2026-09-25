import { expect, test } from "@playwright/test";
import { CTP, MUNICIPIO, entrar, erroDoFormulario, esperarEmail } from "./ajuda";

/** Etapa "Documentos iniciais" de Mariópolis: checklist de documentos e chat da etapa. */
const ETAPA = "/projetos/projeto-demo-mariopolis-pccs?etapa=etapa-mar-docs";
const pdf = (nome: string, tamanho: number) => ({ name: nome, mimeType: "application/pdf", buffer: Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(tamanho)]) });

test("município envia documento do checklist só escolhendo o arquivo, e o CTP aprova", async ({ page }) => {
  await entrar(page, MUNICIPIO.helena);
  await page.goto(ETAPA);
  const linhas = page.locator("div.divide-y > div");
  const item = linhas.filter({ hasText: "Legislação complementar" });
  await expect(item.getByText("Pendente", { exact: true })).toBeVisible();
  // Arquivo de 3 MB: acima do limite padrão de 1 MB das server actions, que antes barrava qualquer PDF maior.
  await item.locator("input[type=file]").setInputFiles(pdf("legislacao-complementar.pdf", 3 * 1024 * 1024));
  await expect(item.getByRole("link", { name: "legislacao-complementar.pdf" })).toBeVisible();
  await expect(item.getByText("Em análise", { exact: true })).toBeVisible();

  // Quem é avisado é o responsável pela etapa no CTP (Bruno, no seed).
  await esperarEmail(CTP.bruno, "Legislação complementar");

  await entrar(page, CTP.ana);
  await page.goto(ETAPA);
  const linha = page.locator("div.divide-y > div").filter({ hasText: "Legislação complementar" });
  await linha.getByRole("button", { name: "Aprovar" }).click();
  await expect(linha.getByText("Aprovado", { exact: true })).toBeVisible();
});

test("chat da etapa: mensagem com anexo chega e avisa o outro lado; arquivo grande é recusado", async ({ page }) => {
  await entrar(page, MUNICIPIO.helena);
  await page.goto(ETAPA);
  const chat = page.locator("section", { has: page.getByRole("heading", { name: "Chat da etapa" }) });

  // Acima de 20 MB: recusado antes de subir, com mensagem clara.
  await chat.locator("input[type=file]").setInputFiles(pdf("muito-grande.pdf", 21 * 1024 * 1024));
  await chat.getByLabel("Mensagem", { exact: true }).fill("segue o arquivo");
  await chat.getByRole("button", { name: "Enviar mensagem" }).click();
  await expect(erroDoFormulario(page)).toContainText("o limite é 20 MB por arquivo");

  await chat.locator("input[type=file]").setInputFiles(pdf("ata-reuniao.pdf", 200 * 1024));
  await chat.getByLabel("Mensagem", { exact: true }).fill("Segue a ata da reunião com o jurídico.");
  await chat.getByRole("button", { name: "Enviar mensagem" }).click();
  await expect(chat.getByText("Segue a ata da reunião com o jurídico.")).toBeVisible();
  await expect(chat.getByRole("link", { name: "ata-reuniao.pdf" })).toBeVisible();
  await expect(chat.getByLabel("Mensagem", { exact: true })).toHaveValue(""); // campo limpo depois de enviar

  // O arquivo abre para quem é do mesmo município.
  const href = await chat.getByRole("link", { name: "ata-reuniao.pdf" }).getAttribute("href");
  expect((await page.request.get(href!)).status()).toBe(200);

  await esperarEmail(CTP.bruno, "Segue a ata da reunião com o jurídico."); // responsável pela etapa

  // Outro município não baixa o anexo.
  await entrar(page, MUNICIPIO.juliana);
  expect((await page.request.get(href!)).status()).toBe(403);
});
