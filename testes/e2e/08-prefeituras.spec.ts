import { expect, test } from "@playwright/test";
import { CTP, entrar, erroDoFormulario } from "./ajuda";

/**
 * Prefeitura nova do zero, pelo assistente: município + acessos (e-mail e senha definidos pelo
 * gestor) + fluxos exclusivos, e o que cada um passa a ver.
 */
test.describe.configure({ mode: "serial" });

const PREFEITURA = "Prefeitura de Clevelândia";
const PREFEITO = { nome: "Carlos Prefeito", email: "carlos@clevelandia.pr.gov.br", senha: "Clevelandia2026" };
const SECRETARIA = { nome: "Beatriz Secretária", email: "beatriz@clevelandia.pr.gov.br" };

test("assistente cadastra a prefeitura, os acessos com senha e os fluxos exclusivos de uma vez", async ({ page }) => {
  await entrar(page, CTP.ana);
  await page.goto("/cadastros?aba=municipios");
  await page.getByRole("link", { name: "Nova prefeitura (assistente)" }).click();
  await expect(page.getByRole("heading", { name: "Nova prefeitura" })).toBeVisible();

  await page.getByLabel("Nome", { exact: true }).fill(PREFEITURA);
  await page.getByLabel("Nome do usuário 1").fill(PREFEITO.nome);
  await page.getByLabel("E-mail do usuário 1").fill(PREFEITO.email);
  await page.getByLabel("Senha do usuário 1", { exact: true }).fill(PREFEITO.senha);
  await page.getByRole("button", { name: "Adicionar pessoa" }).click();
  await page.getByLabel("Nome do usuário 2").fill(SECRETARIA.nome);
  await page.getByLabel("E-mail do usuário 2").fill(SECRETARIA.email);
  await page.getByLabel("Tipo de contrato exclusivo").selectOption({ label: "Copiar de “Padrão”" });
  await page.getByLabel("Tipo de projeto exclusivo").selectOption({ index: 1 });

  // Sem senha para a secretária: o servidor recusa e nada é criado.
  await page.getByRole("button", { name: "Cadastrar prefeitura" }).click();
  await expect(erroDoFormulario(page)).toContainText(`A senha de ${SECRETARIA.nome} precisa ter ao menos 8 caracteres`);

  // "Gerar" preenche uma senha forte, visível para o gestor repassar.
  await page.getByRole("button", { name: "Gerar senha do usuário 2" }).click();
  await expect(page.getByLabel("Senha do usuário 2", { exact: true })).toHaveValue(/^(?=.*\d)(?=.*[a-zA-Z])[a-zA-Z\d]{10}$/);
  await page.getByRole("button", { name: "Cadastrar prefeitura" }).click();

  const resumo = page.getByRole("status").filter({ hasText: `${PREFEITURA} cadastrada.` });
  await expect(resumo).toBeVisible();
  await expect(resumo).toContainText(`Acesso criado para ${PREFEITO.nome} — login: ${PREFEITO.email}`);
  await expect(resumo).toContainText(`Acesso criado para ${SECRETARIA.nome} — login: ${SECRETARIA.email}`);
  await expect(resumo).toContainText("Tipo de contrato exclusivo: Padrão — Clevelândia");
  await expect(resumo).toContainText("Tipo de projeto exclusivo:");
});

test("o prefeito entra com a senha definida e vê só a própria prefeitura", async ({ page }) => {
  await entrar(page, PREFEITO.email, PREFEITO.senha);
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await expect(page.locator("aside nav").getByRole("link", { name: "Meus projetos" })).toBeVisible();

  // Prefeitura nova: nada de outras prefeituras aparece, nem por link direto.
  await page.goto("/projetos");
  await expect(page.getByText("Guarapuava")).toHaveCount(0);
  await page.goto("/contratos");
  await expect(page.getByText("Guarapuava")).toHaveCount(0);
  expect((await page.goto("/projetos/projeto-demo-guarapuava"))?.status()).toBe(404);
  expect((await page.goto("/contratos/contrato-demo-guarapuava"))?.status()).toBe(404);
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
  await entrar(page, PREFEITO.email, PREFEITO.senha);
  await page.goto("/contratos");
  await expect(page.getByText("Revisão do Plano Diretor de Clevelândia")).toBeVisible();
});

test("cadastro avulso exige senha, e o gestor pode trocar a senha depois", async ({ page }) => {
  await entrar(page, CTP.ana);
  await page.goto("/cadastros?aba=usuarios");
  const novo = page.locator("form", { hasText: "Criar usuário" });
  await novo.locator("input[name=nome]").fill("Otávio Fiscal");
  await novo.locator("input[name=email]").fill("otavio@clevelandia.pr.gov.br");
  await novo.locator("input[name=senha]").fill("Fiscal2026");
  await novo.getByText("Usuário do município").click();
  await novo.locator("select[name=municipioId]").selectOption({ label: PREFEITURA });
  await novo.getByRole("button", { name: "Criar usuário" }).click();
  const linha = page.locator("div.divide-y > div").filter({ hasText: "otavio@clevelandia.pr.gov.br" });
  await expect(linha).toBeVisible();

  // Troca a senha pelo "Editar".
  await linha.getByRole("link", { name: "Editar" }).click();
  const editar = page.locator("form", { hasText: "Salvar alterações" });
  await editar.locator("input[name=novaSenha]").fill("NovaSenha2027");
  await editar.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(editar).toHaveCount(0);

  await entrar(page, "otavio@clevelandia.pr.gov.br", "NovaSenha2027");
  await expect(page).toHaveURL(/\/projetos/);
});
