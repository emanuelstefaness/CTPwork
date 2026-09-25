"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { CheckCircleIcon, ExclamationCircleIcon } from "@heroicons/react/24/outline";
import type { Resultado } from "@/lib/resultado";

/**
 * Formulário cuja action devolve uma mensagem de sucesso para mostrar na tela (ex.: "Senha
 * alterada."). Limpa os campos só no sucesso; `depois` permite trocar o conteúdo (ex.: link "Entrar").
 */
export function FormMensagem({
  acao,
  children,
  className,
  limpar = true,
  depois,
}: {
  acao: (dados: FormData) => Promise<Resultado<{ mensagem: string }>>;
  children: ReactNode;
  className?: string;
  limpar?: boolean;
  depois?: ReactNode;
}) {
  const [retorno, setRetorno] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendente, iniciar] = useTransition();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const dados = new FormData(form);
    setRetorno(null);
    iniciar(async () => {
      try {
        const r = await acao(dados);
        if (r.ok) {
          if (limpar) form.reset();
          setRetorno({ ok: true, texto: r.dados.mensagem });
        } else setRetorno({ ok: false, texto: r.erro });
      } catch {
        setRetorno({ ok: false, texto: "Não foi possível enviar. Verifique sua conexão e tente de novo." });
      }
    });
  }

  if (retorno?.ok && depois) {
    return (
      <div className={className}>
        <p className="flex items-start gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800" role="status">
          <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0" />{retorno.texto}
        </p>
        {depois}
      </div>
    );
  }

  return (
    // method="post": se alguém enviar antes do JavaScript carregar, os dados (e-mail, senha) não vão para a URL.
    <form method="post" onSubmit={onSubmit} className={className} data-pendente={pendente || undefined} aria-busy={pendente}>
      {children}
      {retorno && (
        <p className={`flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-sm leading-6 ${retorno.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`} role={retorno.ok ? "status" : "alert"}>
          {retorno.ok ? <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0" /> : <ExclamationCircleIcon className="mt-0.5 h-5 w-5 shrink-0" />}
          {retorno.texto}
        </p>
      )}
    </form>
  );
}
