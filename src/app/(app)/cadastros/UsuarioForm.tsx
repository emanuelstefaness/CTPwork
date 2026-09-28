"use client";

import type { Resultado } from "@/lib/resultado";
import { useState } from "react";
import { useEnvio } from "@/components/use-envio";

type Setor = { id: string; nome: string };
type Municipio = { id: string; nome: string };
type Perfil = { id: string; nome: string; tipo: string };
type UsuarioEdit = {
  id: string;
  nome: string;
  email: string;
  tipo: string;
  perfilId: string | null;
  setorId: string | null;
  municipioId: string | null;
};

function BotaoSalvar({ label, pending }: { label: string; pending: boolean }) {
  return (
    <button type="submit" disabled={pending} className="primary-button">
      {pending ? "Salvando..." : label}
    </button>
  );
}

export default function UsuarioForm({
  modo,
  setores,
  municipios,
  perfis,
  usuario,
  action,
}: {
  modo: "criar" | "editar";
  setores: Setor[];
  municipios: Municipio[];
  perfis: Perfil[];
  usuario?: UsuarioEdit;
  action: (formData: FormData) => Promise<Resultado<unknown>>;
}) {
  const [tipo, setTipo] = useState<"INTERNO" | "EXTERNO">((usuario?.tipo as "INTERNO" | "EXTERNO") ?? "INTERNO");
  const { onSubmit, pendente, erro } = useEnvio(action);

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      {usuario && <input type="hidden" name="usuarioId" value={usuario.id} />}

      <label className="text-xs font-semibold text-slate-600">
        Nome
        <input name="nome" required defaultValue={usuario?.nome} className="form-control mt-1 py-2 text-sm" />
      </label>

      {modo === "criar" ? (
        <>
          <label className="text-xs font-semibold text-slate-600">
            E-mail
            <input name="email" type="email" required className="form-control mt-1 py-2 text-sm" />
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Senha inicial
            <input name="senha" type="password" required minLength={6} className="form-control mt-1 py-2 text-sm" />
          </label>
          <div>
            <p className="mb-1.5 text-xs font-semibold text-slate-600">Tipo</p>
            <div className="flex gap-2">
              <label className={`flex-1 cursor-pointer rounded-lg border px-3 py-2 text-center text-xs font-semibold ${tipo === "INTERNO" ? "border-cyan-400 bg-cyan-50 text-cyan-700" : "border-slate-200 text-slate-500"}`}>
                <input type="radio" name="tipo" value="INTERNO" checked={tipo === "INTERNO"} onChange={() => setTipo("INTERNO")} className="sr-only" />
                Colaborador CTP
              </label>
              <label className={`flex-1 cursor-pointer rounded-lg border px-3 py-2 text-center text-xs font-semibold ${tipo === "EXTERNO" ? "border-cyan-400 bg-cyan-50 text-cyan-700" : "border-slate-200 text-slate-500"}`}>
                <input type="radio" name="tipo" value="EXTERNO" checked={tipo === "EXTERNO"} onChange={() => setTipo("EXTERNO")} className="sr-only" />
                Usuário do município
              </label>
            </div>
          </div>
        </>
      ) : (
        <p className="text-xs text-slate-400">{usuario?.email} · {tipo === "INTERNO" ? "Colaborador CTP" : "Usuário do município"} (tipo não pode ser alterado)</p>
      )}

      {tipo === "INTERNO" ? (
        <>
          <label className="text-xs font-semibold text-slate-600">
            Setor
            <select name="setorId" required defaultValue={usuario?.setorId ?? ""} className="form-control mt-1 py-2 text-sm">
              <option value="" disabled>Selecione o setor</option>
              {setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </label>
        </>
      ) : (
        <label className="text-xs font-semibold text-slate-600">
          Município
          <select name="municipioId" required defaultValue={usuario?.municipioId ?? ""} className="form-control mt-1 py-2 text-sm">
            <option value="" disabled>Selecione o município</option>
            {municipios.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
        </label>
      )}

      {/* Perfil (cargo): define o que a pessoa vê e faz — ver Cadastros › Perfis. */}
      <label className="text-xs font-semibold text-slate-600">
        Perfil
        <select
          key={tipo}
          name="perfilId"
          required
          defaultValue={usuario?.perfilId ?? perfis.find((p) => p.tipo === tipo)?.id ?? ""}
          className="form-control mt-1 py-2 text-sm"
        >
          {perfis.filter((p) => p.tipo === tipo).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
      </label>

      {modo === "editar" && (
        <label className="text-xs font-semibold text-slate-600">
          Nova senha (opcional)
          <input name="novaSenha" type="password" minLength={6} placeholder="Deixe em branco para manter a atual" className="form-control mt-1 py-2 text-sm" />
        </label>
      )}

      {erro && <p className="text-xs text-red-600">{erro}</p>}

      <BotaoSalvar pending={pendente} label={modo === "criar" ? "Criar usuário" : "Salvar alterações"} />
    </form>
  );
}
