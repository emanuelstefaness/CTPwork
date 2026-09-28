import { expect, test, type Page } from "@playwright/test";
import { CTP, MUNICIPIO, SENHA, entrar, erroDoFormulario, selecionarTrecho } from "./ajuda";

/** Perfis (cargos) com permissões configuráveis, em Cadastros › Perfis. */
test.describe.configure({ mode: "serial" });

async function abrirPerfil(page: Page, nome: string) {
  await page.goto("/cadastros?aba=perfis");
  await page.getByRole("link", { name: new RegExp(`^${nome}`) }).click();
  await expect(page.getByRole("heading", { name: `Perfil — ${nome}` })).toBeVisible();
}

async function criarPerfil(page: Page, nome: string, tipo: "Equipe do CTP" | "Prefeitura", base: string) {
  await page.goto("/cadastros?aba=perfis");
  const form = page.locator("form", { hasText: "Criar perfil" });
  await form.getByLabel("Nome").fill(nome);
  await form.getByLabel("Para quem").selectOption({ label: tipo });
  await form.getByLabel("Começar com as permissões de").selectOption({ label: base });
  await form.getByRole("button", { name: "Criar perfil" }).click();
  await expect(page.getByRole("heading", { name: `Perfil — ${nome}` })).toBeVisible();
}

async function trocarPerfilDoUsuario(page: Page, email: string, perfil: string) {
  await page.goto("/cadastros?aba=usuarios");
  await page.locator("div.divide-y > div").filter({ hasText: email }).getByRole("link", { name: "Editar" }).click();
  const form = page.locator("form", { hasText: "Salvar alterações" });
  await form.getByLabel("Perfil").selectOption({ label: perfil });
  await form.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.locator("div.divide-y > div").filter({ hasText: email })).toContainText(perfil);
}

