// Simulação de ponta a ponta de um contrato novo, pelos dois lados, no sistema rodando em
// http://localhost:4100 (npm run dev). Cada pessoa usa uma sessão própria do navegador.
//   node scripts/simular-contrato.mjs [pasta-dos-prints]
// Usa as contas de demonstração (seed + seed:vitrine): Ana (CTP), Carlos (prefeito) e Beatriz (servidora).
import { chromium } from "@playwright/test";
import { mkdir } from "fs/promises";
import path from "path";

const BASE = process.env.BASE_URL ?? "http://localhost:4100";
const SENHA = "ctpwork123";
const PASTA = process.argv[2] ?? "simulacao";
const OBJETO = `Plano de Mobilidade Urbana de Clevelândia (simulação ${new Date().toLocaleString("pt-BR")})`;
const pdf = (nome) => ({ name: nome, mimeType: "application/pdf", buffer: Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(4096)]) });

await mkdir(PASTA, { recursive: true });
const navegador = await chromium.launch({ channel: process.env.PW_NAVEGADOR ?? "chrome" });
let passo = 0;

async function pessoa(email) {
  const contexto = await navegador.newContext({ baseURL: BASE, viewport: { width: 1280, height: 900 }, locale: "pt-BR" });
  const page = await contexto.newPage();
  page.setDefaultTimeout(60_000);
  if (process.env.DEPURAR) {
    page.on("requestfailed", (r) => console.log(`   ! falhou ${r.method()} ${r.url()} ${r.failure()?.errorText}`));
    page.on("response", async (r) => { if (r.status() >= 400) console.log(`   ! ${r.status()} ${r.request().method()} ${r.url()} ${(await r.text().catch(() => "")).slice(0, 200)}`); });
    page.on("console", (m) => { if (m.type() === "error") console.log(`   ! console: ${m.text().slice(0, 200)}`); });
  }
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(SENHA);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  return page;
}

