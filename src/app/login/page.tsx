import type { Metadata } from "next";
import LoginForm from "./LoginForm";
import { prisma } from "@/lib/prisma";
import { CheckCircleIcon, DocumentCheckIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; sessao?: string }>;
}) {
  const { callbackUrl, sessao } = await searchParams;
  // Em produção as contas de demonstração (com a senha) só aparecem se pedido explicitamente; e só
  // quando elas existem no banco (no banco limpo, sem dados de exemplo, o atalho some).
  const permitido = process.env.MOSTRAR_CONTAS_DEMO === "true" || process.env.DADOS_DEMONSTRACAO === "true" || (process.env.NODE_ENV !== "production" && process.env.MOSTRAR_CONTAS_DEMO !== "false");
  const mostrarContasDemo = permitido && (await prisma.user.count({ where: { email: "gestor@ctp.org.br", ativo: true } })) > 0;

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[1.05fr_0.95fr]">
      <section className="hidden flex-col justify-between bg-[#082843] p-12 text-white lg:flex xl:p-16">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-400 text-[#082843]"><DocumentCheckIcon className="h-7 w-7" /></span>
          <div><p className="text-2xl font-bold tracking-tight">CTP Work</p><p className="text-xs text-cyan-200">Cilla Tech Park</p></div>
        </div>
        <div className="max-w-xl">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Gestão pública colaborativa</p>
          <h1 className="text-4xl font-bold leading-tight tracking-tight xl:text-5xl">Projetos técnicos claros, rastreáveis e seguros.</h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-slate-300">Conecte o CTP e os municípios em um fluxo único de contratos, documentos, revisões, assinaturas e prazos.</p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><ShieldCheckIcon className="h-6 w-6 text-cyan-300" /><p className="mt-3 text-sm font-semibold">Acesso protegido</p><p className="mt-1 text-xs leading-5 text-slate-400">Cada município visualiza apenas seus próprios projetos.</p></div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><CheckCircleIcon className="h-6 w-6 text-cyan-300" /><p className="mt-3 text-sm font-semibold">Histórico completo</p><p className="mt-1 text-xs leading-5 text-slate-400">Decisões, documentos e assinaturas sempre rastreáveis.</p></div>
          </div>
        </div>
        <p className="text-xs text-slate-500">© 2026 Cilla Tech Park. Ambiente institucional.</p>
      </section>

      <section className="flex items-center justify-center bg-slate-50 px-5 py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[#082843] text-cyan-300"><DocumentCheckIcon className="h-6 w-6" /></span><p className="text-xl font-bold text-slate-950">CTP Work</p></div>
          <div className="surface-panel p-7 sm:p-9">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-700">Bem-vindo</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Acesse sua conta</h2>
            <p className="mb-7 mt-2 text-sm leading-6 text-slate-500">Entre para acompanhar contratos, projetos e solicitações.</p>
            {sessao === "encerrada" && (
              <p role="status" className="-mt-3 mb-6 rounded-xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                Sua sessão foi encerrada. Entre novamente — se não conseguir, seu acesso pode ter sido desativado; fale com a equipe do CTP.
              </p>
            )}
            <LoginForm callbackUrl={callbackUrl ?? "/"} />
          </div>
          {mostrarContasDemo && (
            <details className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
              <summary className="cursor-pointer font-semibold text-slate-700">Contas de demonstração</summary>
              <div className="mt-2 space-y-1"><p>Senha: <strong>ctpwork123</strong></p><p>Gestor: gestor@ctp.org.br</p><p>Colaborador: colaborador@ctp.org.br</p><p>Município: marina.kowalski@guarapuava.pr.gov.br</p></div>
            </details>
          )}
        </div>
      </section>
    </div>
  );
}
