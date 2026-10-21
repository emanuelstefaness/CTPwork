import { expect, test, type Page } from "@playwright/test";
import { CTP, MUNICIPIO, SENHA, entrar, erroDoFormulario } from "./ajuda";

test.describe("Cabeçalhos de segurança", () => {
  test("páginas saem com CSP com nonce e os cabeçalhos de proteção", async ({ page }) => {
    const resposta = await page.goto("/login");
    const h = resposta!.headers();
    expect(h["content-security-policy"]).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["content-security-policy"]).not.toContain("unsafe-eval"); // só em desenvolvimento
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["permissions-policy"]).toContain("camera=()");
    expect(h["strict-transport-security"]).toContain("max-age=");
    expect(h["x-powered-by"]).toBeUndefined();

    // O nonce muda a cada requisição.
    const outra = await page.request.get("/login");
    expect(outra.headers()["content-security-policy"]).not.toBe(h["content-security-policy"]);
  });

  test("arquivos e API também saem com nosniff (sem CSP, para o PDF abrir no navegador)", async ({ page }) => {
    await entrar(page, CTP.ana);
    const resposta = await page.request.get("/api/documentos/documento-minuta-demo/docx");
    expect(resposta.headers()["x-content-type-options"]).toBe("nosniff");
    expect(resposta.headers()["content-security-policy"]).toBeUndefined();
  });

  /** A CSP não pode quebrar nenhuma tela: nenhum bloqueio no console e a parte interativa funciona. */
  async function semBloqueios(page: Page, caminho: string, prontoQuando: string) {
    const bloqueios: string[] = [];
    page.on("console", (m) => { if (/Content Security Policy|Refused to/.test(m.text())) bloqueios.push(m.text()); });
    await page.goto(caminho);
    await expect(page.locator(prontoQuando).first()).toBeVisible();
    expect(bloqueios, `bloqueios de CSP em ${caminho}`).toEqual([]);
  }

  test("CSP não bloqueia o editor, os gráficos, a impressão nem as páginas públicas", async ({ page }) => {
    await semBloqueios(page, "/esqueci-senha", "input[name=email]");
    await entrar(page, CTP.ana);
    await semBloqueios(page, "/dashboard", ".recharts-surface");
    await semBloqueios(page, "/projetos/projeto-demo-guarapuava?etapa=etapa-minuta-demo", ".ProseMirror");
    await semBloqueios(page, "/documentos/documento-minuta-demo/imprimir", ".ProseMirror");
    await semBloqueios(page, "/conversas", "h1");

    // Interação depende de JavaScript: abrir o menu sanduíche.
    await page.getByRole("button", { name: "Abrir menu" }).click();
    await expect(page.locator("aside nav").getByRole("link", { name: "Dashboard" })).toBeVisible();
  });
});

test.describe("Desativar acesso de usuário", () => {
  test.describe.configure({ mode: "serial" });

  const linhaDe = (page: Page, email: string) => page.locator("div.divide-y > div").filter({ hasText: email });

  test("gestor desativa: a pessoa é desconectada na hora e não entra mais; reativada, volta a entrar", async ({ page, browser }) => {
    // Ricardo (Pato Branco) está usando o sistema numa outra janela.
    const contexto = await browser.newContext();
    const ricardo = await contexto.newPage();
    await entrar(ricardo, MUNICIPIO.ricardo);
    await ricardo.goto("/projetos");
    await expect(ricardo.locator("h1")).toBeVisible();

    // Ana, gestora, desativa o acesso dele.
    await entrar(page, CTP.ana);
    await page.goto("/cadastros?aba=usuarios");
    page.once("dialog", (d) => d.accept());
    await linhaDe(page, MUNICIPIO.ricardo).getByRole("button", { name: "Desativar acesso" }).click();
    await expect(linhaDe(page, MUNICIPIO.ricardo).getByText(/Desativado/)).toBeVisible();
    await expect(linhaDe(page, MUNICIPIO.ricardo).getByRole("button", { name: "Reativar acesso" })).toBeVisible();

    // No próximo clique, Ricardo cai na tela de entrada com o aviso…
    await ricardo.goto("/projetos");
    await expect(ricardo).toHaveURL(/\/login\?sessao=encerrada/);
    await expect(ricardo.getByRole("status")).toContainText("Sua sessão foi encerrada");
    // …e não consegue entrar de novo, nem com a senha certa.
    await ricardo.getByLabel("E-mail").fill(MUNICIPIO.ricardo);
    await ricardo.getByLabel("Senha", { exact: true }).fill(SENHA);
    await ricardo.getByRole("button", { name: "Entrar" }).click();
    await expect(erroDoFormulario(ricardo)).toHaveText("E-mail ou senha incorretos.");

    // Reativado, entra normalmente.
    await linhaDe(page, MUNICIPIO.ricardo).getByRole("button", { name: "Reativar acesso" }).click();
    await expect(linhaDe(page, MUNICIPIO.ricardo).getByRole("button", { name: "Desativar acesso" })).toBeVisible();
    await entrar(ricardo, MUNICIPIO.ricardo);
    await contexto.close();
  });

  test("gestor não vê o botão para desativar a si mesmo", async ({ page }) => {
    await entrar(page, CTP.ana);
    await page.goto("/cadastros?aba=usuarios");
    await expect(linhaDe(page, CTP.ana).getByRole("button", { name: "Desativar acesso" })).toHaveCount(0);
    await expect(linhaDe(page, CTP.bruno).getByRole("button", { name: "Desativar acesso" })).toBeVisible();
  });

  test("usuário desativado some das listas de escolha (ex.: responsável por um contrato novo)", async ({ page }) => {
    await entrar(page, CTP.ana);
    await page.goto("/cadastros?aba=usuarios");
    page.once("dialog", (d) => d.accept());
    await linhaDe(page, CTP.bruno).getByRole("button", { name: "Desativar acesso" }).click();
    await expect(linhaDe(page, CTP.bruno).getByRole("button", { name: "Reativar acesso" })).toBeVisible();

    await page.goto("/contratos/novo");
    await expect(page.locator("select[name=responsavelId] option", { hasText: "Bruno" })).toHaveCount(0);

    // Devolve o acesso: outros testes usam o Bruno.
    await page.goto("/cadastros?aba=usuarios");
    await linhaDe(page, CTP.bruno).getByRole("button", { name: "Reativar acesso" }).click();
    await expect(linhaDe(page, CTP.bruno).getByRole("button", { name: "Desativar acesso" })).toBeVisible();
  });
});

