"use client";

import type { ReactNode } from "react";
import { ExclamationCircleIcon } from "@heroicons/react/24/outline";
import { useEnvio } from "@/components/use-envio";
import type { Resultado } from "@/lib/resultado";

/**
 * `<form>` para páginas de servidor que precisam mostrar o erro de validação da action na tela
 * (ex.: "arquivo excede 20 MB") em vez de derrubar a página. A action devolve `Resultado`.
 * Enquanto envia, o formulário ganha `data-pendente` — o CSS global esmaece e trava o botão.
 */
export function FormSeguro({
  acao,
  children,
  className,
  limparAoEnviar = true,
  erroClassName = "mt-2 flex items-center gap-1.5 text-xs text-red-600",
}: {
  acao: (dados: FormData) => Promise<Resultado<unknown>>;
  children: ReactNode;
  className?: string;
  limparAoEnviar?: boolean;
  erroClassName?: string;
}) {
  const { onSubmit, pendente, erro } = useEnvio(acao, limparAoEnviar ? undefined : () => {});
  return (
    <form method="post" onSubmit={onSubmit} className={className} data-pendente={pendente || undefined} aria-busy={pendente}>
      {children}
      {erro && (
        <p className={erroClassName} role="alert">
          <ExclamationCircleIcon className="h-4 w-4 shrink-0" />
          {erro}
        </p>
      )}
    </form>
  );
}
