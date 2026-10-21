import { expect, test } from "@playwright/test";
import { CTP, entrar } from "./ajuda";

/** Cadastros › Formulários: modelos de memorando e o formulário (único) das etapas de projeto. */
test.describe.configure({ mode: "serial" });

const MODELO = "Pedido de diária";

test("gestor cria um modelo de memorando sem lidar com chaves internas", async ({ page }) => {
  await entrar(page, CTP.ana);
  await page.goto("/cadastros/formularios");
  await page.getByRole("link", { name: "Novo modelo" }).click();
  await page.getByLabel("Nome do formulário").fill(MODELO);
  await page.getByLabel("Pergunta 1").fill("Cidade de destino");
  await page.getByRole("button", { name: "Adicionar campo" }).click();
  await page.getByLabel("Pergunta 2").fill("Data da viagem");
  await page.getByLabel("Tipo da resposta 2").selectOption("date");
  await page.getByRole("button", { name: "Criar formulário" }).click();
  await expect(page.getByText(MODELO)).toBeVisible();
  await expect(page.getByText("2 campos: Cidade de destino, Data da viagem")).toBeVisible();

  // Aparece ao escrever um memorando, com os campos na ordem.
  await page.goto("/memorandos/novo");
  await page.locator("select[name=modeloId]").selectOption({ label: MODELO });
  await expect(page.getByText("Cidade de destino")).toBeVisible();
  await expect(page.locator("input[type=date]").first()).toBeVisible();
});

test("gestor renomeia um campo do modelo (a chave interna, coberta no teste de unidade, não muda)", async ({ page }) => {
  await entrar(page, CTP.ana);
  await page.goto("/cadastros/formularios");
  await page.locator(`[data-formulario="${MODELO}"]`).getByRole("link", { name: "Editar" }).click();
  await page.getByLabel("Pergunta 1").fill("Cidade e estado de destino");
  await page.getByRole("button", { name: "Salvar formulário" }).click();
  await expect(page.getByText("2 campos: Cidade e estado de destino, Data da viagem")).toBeVisible();
});

test("as etapas de projeto têm um formulário só: não se cria um segundo", async ({ page }) => {
  await entrar(page, CTP.ana);
  await page.goto("/cadastros/formularios");
  const secao = page.locator("section", { has: page.getByRole("heading", { name: "Formulário das etapas de projeto" }) });
  await expect(secao.getByRole("link", { name: "Editar" })).toBeVisible();
  await expect(secao.getByRole("link", { name: "Criar" })).toHaveCount(0);
  // Nem pelo endereço direto.
  await page.goto("/cadastros/formularios?novo=CONTRATO");
  await expect(page.getByRole("button", { name: "Criar formulário" })).toHaveCount(0);
});
