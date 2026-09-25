import { defineConfig } from "@playwright/test";

/**
 * Testes de ponta a ponta: sobem o sistema em modo produção, com banco e arquivos próprios
 * (scripts/servidor-teste.mjs), e percorrem os fluxos principais no navegador.
 *
 *   npm run test:e2e            → prepara tudo do zero (banco, seed, build) e roda
 *   PULAR_BUILD=1 npm run test:e2e → reaproveita o último build
 *
 * Usa o Google Chrome instalado na máquina. Numa máquina sem Chrome (ex.: CI), rode
 * `npx playwright install chromium` e defina PW_NAVEGADOR=chromium.
 */
const PORTA = process.env.PORTA_TESTE ?? "4200";

export default defineConfig({
  testDir: "testes/e2e",
  // Os testes compartilham um banco: rodam em sequência, na ordem dos arquivos.
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "testes/relatorio" }]],
  outputDir: "testes/resultados",
  use: {
    baseURL: `http://127.0.0.1:${PORTA}`,
    channel: process.env.PW_NAVEGADOR === "chromium" ? undefined : "chrome",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "node scripts/servidor-teste.mjs",
    url: `http://127.0.0.1:${PORTA}/login`,
    env: { PORTA_TESTE: PORTA },
    timeout: 10 * 60_000,
    reuseExistingServer: false,
    stdout: "pipe",
    stderr: "pipe",
  },
});