async function registrar(page, quem, oQue) {
  passo += 1;
  const arquivo = path.join(PASTA, `${String(passo).padStart(2, "0")}.png`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.screenshot({ path: arquivo, fullPage: true });
  const proximo = await page.getByText(/^Próximo passo:/).first().locator("..").innerText().catch(() => "");
  console.log(`${String(passo).padStart(2, "0")} | ${quem} | ${oQue}${proximo ? ` | tela: ${proximo.replace(/\s+/g, " ")}` : ""}`);
}

const linha = (page, nome) =>
  page.locator("section", { has: page.getByRole("heading", { name: "Documentos da etapa" }) }).locator("div.divide-y > div").filter({ hasText: nome });
async function enviar(page, nome, arquivo) {
  await linha(page, nome).locator("input[type=file]").setInputFiles(pdf(arquivo));
  await linha(page, nome).getByText(/Em análise|Entregue/).waitFor();
}
async function avancar(page, para) {
  await page.getByRole("button", { name: `Avançar para ${para}` }).click();
  // O botão vira "Avançando…" enquanto o servidor conclui a etapa; só depois a tela muda.
  await page.getByRole("button", { name: /Avançando/ }).waitFor({ state: "attached" }).catch(() => {});
  await page.getByRole("button", { name: /Avançando/ }).waitFor({ state: "detached" });
  await page.waitForLoadState("networkidle").catch(() => {});
}

const ana = await pessoa("gestor@ctp.org.br");
const carlos = await pessoa("carlos.pellizzaro@clevelandia.pr.gov.br");
const beatriz = await pessoa("beatriz.lorenzetti@clevelandia.pr.gov.br");

// 1. Pedido de orçamento — o CTP abre o contrato.
await ana.goto("/contratos/novo");
await ana.getByLabel("Município contratante").selectOption({ label: "Prefeitura de Clevelândia" });
await ana.getByLabel("Objeto do contrato").fill(OBJETO);
await ana.getByRole("button", { name: "Criar contrato" }).click();
await ana.waitForURL(/\/contratos\/c/);
const CONTRATO = new URL(ana.url()).pathname;
await registrar(ana, "Ana (CTP)", "cria o contrato (tipo exclusivo de Clevelândia)");
await avancar(ana, "Orçamento");
await registrar(ana, "Ana (CTP)", "registra o pedido e avança para a emissão do orçamento");

// 2. Emissão do orçamento — o CTP anexa a proposta.
await enviar(ana, "Proposta de orçamento", "proposta-orcamento-v1.pdf");
await avancar(ana, "Aprovação");
await registrar(ana, "Ana (CTP)", "anexa a proposta de orçamento e envia para aprovação");

// 3. Aprovação — o prefeito pede revisão uma vez e depois aprova.
await carlos.goto(CONTRATO);
await registrar(carlos, "Carlos (prefeito)", "abre o contrato e vê o orçamento para decidir");
await carlos.getByText("Pedir revisão ao CTP…").click();
await carlos.getByLabel("O que precisa ser revisto").fill("Parcelar o pagamento em 4 entregas e incluir uma audiência pública a mais.");
await carlos.getByRole("button", { name: "Pedir revisão", exact: true }).click();
await carlos.getByText("A prefeitura pediu revisão:").waitFor();
await registrar(carlos, "Carlos (prefeito)", "pede revisão do orçamento (contrato volta ao CTP)");

await ana.goto(CONTRATO);
await registrar(ana, "Ana (CTP)", "vê o motivo da revisão e o orçamento pedido de novo");
await enviar(ana, "Proposta de orçamento", "proposta-orcamento-v2.pdf");
await avancar(ana, "Aprovação");
await registrar(ana, "Ana (CTP)", "envia o orçamento revisado");

await carlos.goto(CONTRATO);
await carlos.getByRole("button", { name: /Aprovar e seguir/ }).click();
await carlos.getByText(/Próximo passo: Envie 3 documentos/).waitFor();
await registrar(carlos, "Carlos (prefeito)", "aprova o orçamento");

// 4. Documentos para contratação — a servidora envia os da prefeitura; o CTP, os dele.
await beatriz.goto(CONTRATO);
await enviar(beatriz, "Termo de referência assinado", "termo-de-referencia.pdf");
await enviar(beatriz, "Declaração de dotação orçamentária", "dotacao.pdf");
await enviar(beatriz, "Portaria de designação do fiscal do contrato", "portaria-fiscal.pdf");
await registrar(beatriz, "Beatriz (servidora)", "envia os 3 documentos da prefeitura");

await ana.goto(CONTRATO);
await enviar(ana, "Certidões de regularidade fiscal e trabalhista", "certidoes.pdf");
await enviar(ana, "Contrato social e cartão CNPJ", "contrato-social.pdf");
await linha(ana, "Termo de referência assinado").getByRole("button", { name: "Aprovar" }).click();
await linha(ana, "Termo de referência assinado").getByText("Aprovado").waitFor();
await linha(ana, "Portaria de designação do fiscal do contrato").getByRole("button", { name: "Aprovar" }).click();
await linha(ana, "Portaria de designação do fiscal do contrato").getByText("Aprovado").waitFor();
await linha(ana, "Declaração de dotação orçamentária").getByText("Recusar e pedir de novo…").click();
await linha(ana, "Declaração de dotação orçamentária").getByLabel(/Motivo da recusa/).fill("A declaração precisa indicar a rubrica do exercício de 2027.");
await linha(ana, "Declaração de dotação orçamentária").getByRole("button", { name: "Recusar", exact: true }).click();
await linha(ana, "Declaração de dotação orçamentária").getByText("Pedido de novo envio").waitFor();
await registrar(ana, "Ana (CTP)", "envia os documentos do CTP, aprova 2 e recusa a dotação com motivo");

await beatriz.goto(CONTRATO);
await enviar(beatriz, "Declaração de dotação orçamentária", "dotacao-2027.pdf");
await registrar(beatriz, "Beatriz (servidora)", "reenvia a dotação corrigida");

await ana.goto(CONTRATO);
await linha(ana, "Declaração de dotação orçamentária").getByRole("button", { name: "Aprovar" }).click();
await linha(ana, "Declaração de dotação orçamentária").getByText("Aprovado").waitFor();
await avancar(ana, "Minuta");
await registrar(ana, "Ana (CTP)", "aprova a dotação e avança para a minuta do contrato");

// 5. Minuta e assinaturas — CTP e prefeito assinam.
const abrir = ana.locator("section", { has: ana.getByRole("heading", { name: "Abrir fluxo de assinatura" }) });
await abrir.getByText("Ana Coordenadora", { exact: true }).click();
await abrir.getByPlaceholder("Nome do representante do município").fill("Carlos Pellizzaro — Prefeito");
await abrir.getByRole("button", { name: "Abrir fluxo de assinatura" }).click();
await ana.getByRole("button", { name: "Assinar digitalmente" }).click();
await ana.getByText(/1 de 2 assinaturas/).waitFor();
await registrar(ana, "Ana (CTP)", "abre a coleta de assinaturas e assina pelo CTP");

await carlos.goto(CONTRATO);
await carlos.getByRole("button", { name: "Assinar digitalmente" }).click();
await carlos.getByText("Todas as partes assinaram.", { exact: true }).waitFor();
await registrar(carlos, "Carlos (prefeito)", "assina pela prefeitura");

await ana.goto(CONTRATO);
await avancar(ana, "Assinado");
await registrar(ana, "Ana (CTP)", "conclui: contrato assinado");

// 6. Projeto técnico nasce do contrato.
const criar = ana.locator("section", { has: ana.getByRole("heading", { name: "Criar projeto técnico" }) });
const tipos = await criar.getByLabel("Tipo de projeto").locator("option").allTextContents();
await criar.getByLabel("Tipo de projeto").selectOption({ label: tipos.find((t) => t === "Plano de Mobilidade") ?? "Personalizado" });
await criar.getByLabel("Vigência até").fill("2027-08-31");
await criar.getByRole("button", { name: "Criar projeto" }).click();
await ana.waitForURL(/\/projetos\//);
const PROJETO = ana.url();
await registrar(ana, "Ana (CTP)", "cria o projeto técnico a partir do contrato");

await carlos.goto("/projetos");
await registrar(carlos, "Carlos (prefeito)", "vê o projeto novo em Meus projetos");
await carlos.goto("/notificacoes");
await registrar(carlos, "Carlos (prefeito)", "avisos que recebeu ao longo do caminho");
await ana.goto("/notificacoes");
await registrar(ana, "Ana (CTP)", "avisos que recebeu ao longo do caminho");

console.log(`CONTRATO ${BASE}${CONTRATO}`);
console.log(`PROJETO ${PROJETO}`);
await navegador.close();
