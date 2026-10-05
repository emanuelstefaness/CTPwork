import { expect, test } from "@playwright/test";
import { CTP, entrar } from "./ajuda";

/**
 * Primeira versão do documento numa etapa sem nenhuma anterior: o rascunho nasce em branco e
 * precisa abrir o editor (com "Importar .docx"), não o aviso de versão antiga só em anexo.
 */
test("primeira versão em branco abre o editor, importa o Word e vai ao município", async ({ page }) => {
  await entrar(page, CTP.ana);
  // Um .docx de verdade: a minuta de Guarapuava exportada pelo próprio sistema.
  const docx = await page.request.get("/api/documentos/documento-minuta-demo/docx");
  expect(docx.status()).toBe(200);

  await page.goto("/projetos/projeto-demo-mariopolis-pccs?etapa=etapa-mar-diag");
  await page.getByRole("button", { name: "Criar documento" }).click();
  await expect(page.getByText("enviada como arquivo anexo")).toHaveCount(0);
  const editor = page.locator(".ProseMirror[contenteditable=true]");
  await expect(editor).toBeVisible();

  await page.locator("label", { hasText: "Importar .docx" }).locator("input[type=file]").setInputFiles({
    name: "Diagnostico_inicial_Mariopolis.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: await docx.body(),
  });
  await expect(page.getByText("Arquivo importado", { exact: false })).toBeVisible();
  await expect(editor).toContainText("Da progressão funcional");

  await page.getByRole("button", { name: "Enviar ao município" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(page.getByText("Versão 1 enviada ao município.")).toBeVisible();
});
