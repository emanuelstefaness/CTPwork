import { expect, test } from "@playwright/test";
import { CTP, MUNICIPIO, entrar, esperarEmail } from "./ajuda";

/** Conversa geral (fora das etapas) entre o CTP e a Prefeitura de Mariópolis. */
test.describe.configure({ mode: "serial" });

const ASSUNTO = "Agenda da audiência pública de Mariópolis"; // o banco de teste é recriado a cada execução
let endereco = "";

test("CTP abre uma conversa com o município, citando o projeto", async ({ page }) => {
  await entrar(page, CTP.ana);
  await page.goto("/conversas/nova?projeto=projeto-demo-mariopolis-pccs");
  await expect(page.locator("select[name=municipioId] option:checked")).toHaveText("Prefeitura de Mariópolis"); // preenchido pelo projeto
  await expect(page.getByLabel(/Sobre qual contrato ou projeto/)).toHaveValue("projeto:projeto-demo-mariopolis-pccs");
  await page.getByLabel("Assunto", { exact: true }).fill(ASSUNTO);
  await page.getByLabel("Mensagem", { exact: true }).fill("Bom dia! Podemos marcar a audiência para 10/10 às 14h?");
  await page.getByRole("button", { name: "Iniciar conversa" }).click();
  await expect(page).toHaveURL(/\/conversas\/c/);
  await expect(page.getByRole("heading", { name: ASSUNTO })).toBeVisible();
  endereco = new URL(page.url()).pathname;

  await esperarEmail(MUNICIPIO.helena, ASSUNTO);
});

test("município vê a conversa como não lida e responde com anexo", async ({ page }) => {
  await entrar(page, MUNICIPIO.helena);
  const icone = page.locator("header a[href='/conversas']");
  await expect(icone).toHaveAttribute("aria-label", /não lidas/);

  await page.goto("/conversas?filtro=aguardando");
  await page.getByRole("link", { name: ASSUNTO }).click();
  await expect(page).toHaveURL(endereco);
  await page.getByLabel("Mensagem", { exact: true }).fill("Pode ser! Segue a reserva do auditório.");
  await page.locator("input[name=arquivo]").setInputFiles({ name: "reserva-auditorio.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%reserva\n") });
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(page.getByText("Pode ser! Segue a reserva do auditório.")).toBeVisible();
  await expect(page.getByRole("link", { name: /reserva-auditorio\.pdf/ })).toBeVisible();

  // Abrir a conversa marca como lida.
  await expect(icone).toHaveAttribute("aria-label", "Conversas");

  await esperarEmail(CTP.ana, "Pode ser! Segue a reserva do auditório.");
});

test("outro município não acessa a conversa", async ({ page }) => {
  await entrar(page, MUNICIPIO.juliana);
  const resposta = await page.goto(endereco);
  expect(resposta?.status()).toBe(404);
  await page.goto("/conversas?filtro=todas");
  await expect(page.getByText(ASSUNTO)).toHaveCount(0);
});

test("CTP encerra a conversa e ela sai das abertas", async ({ page }) => {
  await entrar(page, CTP.ana);
  await page.goto(endereco);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Encerrar conversa" }).click();
  await expect(page.getByRole("button", { name: "Reabrir conversa" })).toBeVisible();
  await page.goto("/conversas");
  await expect(page.getByText(ASSUNTO)).toHaveCount(0);
  await page.goto("/conversas?filtro=encerradas");
  await expect(page.getByText(ASSUNTO)).toBeVisible();
});
