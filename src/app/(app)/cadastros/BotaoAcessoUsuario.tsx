"use client";

import { useState, useTransition } from "react";
import { alterarAcessoUsuarioSeguro } from "@/lib/actions/formularios";

/** Desativar / reativar o acesso de um usuário (com confirmação ao desativar). */
export function BotaoAcessoUsuario({ usuarioId, nome, ativo }: { usuarioId: string; nome: string; ativo: boolean }) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const alternar = () => {
    if (ativo && !confirm(`Desativar o acesso de ${nome}?\n\nA pessoa não consegue mais entrar e é desconectada na hora. O histórico (comentários, assinaturas, mensagens) continua no sistema, e você pode reativar depois.`)) return;
    iniciar(async () => {
      const dados = new FormData();
      dados.set("usuarioId", usuarioId);
      dados.set("ativo", String(!ativo));
      const r = await alterarAcessoUsuarioSeguro(dados);
      setErro(r.ok ? null : r.erro);
    });
  };

  return (
    <span className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={alternar}
        disabled={pendente}
        className={`min-h-8 rounded-lg px-3 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50 ${
          ativo ? "text-red-600 hover:bg-red-50" : "border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
        }`}
      >
        {pendente ? "Salvando…" : ativo ? "Desativar acesso" : "Reativar acesso"}
      </button>
      {erro && <span role="alert" className="max-w-[240px] text-right text-[11px] text-red-600">{erro}</span>}
    </span>
  );
}
