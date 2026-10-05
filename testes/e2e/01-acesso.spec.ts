import { expect, test } from "@playwright/test";
import { CTP, MUNICIPIO, SENHA, entrar, erroDoFormulario, esperarEmail } from "./ajuda";

test.describe("Acesso e conta", () => {
  test("senha errada mostra o erro e mantém o e-mail digitado", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(CTP.bruno);
    await page.getByLabel("Senha", { exact: true }).fill("senha-errada-1");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(erroDoFormulario(page)).toHaveText("E-mail ou senha incorretos.");
    await expect(page.getByLabel("E-mail")).toHaveValue(CTP.bruno);
  });

  test("em produção a tela de login não mostra as contas de demonstração", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Acesse sua conta" })).toBeVisible();
    await expect(page.getByText("Contas de demonstração")).toHaveCount(0);
  });

  test("página interna sem login leva para a entrada", async ({ page }) => {
    await page.goto("/projetos");
    await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fprojetos/);
  });

  test("CTP e município entram e veem o menu certo", async ({ page }) => {
    await entrar(page, CTP.ana);
    await page.getByRole("button", { name: "Abrir menu" }).click();
    const menu = page.locator("aside nav");
    for (const item of ["Dashboard", "Memorandos", "Contratos", "Projetos", "Conversas", "Prazos", "Cadastros"]) {
      await expect(menu.getByRole("link", { name: item, exact: true })).toBeVisible();
    }

    await entrar(page, MUNICIPIO.marina);
    await page.getByRole("button", { name: "Abrir menu" }).click();
    await expect(menu.getByRole("link", { name: "Meus projetos" })).toBeVisible();
    await expect(menu.getByRole("link", { name: "Memorandos" })).toHaveCount(0);
  });

  test("município não enxerga projeto nem arquivo de outro município", async ({ page }) => {
    await entrar(page, MUNICIPIO.juliana); // Pato Branco
    await page.goto("/projetos");
    await expect(page.getByText("Guarapuava")).toHaveCount(0);

    await page.goto("/projetos/projeto-demo-guarapuava");
    await expect(page.getByRole("heading", { name: /Estatuto e PCCS/ })).toHaveCount(0);

    // Anexo de um documento de Guarapuava, pedido direto pela URL.
    const resposta = await page.request.get("/api/documentos/documento-minuta-demo/docx");
    expect(resposta.status()).toBe(403);
  });

  test("5 senhas erradas seguidas bloqueiam o login por 15 minutos", async ({ page }) => {
    await page.goto("/login");
    // Cada tentativa espera a resposta do servidor antes da próxima (a mensagem é igual nas 5).
    const tentar = async (senha: string) => {
      await page.getByLabel("E-mail").fill(MUNICIPIO.rogerio);
      await page.getByLabel("Senha", { exact: true }).fill(senha);
      await Promise.all([
        page.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === "/login"),
        page.getByRole("button", { name: "Entrar" }).click(),
      ]);
    };
    for (let i = 0; i < 5; i++) {
      await tentar(`errada-${i}`);
      await expect(erroDoFormulario(page)).toHaveText("E-mail ou senha incorretos.");
    }
    // Até a senha certa é recusada enquanto durar o bloqueio.
    await tentar(SENHA);
    await expect(erroDoFormulario(page)).toContainText("Muitas tentativas");
    await expect(page).toHaveURL(/\/login/);
  });

  test("esqueci minha senha: link por e-mail, uso único, e a nova senha funciona", async ({ page }) => {
    const email = MUNICIPIO.tatiane;
    await page.goto("/login");
    await page.getByRole("link", { name: "Esqueci minha senha" }).click();
    // Espera o formulário ficar interativo: enviado antes disso, o navegador faz um envio comum e nada aparece.
    await page.waitForLoadState("networkidle");
    await page.getByLabel("E-mail").fill(email);
    await page.getByRole("button", { name: "Enviar link" }).click();
    await expect(page.getByRole("status")).toContainText("Se houver uma conta com esse e-mail");

    const html = await esperarEmail(email, "redefinir-senha?token=");
    const link = html.match(/href="([^"]*redefinir-senha\?token=[^"]+)"/)![1].replace(/&amp;/g, "&");
    const caminho = new URL(link).pathname + new URL(link).search;

    await page.goto(caminho);
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Nova senha", { exact: true }).fill("somenteletras");
    await page.getByLabel("Repita a nova senha", { exact: true }).fill("somenteletras");
    await page.getByRole("button", { name: "Salvar nova senha" }).click();
    await expect(erroDoFormulario(page)).toHaveText("Use letras e números na nova senha.");

    await page.getByLabel("Nova senha", { exact: true }).fill("NovaSenha2026");
    await page.getByLabel("Repita a nova senha", { exact: true }).fill("NovaSenha2026");
    await page.getByRole("button", { name: "Salvar nova senha" }).click();
    await expect(page.getByRole("status")).toHaveText("Senha criada. Entre com a nova senha.");

    // O mesmo link não vale uma segunda vez.
    await page.goto(caminho);
    await page.getByLabel("Nova senha", { exact: true }).fill("OutraSenha2026");
    await page.getByLabel("Repita a nova senha", { exact: true }).fill("OutraSenha2026");
    await page.getByRole("button", { name: "Salvar nova senha" }).click();
    await expect(erroDoFormulario(page)).toContainText("expirou ou já foi usado");

    await entrar(page, email, "NovaSenha2026");
  });

  test("minha conta: troca de senha exige a senha atual", async ({ page }) => {
    await entrar(page, MUNICIPIO.helena);
    await page.goto("/conta");
    await page.getByLabel("Senha atual", { exact: true }).fill("errada123");
    await page.getByLabel("Nova senha", { exact: true }).fill("Helena2026x");
    await page.getByLabel("Repita a nova senha", { exact: true }).fill("Helena2026x");
    await page.getByRole("button", { name: "Alterar senha" }).click();
    await expect(erroDoFormulario(page)).toHaveText("A senha atual está incorreta.");

    await page.getByLabel("Senha atual", { exact: true }).fill(SENHA);
    await page.getByLabel("Nova senha", { exact: true }).fill("Helena2026x");
    await page.getByLabel("Repita a nova senha", { exact: true }).fill("Helena2026x");
    await page.getByRole("button", { name: "Alterar senha" }).click();
    await expect(page.getByRole("status")).toHaveText("Senha alterada.");

    await entrar(page, MUNICIPIO.helena, "Helena2026x");

    // Devolve a senha padrão: outros testes entram como Helena.
    await page.goto("/conta");
    await page.getByLabel("Senha atual", { exact: true }).fill("Helena2026x");
    await page.getByLabel("Nova senha", { exact: true }).fill(SENHA);
    await page.getByLabel("Repita a nova senha", { exact: true }).fill(SENHA);
    await page.getByRole("button", { name: "Alterar senha" }).click();
    await expect(page.getByRole("status")).toHaveText("Senha alterada.");
  });
});
