import { expect, test } from "@playwright/test";
import { CTP, abrirEntrada, criarPropriaSenha, entrar, erroDoFormulario } from "./ajuda";

/**
 * Prefeitura nova do zero, pelo assistente: município + acessos (e-mail e senha definidos pelo
 * gestor) + fluxos exclusivos, e o que cada um passa a ver.
 */
test.describe.configure({ mode: "serial" });

const PREFEITURA = "Prefeitura de Clevelândia";
// `senha` é a que o gestor define no cadastro; `propria`, a que o prefeito cria no primeiro acesso.
const PREFEITO = { nome: "Carlos Prefeito", email: "carlos@clevelandia.pr.gov.br", senha: "Clevelandia2026", propria: "MinhaSenha2026" };
const SECRETARIA = { nome: "Beatriz Secretária", email: "beatriz@clevelandia.pr.gov.br" };

test("assistente cadastra a prefeitura, os acessos com senha e os fluxos exclusivos de uma vez", async ({ page }) => {
  await entrar(page, CTP.ana);
  await page.goto("/cadastros/prefeituras");
  await page.getByRole("link", { name: "Nova prefeitura" }).click();
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
  await expect(erroDoFormulario(page)).toContainText(`Senha de ${SECRETARIA.nome}: A senha precisa ter pelo menos 8 caracteres`);

  // "Gerar" preenche uma senha forte, visível para o gestor repassar.
  await page.getByRole("button", { name: "Gerar senha do usuário 2" }).click();
  await expect(page.getByLabel("Senha do usuário 2", { exact: true })).toHaveValue(/^(?=.*\d)(?=.*[a-zA-Z])[a-zA-Z\d]{12}$/);
  await page.getByRole("button", { name: "Cadastrar prefeitura" }).click();

  const resumo = page.getByRole("status").filter({ hasText: `${PREFEITURA} cadastrada.` });
  await expect(resumo).toBeVisible();
  await expect(resumo).toContainText(`Acesso criado para ${PREFEITO.nome} — login: ${PREFEITO.email}`);
  await expect(resumo).toContainText(`Acesso criado para ${SECRETARIA.nome} — login: ${SECRETARIA.email}`);
  await expect(resumo).toContainText("Tipo de contrato exclusivo: Padrão — Clevelândia");
  await expect(resumo).toContainText("Tipo de projeto exclusivo:");
  // Depois do assistente, a página da prefeitura já mostra os acessos.
  await expect(page.getByRole("heading", { name: PREFEITURA })).toBeVisible();
  await expect(page.locator(`[data-pessoa="${PREFEITO.email}"]`)).toContainText("Município");
});

test("no primeiro acesso o prefeito cria a própria senha e depois vê só a própria prefeitura", async ({ page }) => {
  await entrar(page, PREFEITO.email, PREFEITO.senha);
  // Até criar a própria senha, qualquer tela leva de volta a "Minha conta".
  await page.goto("/projetos");
  await expect(page).toHaveURL(/\/conta/);
  await criarPropriaSenha(page, PREFEITO.email, PREFEITO.senha, PREFEITO.propria);

  // A senha definida pelo gestor deixou de valer.
  await abrirEntrada(page);
  await page.getByLabel("E-mail").fill(PREFEITO.email);
  await page.getByLabel("Senha", { exact: true }).fill(PREFEITO.senha);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(erroDoFormulario(page)).toHaveText("E-mail ou senha incorretos.");

  await entrar(page, PREFEITO.email, PREFEITO.propria);
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
  await entrar(page, PREFEITO.email, PREFEITO.propria);
  await page.goto("/contratos");
  await expect(page.getByText("Revisão do Plano Diretor de Clevelândia")).toBeVisible();
});

test("novo acesso na página da prefeitura exige senha, e o gestor pode trocar a senha depois", async ({ page }) => {
  await entrar(page, CTP.ana);
  await page.goto("/cadastros/prefeituras");
  await page.getByRole("link", { name: new RegExp(PREFEITURA) }).click();
  await page.getByRole("link", { name: "Novo acesso" }).click();
  const novo = page.locator("form", { hasText: "Criar acesso" });
  await novo.locator("input[name=nome]").fill("Otávio Fiscal");
  await novo.locator("input[name=email]").fill("otavio@clevelandia.pr.gov.br");
  await novo.getByRole("button", { name: "Criar acesso" }).click();
  await expect(page.locator('[data-pessoa="otavio@clevelandia.pr.gov.br"]')).toHaveCount(0); // sem senha, o navegador nem envia
  await novo.locator("input[name=senha]").fill("Fiscal2026");
  await novo.getByRole("button", { name: "Criar acesso" }).click();
  const linha = page.locator('[data-pessoa="otavio@clevelandia.pr.gov.br"]');
  await expect(linha).toBeVisible();

  // Troca a senha pelo "Editar".
  await linha.getByRole("link", { name: "Editar" }).click();
  await linha.locator("input[name=novaSenha]").fill("NovaSenha2027");
  await linha.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(linha.getByRole("button", { name: "Salvar alterações" })).toHaveCount(0);

  // Senha nova dada pelo gestor também precisa ser trocada pela pessoa no acesso seguinte.
  await entrar(page, "otavio@clevelandia.pr.gov.br", "NovaSenha2027");
  await criarPropriaSenha(page, "otavio@clevelandia.pr.gov.br", "NovaSenha2027", "Otavio2027ok");
  await page.goto("/projetos");
  await expect(page).toHaveURL(/\/projetos/);
});
