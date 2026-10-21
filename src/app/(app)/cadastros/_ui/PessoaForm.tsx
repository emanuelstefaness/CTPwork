"use client";

import type { Resultado } from "@/lib/resultado";
import { useRouter } from "next/navigation";
import { useEnvio } from "@/components/use-envio";
import { CampoSenha } from "@/components/campo-senha";

type Opcao = { id: string; nome: string };
type PessoaEdit = { id: string; nome: string; email: string; perfilId: string | null; setorId: string | null };

/**
 * Pessoa da equipe do CTP (com setor) ou acesso de uma prefeitura (município fixo). O tipo vem da
 * tela em que o formulário está — não se escolhe aqui.
 */
export function PessoaForm({
  tipo,
  perfis,
  setores = [],
  municipioId,
  pessoa,
  acao,
  rotuloEnviar,
  voltarPara,
}: {
  tipo: "INTERNO" | "EXTERNO";
  perfis: Opcao[];
  setores?: Opcao[];
  municipioId?: string;
  pessoa?: PessoaEdit;
  acao: (formData: FormData) => Promise<Resultado<unknown>>;
  rotuloEnviar: string;
  /** Para onde voltar depois de salvar (fecha o formulário). */
  voltarPara: string;
}) {
  const router = useRouter();
  const { onSubmit, pendente, erro } = useEnvio(acao, () => router.replace(voltarPara, { scroll: false }));
  const editar = !!pessoa;

  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
      {pessoa && <input type="hidden" name="usuarioId" value={pessoa.id} />}
      {!editar && <input type="hidden" name="tipo" value={tipo} />}
      {tipo === "EXTERNO" && <input type="hidden" name="municipioId" value={municipioId} />}

      <label className="text-xs font-semibold text-slate-600">
        Nome
        <input name="nome" required maxLength={120} defaultValue={pessoa?.nome} className="form-control mt-1 py-2 text-sm" />
      </label>
      {editar ? (
        <div className="text-xs font-semibold text-slate-600">
          E-mail (login)
          <p className="mt-1 rounded-lg bg-slate-50 px-3 py-2 text-sm font-normal text-slate-500">{pessoa.email}</p>
        </div>
      ) : (
        <label className="text-xs font-semibold text-slate-600">
          E-mail (login)
          <input name="email" type="email" required maxLength={254} className="form-control mt-1 py-2 text-sm" />
        </label>
      )}

      {tipo === "INTERNO" && (
        <label className="text-xs font-semibold text-slate-600">
          Setor
          <select name="setorId" required defaultValue={pessoa?.setorId ?? ""} className="form-control mt-1 py-2 text-sm">
            <option value="" disabled>Selecione o setor</option>
            {setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        </label>
      )}
      <label className="text-xs font-semibold text-slate-600">
        Perfil de acesso
        <select name="perfilId" required defaultValue={pessoa?.perfilId ?? perfis[0]?.id ?? ""} className="form-control mt-1 py-2 text-sm">
          {perfis.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
      </label>

      <div className={tipo === "INTERNO" ? "sm:col-span-2" : ""}>
        {editar ? (
          <CampoSenha name="novaSenha" label="Nova senha (opcional)" obrigatoria={false} placeholder="Em branco: mantém a atual" />
        ) : (
          <CampoSenha name="senha" label="Senha inicial" />
        )}
        <p className="mt-1 text-[11px] text-slate-400">Repasse para a pessoa: no primeiro acesso ela cria a própria senha.</p>
      </div>

      {erro && <p className="text-xs text-red-600 sm:col-span-2" role="alert">{erro}</p>}

      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" disabled={pendente} className="primary-button">{pendente ? "Salvando..." : rotuloEnviar}</button>
        <button type="button" onClick={() => router.replace(voltarPara, { scroll: false })} className="secondary-button">Cancelar</button>
      </div>
    </form>
  );
}
