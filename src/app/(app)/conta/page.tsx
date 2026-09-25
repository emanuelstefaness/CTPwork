import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/tenant";
import { alterarPreferencias, alterarSenha } from "@/lib/actions/conta";
import { emailConfigurado } from "@/lib/email/transporte";
import { Avatar, DetailList, PageHeader, Panel } from "@/components/ui";
import { FormMensagem } from "@/components/form-mensagem";

export const metadata: Metadata = { title: "Minha conta" };

export default async function ContaPage() {
  const sessao = await requireSession();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: sessao.id }, include: { setor: true, municipio: true } });
  const perfil = user.tipo === "INTERNO" ? (user.perfilInterno === "GESTOR" ? "Gestor CTP" : "Colaborador CTP") : "Município contratante";

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Minha conta" description="Seus dados, sua senha e como você quer ser avisado." />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
        <Panel>
          <div className="flex flex-col items-center gap-2 border-b border-slate-100 px-5 py-6 text-center">
            <span className="scale-150"><Avatar name={user.nome} /></span>
            <p className="mt-3 text-base font-semibold text-slate-900">{user.nome}</p>
            <p className="text-xs text-slate-500">{perfil}</p>
          </div>
          <DetailList
            items={[
              { label: "E-mail", value: <span className="break-all">{user.email}</span> },
              user.tipo === "INTERNO" ? { label: "Setor", value: user.setor?.nome ?? "—" } : { label: "Município", value: user.municipio?.nome ?? "—" },
            ]}
          />
          <p className="px-5 pb-5 text-xs leading-5 text-slate-400">Para mudar nome, e-mail ou setor, fale com um gestor do CTP.</p>
        </Panel>

        <div className="flex flex-col gap-5">
          <Panel title="Avisos por e-mail" description="Além do sino dentro do sistema.">
            <FormMensagem acao={alterarPreferencias} limpar={false} className="flex flex-col gap-4 px-5 py-5">
              <label className="flex cursor-pointer items-start gap-3">
                <input type="checkbox" name="receberEmail" defaultChecked={user.receberEmail} className="mt-1 h-4 w-4 accent-cyan-700" />
                <span>
                  <span className="block text-sm font-medium text-slate-800">Receber avisos por e-mail</span>
                  <span className="block text-xs leading-5 text-slate-500">
                    Documento enviado para revisão, comentários, mensagens, prazos vencidos. Avisos próximos chegam juntos num e-mail só.
                  </span>
                </span>
              </label>
              {!emailConfigurado() && user.tipo === "INTERNO" && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                  O servidor de e-mail ainda não foi configurado (variável SMTP_HOST). Até lá, os e-mails ficam gravados em storage/emails e não são enviados.
                </p>
              )}
              <button className="primary-button self-start">Salvar preferência</button>
            </FormMensagem>
          </Panel>

          <Panel title="Alterar senha">
            <FormMensagem acao={alterarSenha} className="flex flex-col gap-4 px-5 py-5">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">Senha atual</span>
                <input type="password" name="senhaAtual" required autoComplete="current-password" className="form-control" />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">Nova senha</span>
                  <input type="password" name="novaSenha" required minLength={8} autoComplete="new-password" className="form-control" />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">Repita a nova senha</span>
                  <input type="password" name="confirmacao" required minLength={8} autoComplete="new-password" className="form-control" />
                </label>
              </div>
              <p className="text-xs text-slate-400">Pelo menos 8 caracteres, com letras e números.</p>
              <button className="primary-button self-start">Alterar senha</button>
            </FormMensagem>
          </Panel>
        </div>
      </div>
    </div>
  );
}
