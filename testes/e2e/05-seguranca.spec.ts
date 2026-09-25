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
