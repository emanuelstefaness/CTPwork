import { expect, test, type Page } from "@playwright/test";
import { CTP, entrar } from "./ajuda";

/**
 * Quem conduz cada etapa de projeto (Cadastros › Tipos de projeto): reservada a um perfil, só ele
 * inicia, pede ação da prefeitura e conclui; os demais acompanham.
 */
test.describe.configure({ mode: "serial" });

const ETAPA = "Análise e devolutiva 01";
const NO_PROJETO = "/projetos/projeto-demo-mariopolis-pccs?etapa=etapa-mar-dev1"; // ainda não iniciada

async function editarEtapa(page: Page) {
  await page.goto("/cadastros/tipos-de-projeto");
  await page.getByRole("link", { name: /^Estatuto e PCCS\s*\d+ etapas/ }).click();
  const linha = page.locator(`[data-etapa="${ETAPA}"]`);
  await linha.getByRole("button", { name: "Editar etapa" }).click();
  return linha;
}

test("gestor reserva a etapa ao perfil Gestor", async ({ page }) => {
  await entrar(page, CTP.ana);
  const linha = await editarEtapa(page);
  await linha.getByLabel(/Só alguns perfis/).check();
  await linha.getByText("Gestor", { exact: true }).click();
  await expect(linha.locator("input[name=aplicarAosProjetos]")).toBeChecked();
  await linha.getByRole("button", { name: "Salvar etapa" }).click();
  await expect(linha).toContainText("Quem conduz: só Gestor");
});

test("quem não tem o perfil acompanha a etapa, mas não a conduz", async ({ page }) => {
  // Bruno (Colaborador) conduz etapas em geral e é o responsável desta — mas ela agora é do Gestor.
  await entrar(page, CTP.bruno);
  await page.goto(NO_PROJETO);
  await expect(page.getByRole("heading", { name: ETAPA })).toBeVisible();
  await expect(page.getByText("Esta etapa é conduzida por:")).toContainText("Gestor");
  await expect(page.getByRole("button", { name: "Iniciar etapa" })).toHaveCount(0);

  await entrar(page, CTP.ana);
  await page.goto(NO_PROJETO);
  await expect(page.getByRole("button", { name: "Iniciar etapa" })).toBeVisible();
  await expect(page.getByText("Esta etapa é conduzida por:")).toHaveCount(0);
});

test("de volta para qualquer pessoa que conduz etapas, o colaborador conduz de novo", async ({ page }) => {
  await entrar(page, CTP.ana);
  const linha = await editarEtapa(page);
  await linha.getByLabel(/Qualquer pessoa que conduz etapas/).check();
  await linha.getByRole("button", { name: "Salvar etapa" }).click();
  await expect(linha).toContainText("Quem conduz: qualquer pessoa que conduz etapas");

  await entrar(page, CTP.bruno);
  await page.goto(NO_PROJETO);
  await expect(page.getByRole("button", { name: "Iniciar etapa" })).toBeVisible();
});
