import { expect, test, type Page } from "@playwright/test";
import { CTP, entrar, erroDoFormulario } from "./ajuda";

/** Tipo de contrato configurado pelo gestor, do cadastro ao contrato concluído. */
test.describe.configure({ mode: "serial" });

const TIPO = "Dispensa de licitação";
const OBJETO = "Assessoria para revisão do Código Tributário";
let enderecoContrato = "";

async function adicionarEtapa(page: Page, nome: string, curto: string, opcoes: { assinaturas?: boolean; projeto?: boolean } = {}) {
  const form = page.locator("form", { hasText: "Adicionar etapa ao final" });
  await form.getByLabel("Nome da etapa").fill(nome);
  await form.getByLabel(/Rótulo curto/).fill(curto);
  if (opcoes.assinaturas) await form.getByLabel(/Exige assinaturas/).check();
  if (opcoes.projeto) await form.getByLabel(/Libera o projeto/).check();
  await form.getByRole("button", { name: "Adicionar etapa" }).click();
}

test("gestor cria um tipo de contrato com as próprias etapas", async ({ page }) => {
  await entrar(page, CTP.ana);
  await page.goto("/cadastros?aba=fluxos-contrato");
  await expect(page.getByRole("link", { name: /Padrão/ })).toBeVisible(); // o fluxo que já existia

  await page.getByPlaceholder("Ex.: Dispensa de licitação").fill(TIPO);
  await page.getByRole("button", { name: "Criar" }).click();
  await expect(page.getByRole("heading", { name: `Etapas — ${TIPO}` })).toBeVisible();
  await expect(page.getByText("precisa de pelo menos 2 etapas")).toBeVisible();

  await adicionarEtapa(page, "Solicitação da prefeitura", "Solicitação");
  await expect(page.getByText("Solicitação da prefeitura")).toBeVisible();
  await adicionarEtapa(page, "Assinatura do contrato", "Assinatura", { assinaturas: true });
  await expect(page.getByText("Assinatura do contrato")).toBeVisible();

  // Só pode haver uma etapa de assinaturas por tipo.
  await adicionarEtapa(page, "Segunda assinatura", "Assinatura 2", { assinaturas: true });
  await expect(page.locator("form", { hasText: "Adicionar etapa ao final" }).getByRole("alert")).toContainText("já é a de assinaturas");

  await page.locator("form", { hasText: "Adicionar etapa ao final" }).getByLabel(/Exige assinaturas/).uncheck();
  await adicionarEtapa(page, "Contrato vigente", "Vigente", { projeto: true });
  await expect(page.getByText("Contrato vigente")).toBeVisible();
  await expect(page.getByText("precisa de pelo menos 2 etapas")).toHaveCount(0);
});

test("contrato novo segue as etapas do tipo escolhido", async ({ page }) => {
  await entrar(page, CTP.ana);
  await page.goto("/contratos/novo");
  await page.getByLabel("Tipo de contrato").selectOption({ label: TIPO });
  const quadro = page.locator("aside", { hasText: "Etapas deste tipo" });
  await expect(quadro.getByRole("listitem")).toHaveCount(3);
  await expect(quadro).toContainText("Assinatura do contrato");

  await page.getByLabel("Objeto do contrato").fill(OBJETO);
  await page.getByLabel("Município contratante").selectOption({ label: "Prefeitura de Palmas" });
  await page.getByRole("button", { name: "Criar contrato" }).click();
  await expect(page).toHaveURL(/\/contratos\/c/);
  enderecoContrato = new URL(page.url()).pathname;

  await expect(page.getByText(`Tipo de contrato: ${TIPO}`)).toBeVisible();
  const etapas = page.locator("ol").first().getByRole("listitem");
  await expect(etapas).toHaveCount(3);
  await expect(page.getByRole("button", { name: /Avançar para Assinatura/ })).toBeVisible();
});

test("avança com histórico, trava sem assinaturas e libera o projeto no fim", async ({ page }) => {
  await entrar(page, CTP.ana);
  await page.goto(enderecoContrato);

  await page.getByRole("button", { name: /Avançar para Assinatura/ }).click();
  // A etapa concluída guarda quem avançou.
  await expect(page.locator("ol").first().getByRole("listitem").first()).toContainText("Ana");
  await expect(page.getByText("Em assinatura").first()).toBeVisible();

  // Na etapa de assinaturas: não avança até todas serem coletadas.
  await expect(page.getByRole("button", { name: /Avançar para Vigente/ })).toBeDisabled();
  await expect(page.getByText(/exige todas as assinaturas/)).toBeVisible();

  // Abre a coleta de assinaturas (só a Ana assina, neste teste) e assina.
  const abrir = page.locator("section", { has: page.getByRole("heading", { name: "Abrir fluxo de assinatura" }) });
  await abrir.getByText("Ana Coordenadora", { exact: true }).click();
  await abrir.getByRole("button", { name: "Abrir fluxo de assinatura" }).click();
  await page.getByRole("button", { name: "Assinar digitalmente" }).click();
  await expect(page.getByText("Todas as partes assinaram.")).toBeVisible();

  await page.getByRole("button", { name: /Avançar para Vigente/ }).click();
  await expect(page.getByRole("heading", { name: "Criar projeto técnico" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Avançar para/ })).toHaveCount(0); // etapa final
});

test("lista de contratos filtra por tipo e por situação", async ({ page }) => {
  await entrar(page, CTP.ana);
  await page.goto("/contratos");
  await page.getByRole("link", { name: TIPO, exact: true }).click();
  await expect(page.getByText(OBJETO)).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(1);

  await page.getByRole("link", { name: /Concluídos/ }).click();
  await expect(page.getByText(OBJETO)).toBeVisible();
  await page.getByRole("link", { name: /Em andamento/ }).click();
  await expect(page.getByText(OBJETO)).toHaveCount(0);
});

test("contratos antigos continuam no fluxo Padrão, com as 6 etapas", async ({ page }) => {
  await entrar(page, CTP.ana);
  await page.goto("/contratos/contrato-demo-guarapuava");
  await expect(page.getByText("Tipo de contrato: Padrão")).toBeVisible();
  await expect(page.locator("ol").first().getByRole("listitem")).toHaveCount(6);
});

test("tipo desativado some da criação de contratos", async ({ page }) => {
  await entrar(page, CTP.ana);
  await page.goto("/cadastros?aba=fluxos-contrato");
  await page.getByRole("link", { name: new RegExp(TIPO) }).click();
  await page.getByRole("button", { name: "Desativar tipo" }).click();
  await expect(page.getByRole("button", { name: "Ativar tipo" })).toBeVisible();

  await page.goto("/contratos/novo");
  await expect(page.getByLabel("Tipo de contrato").locator("option", { hasText: TIPO })).toHaveCount(0);
  await expect(erroDoFormulario(page)).toHaveCount(0);
});
