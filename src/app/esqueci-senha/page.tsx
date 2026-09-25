import type { Metadata } from "next";
import { solicitarRedefinicao } from "@/lib/actions/conta";
import { FormMensagem } from "@/components/form-mensagem";
import { TelaPublica } from "@/components/tela-publica";

export const metadata: Metadata = { title: "Esqueci minha senha" };

export default function EsqueciSenhaPage() {
  return (
    <TelaPublica titulo="Esqueci minha senha" descricao="Informe o e-mail da sua conta. Enviaremos um link para você criar uma nova senha.">
      <FormMensagem acao={solicitarRedefinicao} className="flex flex-col gap-5" depois={<p className="mt-4 text-xs leading-5 text-slate-500">Não chegou em alguns minutos? Confira o spam ou fale com o responsável pelo seu projeto no CTP.</p>}>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-slate-700">E-mail</span>
          <input type="email" name="email" required autoComplete="email" className="form-control h-11" placeholder="voce@prefeitura.gov.br" />
        </label>
        <button className="primary-button h-11 w-full">Enviar link</button>
      </FormMensagem>
    </TelaPublica>
  );
}