test("perfil da prefeitura sem parecer: revisa a minuta, mas não aprova nem pede ajustes", async ({ page }) => {
  await entrar(page, CTP.ana);
  await criarPerfil(page, "Servidor técnico", "Prefeitura", "Município (Prefeitura)");
  await page.getByLabel(/Dar o parecer da minuta/).uncheck();
  await page.getByRole("button", { name: "Salvar perfil" }).click();
  await expect(page.getByLabel(/Dar o parecer da minuta/)).not.toBeChecked();
  await trocarPerfilDoUsuario(page, MUNICIPIO.juliana, "Servidor técnico");

  await entrar(page, MUNICIPIO.juliana);
  await page.goto("/projetos/projeto-demo-pato-branco-pd?etapa=etapa-pb-fase1");
  const confirmar = page.getByRole("button", { name: "Confirmar leitura" });
  if (await confirmar.isVisible()) await confirmar.click();
  // Pode revisar (grifar/comentar)…
  await selecionarTrecho(page, "população");
  await expect(page.getByRole("button", { name: "Comentar" })).toBeVisible();
  // …mas o parecer não aparece para este perfil.
  await expect(page.getByRole("button", { name: "Aprovar" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Pedir ajustes" })).toHaveCount(0);

  // Devolve o perfil padrão.
  await entrar(page, CTP.ana);
  await trocarPerfilDoUsuario(page, MUNICIPIO.juliana, "Município");
});

test("perfil do CTP que vê só onde participa, sem dashboard e sem gerenciar contratos", async ({ page }) => {
  await entrar(page, CTP.ana);
  await criarPerfil(page, "Jurídico", "Equipe do CTP", "Colaborador (Equipe do CTP)");
  await page.getByLabel(/Ver o dashboard/).uncheck();
  await page.getByLabel(/Gerenciar contratos/).uncheck();
  await page.getByLabel(/Vê só os contratos e projetos em que participa/).check();
  await page.getByRole("button", { name: "Salvar perfil" }).click();
  await expect(page.getByLabel(/Vê só os contratos e projetos em que participa/)).toBeChecked();

  // Cria uma pessoa com esse perfil.
  await page.goto("/cadastros?aba=usuarios");
  const novo = page.locator("form", { hasText: "Criar usuário" });
  await novo.getByLabel("Nome").fill("Paula Jurídica");
  await novo.getByLabel("E-mail").fill("paula.juridica@ctp.org.br");
  await novo.getByLabel("Senha inicial").fill(SENHA);
  await novo.getByLabel("Setor").selectOption({ index: 1 });
  await novo.getByLabel("Perfil").selectOption({ label: "Jurídico" });
  await novo.getByRole("button", { name: "Criar usuário" }).click();
  await expect(page.locator("div.divide-y > div").filter({ hasText: "paula.juridica@ctp.org.br" })).toContainText("Jurídico");

  await entrar(page, "paula.juridica@ctp.org.br");
  await expect(page).toHaveURL(/\/projetos/); // sem dashboard, a página inicial é a de projetos
  await page.getByRole("button", { name: "Abrir menu" }).click();
  const menu = page.locator("aside nav");
  await expect(menu.getByRole("link", { name: "Projetos" })).toBeVisible();
  await expect(menu.getByRole("link", { name: "Dashboard" })).toHaveCount(0);
  await expect(menu.getByRole("link", { name: "Cadastros" })).toHaveCount(0);

  // Não participa de nenhum projeto: a lista vem vazia e o link direto não abre.
  await page.goto("/projetos");
  await expect(page.getByText("Guarapuava")).toHaveCount(0);
  expect((await page.goto("/projetos/projeto-demo-guarapuava"))?.status()).toBe(404);
  await page.goto("/contratos");
  await expect(page.getByRole("link", { name: "Novo contrato" })).toHaveCount(0);
  expect((await page.request.get("/api/documentos/documento-minuta-demo/docx")).status()).toBe(403);
});

test("etapa de contrato restrita a um perfil trava para os demais", async ({ page }) => {
  await entrar(page, CTP.ana);
  await page.goto("/cadastros?aba=fluxos-contrato");
  await page.getByPlaceholder("Ex.: Dispensa de licitação").fill("Termo aditivo");
  await page.getByRole("button", { name: "Criar" }).click();
  await expect(page.getByRole("heading", { name: "Etapas — Termo aditivo" })).toBeVisible();
  const nova = page.locator("form", { hasText: "Adicionar etapa ao final" });
  await nova.getByLabel("Nome da etapa").fill("Aprovação da diretoria");
  await nova.getByLabel(/Rótulo curto/).fill("Diretoria");
  await nova.getByRole("checkbox", { name: "Gestor" }).check();
  await nova.getByRole("button", { name: "Adicionar etapa" }).click();
  await expect(page.getByText("Só: Gestor")).toBeVisible();
  await nova.getByLabel("Nome da etapa").fill("Aditivo firmado");
  await nova.getByLabel(/Rótulo curto/).fill("Firmado");
  await nova.getByRole("button", { name: "Adicionar etapa" }).click();
  await expect(page.getByText("Aditivo firmado")).toBeVisible();

  await page.goto("/contratos/novo");
  await page.getByLabel("Tipo de contrato").selectOption({ label: "Termo aditivo" });
  await page.getByLabel("Objeto do contrato").fill("Aditivo de prazo — Plano Diretor");
  await page.getByLabel("Município contratante").selectOption({ label: "Prefeitura de Palmas" });
  await page.getByRole("button", { name: "Criar contrato" }).click();
  await expect(page).toHaveURL(/\/contratos\/c/);
  const endereco = new URL(page.url()).pathname;

  // Bruno (Colaborador) gerencia contratos, mas esta etapa é só do Gestor.
  await entrar(page, CTP.bruno);
  await page.goto(endereco);
  await expect(page.getByRole("button", { name: /Avançar para Firmado/ })).toBeDisabled();
  await expect(page.getByText(/só pode ser concluída por: Gestor/)).toBeVisible();

  await entrar(page, CTP.ana);
  await page.goto(endereco);
  await page.getByRole("button", { name: /Avançar para Firmado/ }).click();
  await expect(page.getByRole("button", { name: /Avançar para/ })).toHaveCount(0);
});

test("não dá para tirar de todos o acesso a Cadastros", async ({ page }) => {
  await entrar(page, CTP.ana);
  await abrirPerfil(page, "Gestor");
  await page.getByLabel(/Acessar Cadastros/).uncheck();
  await page.getByRole("button", { name: "Salvar perfil" }).click();
  await expect(erroDoFormulario(page)).toContainText("sem ninguém com acesso a Cadastros");
  await page.reload();
  await expect(page.getByLabel(/Acessar Cadastros/)).toBeChecked();
});
