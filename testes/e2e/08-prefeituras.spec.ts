import { expect, test, type Page } from "@playwright/test";
import { CTP, entrar, emailsPara, esperarEmail } from "./ajuda";

/**
 * Prefeitura nova do zero, pelo assistente: município + acessos (com convite por e-mail) +
 * fluxos exclusivos, e o que cada um passa a ver.
 */
test.describe.configure({ mode: "serial" });

const PREFEITURA = "Prefeitura de Clevelândia";
const PREFEITO = { nome: "Carlos Prefeito", email: "carlos@clevelandia.pr.gov.br" };
const SECRETARIA = { nome: "Beatriz Secretária", email: "beatriz@clevelandia.pr.gov.br" };

const linkDoConvite = (html: string) => {
  const url = new URL(html.match(/href="([^"]*redefinir-senha\?token=[^"]+)"/)![1].replace(/&amp;/g, "&"));
  return url.pathname + url.search;
};

async function aceitarConvite(page: Page, email: string, senha: string) {
  const html = await esperarEmail(email, "Convite para o CTP Work");
  await page.goto("about:blank");
  await page.context().clearCookies();
  await page.goto(linkDoConvite(emailsPara(email).at(-1) ?? html));
  await expect(page.getByRole("heading", { name: /Bem-vindo\(a\)/ })).toBeVisible();
  await page.getByLabel("Nova senha", { exact: true }).fill(senha);
  await page.getByLabel("Repita a nova senha", { exact: true }).fill(senha);
  await page.getByRole("button", { name: "Criar minha senha" }).click();
  await expect(page.getByRole("status")).toContainText("Sua senha foi criada");
}

test("assistente cadastra a prefeitura, os acessos e os fluxos exclusivos de uma vez", async ({ page }) => {
  await entrar(page, CTP.ana);
  await page.goto("/cadastros?aba=municipios");
  await page.getByRole("link", { name: "Nova prefeitura (assistente)" }).click();
  await expect(page.getByRole("heading", { name: "Nova prefeitura" })).toBeVisible();

  await page.getByLabel("Nome", { exact: true }).fill(PREFEITURA);
  await page.getByLabel("Nome do usuário 1").fill(PREFEITO.nome);
  await page.getByLabel("E-mail do usuário 1").fill(PREFEITO.email);
  await page.getByRole("button", { name: "Adicionar pessoa" }).click();
  await page.getByLabel("Nome do usuário 2").fill(SECRETARIA.nome);
  await page.getByLabel("E-mail do usuário 2").fill(SECRETARIA.email);
  await page.getByLabel("Tipo de contrato exclusivo").selectOption({ label: "Copiar de “Padrão”" });
  await page.getByLabel("Tipo de projeto exclusivo").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Cadastrar prefeitura e enviar convites" }).click();

  const resumo = page.getByRole("status").filter({ hasText: `${PREFEITURA} cadastrada.` });
  await expect(resumo).toBeVisible();
  await expect(resumo).toContainText(`Convite enviado para ${PREFEITO.nome}`);
  await expect(resumo).toContainText(`Convite enviado para ${SECRETARIA.nome}`);
  await expect(resumo).toContainText("Tipo de contrato exclusivo: Padrão — Clevelândia");
  await expect(resumo).toContainText("Tipo de projeto exclusivo:");

  // Os dois aparecem como "convite pendente" até criarem a senha.
  await page.goto("/cadastros?aba=usuarios");
  await expect(page.locator("div.divide-y > div").filter({ hasText: PREFEITO.email })).toContainText("Convite pendente");
});

test("o prefeito aceita o convite e entra vendo só a própria prefeitura", async ({ page }) => {
  await aceitarConvite(page, PREFEITO.email, "Clevelandia2026");
  await entrar(page, PREFEITO.email, "Clevelandia2026");
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await expect(page.locator("aside nav").getByRole("link", { name: "Meus projetos" })).toBeVisible();

  // Prefeitura nova: nada de outras prefeituras aparece.
  await page.goto("/projetos");
  await expect(page.getByText("Guarapuava")).toHaveCount(0);
  await page.goto("/contratos");
  await expect(page.getByText("Guarapuava")).toHaveCount(0);
  expect((await page.goto("/projetos/projeto-demo-guarapuava"))?.status()).toBe(404);

  // O convite é de uso único.
  await page.goto(linkDoConvite(emailsPara(PREFEITO.email).at(-1)!));
  await page.getByLabel("Nova senha", { exact: true }).fill("OutraSenha99");
  await page.getByLabel("Repita a nova senha", { exact: true }).fill("OutraSenha99");
  await page.getByRole("button", { name: /senha/ }).click();
  await expect(page.locator("form [role=alert]")).toContainText("expirou ou já foi usado");
});

test("tipo de contrato exclusivo só aparece para a própria prefeitura", async ({ page }) => {
  await entrar(page, CTP.ana);
  await page.goto("/contratos/novo");
  const tipo = page.getByLabel("Tipo de contrato");

  await page.getByLabel("Município contratante").selectOption({ label: "Prefeitura de Palmas" });
  await expect(tipo.locator("option", { hasText: "Clevelândia" })).toHaveCount(0);

  await page.getByLabel("Município contratante").selectOption({ label: PREFEITURA });
  // Para Clevelândia o exclusivo já vem sugerido.
  await expect(tipo.locator("option:checked")).toHaveText("Padrão — Clevelândia (exclusivo desta prefeitura)");
  await page.getByLabel("Objeto do contrato").fill("Revisão do Plano Diretor de Clevelândia");
  await page.getByRole("button", { name: "Criar contrato" }).click();
  await expect(page).toHaveURL(/\/contratos\/c/);
  await expect(page.getByText("Tipo de contrato: Padrão — Clevelândia")).toBeVisible();

  // E o prefeito vê o contrato da prefeitura dele.
  await entrar(page, PREFEITO.email, "Clevelandia2026");
  await page.goto("/contratos");
  await expect(page.getByText("Revisão do Plano Diretor de Clevelândia")).toBeVisible();
});

test("convite pendente pode ser reenviado, e cadastro avulso sem senha também convida", async ({ page }) => {
  await entrar(page, CTP.ana);
  await page.goto("/cadastros?aba=usuarios");
  const linhaPrefeito = page.locator("div.divide-y > div").filter({ hasText: PREFEITO.email });
  await expect(linhaPrefeito).not.toContainText("Convite pendente"); // já aceitou

  const antes = emailsPara(SECRETARIA.email).length;
  const linha = page.locator("div.divide-y > div").filter({ hasText: SECRETARIA.email });
  await linha.getByRole("button", { name: "Reenviar convite" }).click();
  await expect.poll(() => emailsPara(SECRETARIA.email).length).toBe(antes + 1);

  // Usuário avulso, sem senha: vai por convite.
  const novo = page.locator("form", { hasText: "Criar usuário" });
  await novo.locator("input[name=nome]").fill("Otávio Fiscal");
  await novo.locator("input[name=email]").fill("otavio@clevelandia.pr.gov.br");
  await novo.getByText("Usuário do município").click();
  await novo.locator("select[name=municipioId]").selectOption({ label: PREFEITURA });
  await novo.getByRole("button", { name: "Criar usuário" }).click();
  await expect(page.locator("div.divide-y > div").filter({ hasText: "otavio@clevelandia.pr.gov.br" })).toContainText("Convite pendente");
  await esperarEmail("otavio@clevelandia.pr.gov.br", "Convite para o CTP Work");
});
