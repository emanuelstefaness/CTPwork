import { expect, test } from "@playwright/test";
import { CTP, entrar } from "./ajuda";

/** Modelo de etapas do projeto: documentos pedidos por padrão e aplicação aos projetos em andamento. */
test.describe.configure({ mode: "serial" });

const FASE = "Fase 04 — Audiência pública";

test("documento padrão novo no modelo chega às etapas não iniciadas, sem duplicar os que já existem", async ({ page }) => {
  await entrar(page, CTP.ana);
  await page.goto("/cadastros/tipos-de-projeto");
  await page.getByRole("link", { name: /^Plano Diretor\s*\d+ etapas/ }).click();
  await expect(page.getByRole("heading", { name: "Plano Diretor", exact: true })).toBeVisible();

  const linha = page.locator(`[data-etapa="${FASE}"]`);
  await expect(linha).toContainText("3 documentos pedidos");
  await linha.getByRole("button", { name: "Editar etapa" }).click();

  const form = linha.locator("form");
  await expect(form.getByText("Ata da audiência pública")).toBeVisible();
  await form.getByLabel("Documento pedido à prefeitura").fill("Relatório fotográfico");
  await form.getByLabel("Documento pedido à prefeitura").press("Enter");
  await expect(form.getByText("Relatório fotográfico")).toBeVisible();
  await expect(form.locator("input[name=aplicarAosProjetos]")).toBeChecked();
  await form.getByRole("button", { name: "Salvar etapa" }).click();
  await expect(linha).toContainText("4 documentos pedidos");

  // O projeto de Guarapuava ainda não iniciou a Fase 04: recebe só o documento novo.
  await page.goto("/projetos/projeto-demo-plano-diretor?etapa=etapa-pd-fase4-demo");
  const pedidos = page.locator("section", { has: page.getByRole("heading", { name: "Documentos solicitados" }) });
  await expect(pedidos.locator("div.divide-y > div")).toHaveCount(4);
  await expect(pedidos).toContainText("Relatório fotográfico");
  await expect(pedidos.getByText("Ata da audiência pública")).toHaveCount(1);
});

test("nenhuma etapa do modelo fica sem função", async ({ page }) => {
  await entrar(page, CTP.ana);
  await page.goto("/cadastros/tipos-de-projeto");
  for (const tipo of ["Estatuto e PCCS", "Plano Diretor", "Personalizado"]) {
    await page.getByRole("link", { name: new RegExp(`^${tipo}\\s*\\d+ etapas`) }).click();
    await expect(page.getByRole("heading", { name: tipo, exact: true })).toBeVisible();
    await expect(page.getByText("Sem função — só chat")).toHaveCount(0);
  }
});
