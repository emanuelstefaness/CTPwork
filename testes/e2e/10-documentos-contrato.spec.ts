import { expect, test, type Page } from "@playwright/test";
import { CTP, MUNICIPIO, entrar } from "./ajuda";

/**
 * Contrato pelos dois lados (CTR-2026-031, Pato Branco, parado na aprovação do orçamento):
 * a prefeitura decide a aprovação e envia os documentos da contratação; o CTP confere.
 */
test.describe.configure({ mode: "serial" });

const CONTRATO = "/contratos/contrato-demo-pato-branco-estatuto";
const pdf = (nome: string) => ({ name: nome, mimeType: "application/pdf", buffer: Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(2048)]) });
const linha = (page: Page, nome: string) =>
  page.locator("section", { has: page.getByRole("heading", { name: "Documentos da etapa" }) }).locator("div.divide-y > div").filter({ hasText: nome });

test("a aprovação do orçamento é da prefeitura: pedir revisão devolve ao CTP, que reenvia", async ({ page }) => {
  // O CTP não aprova no lugar da prefeitura.
  await entrar(page, CTP.ana);
  await page.goto(CONTRATO);
  await expect(page.getByText(/Aguardando a decisão da prefeitura/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Avançar para/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Aprovar e seguir/ })).toHaveCount(0);

  // A prefeitura vê o orçamento e pede revisão.
  await entrar(page, MUNICIPIO.juliana);
  await page.goto(CONTRATO);
  const aprovacao = page.locator("section", { has: page.getByRole("heading", { name: "Aprovação da prefeitura" }) });
  await expect(aprovacao.getByRole("link", { name: /Proposta de orçamento/ })).toBeVisible();
  await aprovacao.getByText("Pedir revisão ao CTP…").click();
  await aprovacao.getByLabel("O que precisa ser revisto").fill("Incluir as oficinas presenciais com os servidores.");
  await aprovacao.getByRole("button", { name: "Pedir revisão", exact: true }).click();
  await expect(page.getByText("A prefeitura pediu revisão:")).toBeVisible();

  // O CTP envia o orçamento revisado; só então avança.
  await entrar(page, CTP.ana);
  await page.goto(CONTRATO);
  await expect(page.getByText("Incluir as oficinas presenciais com os servidores.").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Avançar para Aprovação/ })).toBeDisabled();
  await linha(page, "Proposta de orçamento").locator("input[type=file]").setInputFiles(pdf("orcamento-revisado.pdf"));
  await expect(linha(page, "Proposta de orçamento")).toContainText("Entregue");
  await page.getByRole("button", { name: /Avançar para Aprovação/ }).click();
  await expect(page.getByText(/Aguardando a decisão da prefeitura/)).toBeVisible();

  // A prefeitura aprova e o contrato segue para os documentos.
  await entrar(page, MUNICIPIO.juliana);
  await page.goto(CONTRATO);
  await page.getByRole("button", { name: "Aprovar e seguir para Documentos" }).click();
  await expect(page.getByText(/Próximo passo: Envie 3 documentos/)).toBeVisible();
});

test("documentos da contratação: a prefeitura envia, o CTP recusa com motivo, aprova e pede outro", async ({ page }) => {
  await entrar(page, MUNICIPIO.juliana);
  await page.goto(CONTRATO);
  await linha(page, "Termo de referência assinado").locator("input[type=file]").setInputFiles(pdf("termo.pdf"));
  await expect(linha(page, "Termo de referência assinado")).toContainText("Em análise");
  // Documento do CTP não tem botão de envio para a prefeitura.
  await expect(linha(page, "Contrato social e cartão CNPJ").locator("input[type=file]")).toHaveCount(0);

  await entrar(page, CTP.ana);
  await page.goto(CONTRATO);
  await expect(page.getByRole("button", { name: /Avançar para Minuta/ })).toBeDisabled();
  await linha(page, "Termo de referência assinado").getByText("Recusar e pedir de novo…").click();
  await linha(page, "Termo de referência assinado").getByLabel(/Motivo da recusa/).fill("Falta a assinatura do secretário.");
  await linha(page, "Termo de referência assinado").getByRole("button", { name: "Recusar", exact: true }).click();
  await expect(linha(page, "Termo de referência assinado")).toContainText("Pedido de novo envio: Falta a assinatura do secretário.");

  await entrar(page, MUNICIPIO.juliana);
  await page.goto(CONTRATO);
  await expect(linha(page, "Termo de referência assinado")).toContainText("Falta a assinatura do secretário.");
  await linha(page, "Termo de referência assinado").locator("input[type=file]").setInputFiles(pdf("termo-assinado.pdf"));
  await expect(linha(page, "Termo de referência assinado")).toContainText("Em análise");

  await entrar(page, CTP.ana);
  await page.goto(CONTRATO);
  await linha(page, "Termo de referência assinado").getByRole("button", { name: "Aprovar" }).click();
  await expect(linha(page, "Termo de referência assinado")).toContainText("Aprovado");
  await page.getByLabel("Documento a pedir").fill("Lei orçamentária anual");
  await page.getByRole("button", { name: "Pedir", exact: true }).click();
  await expect(linha(page, "Lei orçamentária anual")).toContainText("Pendente");

  await entrar(page, MUNICIPIO.juliana);
  await page.goto("/notificacoes");
  await expect(page.getByText(/pediu o documento "Lei orçamentária anual"/)).toBeVisible();
});
