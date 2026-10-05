import { expect, test } from "@playwright/test";
import { CTP, entrar } from "./ajuda";

/** Modelo de etapas do projeto: documentos pedidos por padrão e aplicação aos projetos em andamento. */
test.describe.configure({ mode: "serial" });

const FASE = "Fase 04 — Audiência pública";

test("documento padrão novo no modelo chega às etapas não iniciadas, sem duplicar os que já existem", async ({ page }) => {
  await entrar(page, CTP.ana);
  await page.goto("/cadastros?aba=fluxos");
  await page.getByRole("link", { name: /^Plano Diretor\s*\d+$/ }).click();
  await expect(page.getByRole("heading", { name: "Fluxo de etapas — Plano Diretor" })).toBeVisible();

  const linha = page.getByText(FASE, { exact: true }).locator("..");
  await expect(linha).toContainText("Checklist · 3 doc. padrão");
  await linha.getByRole("button", { name: "Editar etapa" }).click();

  const form = page.locator("form", { has: page.locator("input[name=etapaModeloId]") });
  const documentos = form.locator("textarea[name=documentosPadrao]");
  await expect(documentos).toHaveValue(/Ata da audiência pública/);
  await documentos.fill(`${await documentos.inputValue()}\nRelatório fotográfico`);
  await expect(form.locator("input[name=aplicarAosProjetos]")).toBeChecked();
  await form.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText(FASE, { exact: true }).locator("..")).toContainText("Checklist · 4 doc. padrão");

  // O projeto de Guarapuava ainda não iniciou a Fase 04: recebe só o documento novo.
  await page.goto("/projetos/projeto-demo-plano-diretor?etapa=etapa-pd-fase4-demo");
  const pedidos = page.locator("section", { has: page.getByRole("heading", { name: "Documentos solicitados" }) });
  await expect(pedidos.locator("div.divide-y > div")).toHaveCount(4);
  await expect(pedidos).toContainText("Relatório fotográfico");
  await expect(pedidos.getByText("Ata da audiência pública")).toHaveCount(1);
});

test("nenhuma etapa do modelo fica sem função", async ({ page }) => {
  await entrar(page, CTP.ana);
  await page.goto("/cadastros?aba=fluxos");
  for (const tipo of [/^Estatuto e PCCS\s*\d+$/, /^Plano Diretor\s*\d+$/, /^Personalizado\s*\d+$/]) {
    await page.getByRole("link", { name: tipo }).click();
    await expect(page.getByRole("heading", { name: /^Fluxo de etapas/ })).toBeVisible();
    await expect(page.getByText("Sem função — só chat")).toHaveCount(0);
  }
});