test.describe("Senhas, sessões e anexos", () => {
  test("trocar a senha encerra todas as sessões abertas, e a pessoa entra de novo com a senha nova", async ({ page, browser }) => {
    const outro = await browser.newContext();
    const celular = await outro.newPage();
    await entrar(celular, MUNICIPIO.juliana);
    await celular.goto("/projetos");
    await expect(celular.locator("h1")).toBeVisible();

    const trocar = async (atual: string, nova: string) => {
      await page.goto("/conta");
      await page.getByLabel("Senha atual", { exact: true }).fill(atual);
      await page.getByLabel("Nova senha", { exact: true }).fill(nova);
      await page.getByLabel("Repita a nova senha", { exact: true }).fill(nova);
      await page.getByRole("button", { name: "Alterar senha" }).click();
      await expect(page).toHaveURL(/\/login\?senha=alterada/);
      await expect(page.getByRole("status")).toContainText("Senha alterada");
    };
    await entrar(page, MUNICIPIO.juliana);
    await trocar(SENHA, "Juliana2026x");

    // O outro navegador, aberto com a senha antiga, cai na entrada no próximo clique.
    await celular.goto("/projetos");
    await expect(celular).toHaveURL(/\/login\?sessao=encerrada/);
    await outro.close();

    await entrar(page, MUNICIPIO.juliana, "Juliana2026x");
    await trocar("Juliana2026x", SENHA); // devolve a senha padrão: outros testes entram como Juliana
  });

  test("o limite de tentativas vale também para quem chama a API de login direto", async ({ page }) => {
    const email = "municipio@cilla.mg.gov.br";
    for (let i = 0; i < 5; i++) {
      const { csrfToken } = await (await page.request.get("/api/auth/csrf")).json();
      await page.request.post("/api/auth/callback/credentials", { form: { email, password: `errada-${i}`, csrfToken }, maxRedirects: 0 });
    }
    // Pelo formulário, nem a senha certa entra enquanto durar o bloqueio.
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha", { exact: true }).fill(SENHA);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(erroDoFormulario(page)).toContainText("Muitas tentativas");
  });

  test("arquivo disfarçado (página HTML com nome de PDF) é recusado", async ({ page }) => {
    await entrar(page, MUNICIPIO.marina);
    await page.goto("/conversas/nova");
    await page.waitForLoadState("networkidle");
    await page.getByRole("textbox", { name: "Assunto" }).fill("Envio de orçamento");
    await page.getByLabel("Mensagem", { exact: true }).fill("Segue o orçamento.");
    await page.locator("input[name=arquivo]").setInputFiles({
      name: "orcamento.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("<html><body><script>alert(document.cookie)</script></body></html>"),
    });
    await page.getByRole("button", { name: /Iniciar conversa|Enviar/ }).click();
    await expect(erroDoFormulario(page)).toContainText('não é um arquivo .pdf válido');
    await expect(page).toHaveURL(/\/conversas\/nova/);
  });
});
