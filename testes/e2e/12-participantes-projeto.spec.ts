import { expect, test, type Page } from "@playwright/test";
import { CTP, SENHA, criarPropriaSenha, entrar } from "./ajuda";

/**
 * Pessoas no projeto: quem gerencia contratos adiciona alguém da equipe para ver ou editar um
 * projeto específico. A participação só soma ao perfil — aqui, um consultor cujo perfil não permite
 * nada e só vê onde participa.
 */
test.describe.configure({ mode: "serial" });

const PROJETO = "/projetos/projeto-demo-mariopolis-pccs";
const ETAPA_MINUTA = `${PROJETO}?etapa=etapa-mar-min1`; // "Minutas versão 01", ainda não iniciada
const RUI = { nome: "Rui Consultor", email: "rui.consultor@ctp.org.br", senha: "Consultor2026" };

const pessoas = (page: Page) => page.locator("section", { has: page.getByRole("heading", { name: "Pessoas no projeto" }) });

test("perfil sem permissões que só vê onde participa: o consultor não enxerga o projeto", async ({ page }) => {
  await entrar(page, CTP.ana);
  await page.goto("/cadastros?aba=perfis");
  const criar = page.locator("form", { hasText: "Criar perfil" });
  await criar.getByLabel("Nome").fill("Consultor");
  await criar.getByLabel("Para quem").selectOption({ label: "Equipe do CTP" });
  await criar.getByLabel("Começar com as permissões de").selectOption({ label: "Colaborador (Equipe do CTP)" });
  await criar.getByRole("button", { name: "Criar perfil" }).click();
  await expect(page.getByRole("heading", { name: "Perfil — Consultor" })).toBeVisible();
  for (const permissao of [/Ver o dashboard/, /Gerenciar contratos/, /Gerenciar etapas de projeto/, /Escrever minutas/]) await page.getByLabel(permissao).uncheck();
  await page.getByLabel(/Vê só os contratos e projetos em que participa/).check();
  await page.getByRole("button", { name: "Salvar perfil" }).click();
  await expect(page.getByLabel(/Vê só os contratos e projetos em que participa/)).toBeChecked();

  await page.goto("/cadastros?aba=usuarios");
  const novo = page.locator("form", { hasText: "Criar usuário" });
  await novo.locator("input[name=nome]").fill(RUI.nome);
  await novo.locator("input[name=email]").fill(RUI.email);
  await novo.locator("input[name=senha]").fill(SENHA);
  await novo.getByLabel("Setor").selectOption({ index: 1 });
  await novo.getByLabel("Perfil").selectOption({ label: "Consultor" });
  await novo.getByRole("button", { name: "Criar usuário" }).click();
  await expect(page.locator("div.divide-y > div").filter({ hasText: RUI.email })).toContainText("Consultor");

  await entrar(page, RUI.email);
  await criarPropriaSenha(page, RUI.email, SENHA, RUI.senha);
  expect((await page.goto(PROJETO))?.status()).toBe(404);
});

test("adicionado para ver: enxerga o projeto e o contrato, mas não conduz etapas nem escreve a minuta", async ({ page }) => {
  await entrar(page, CTP.ana);
  await page.goto(PROJETO);
  await pessoas(page).getByLabel("Pessoa a adicionar").selectOption({ label: RUI.nome });
  await pessoas(page).getByLabel("Nível de acesso").selectOption("VER");
  await pessoas(page).getByRole("button", { name: "Adicionar" }).click();
  await expect(pessoas(page).locator(`[data-participante="${RUI.nome}"]`)).toContainText("Ver");

  await entrar(page, RUI.email, RUI.senha);
  // Foi avisado e o projeto aparece na lista dele.
  await page.goto("/notificacoes");
  await expect(page.getByText("adicionou você ao projeto PRJ-2026-031 para ver")).toBeVisible();
  await page.goto("/projetos");
  await expect(page.getByText("Mariópolis").first()).toBeVisible();
  await page.goto(ETAPA_MINUTA);
  await expect(page.getByRole("heading", { name: "Minutas versão 01" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Iniciar etapa" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Criar documento" })).toHaveCount(0);
  // Não gerencia contratos: não mexe nas pessoas do projeto.
  await expect(pessoas(page).getByLabel("Pessoa a adicionar")).toHaveCount(0);
  // O contrato de origem também fica visível.
  expect((await page.goto("/contratos/contrato-demo-mariopolis-pccs"))?.status()).toBe(200);
});

test("com permissão de editar: conduz as etapas e escreve a minuta só deste projeto", async ({ page }) => {
  await entrar(page, CTP.ana);
  await page.goto(PROJETO);
  await pessoas(page).locator(`[data-participante="${RUI.nome}"]`).getByRole("button", { name: "Permitir editar" }).click();
  await expect(pessoas(page).locator(`[data-participante="${RUI.nome}"]`)).toContainText("Editar");

  await entrar(page, RUI.email, RUI.senha);
  await page.goto(ETAPA_MINUTA);
  await page.getByRole("button", { name: "Iniciar etapa" }).click();
  await expect(page.getByText("Em andamento").first()).toBeVisible();
  await page.getByRole("button", { name: "Criar documento" }).click();
  await expect(page.locator(".ProseMirror[contenteditable=true]")).toBeVisible();
  // Em outro projeto, nada muda: continua sem enxergar.
  expect((await page.goto("/projetos/projeto-demo-guarapuava"))?.status()).toBe(404);
});

test("removido do projeto, deixa de enxergá-lo", async ({ page }) => {
  await entrar(page, CTP.ana);
  await page.goto(PROJETO);
  await pessoas(page).getByRole("button", { name: `Remover ${RUI.nome} do projeto` }).click();
  await expect(pessoas(page).locator(`[data-participante="${RUI.nome}"]`)).toHaveCount(0);

  await entrar(page, RUI.email, RUI.senha);
  expect((await page.goto(PROJETO))?.status()).toBe(404);
});
