"use client";

import { useState, useTransition, type FormEvent } from "react";
import type { Resultado } from "@/lib/resultado";
import { limiteAnexoBytes, limiteAnexoTexto } from "@/lib/limite-anexo";

const ehNavegacaoDoNext =(e: unknown) => {
  const digest = (e as { digest?: unknown } | null)?.digest;
  return typeof digest === "string" && digest.startsWith("NEXT_");
};

/**
 * Envio de formulário para uma server action que devolve `Resultado`.
 *
 * Usa `onSubmit` em vez de `<form action>` de propósito: com `action`, o React 19 limpa todos os
 * campos não controlados quando a action termina — inclusive quando ela devolve um erro de
 * validação, apagando o que a pessoa acabou de digitar. Aqui o formulário só é limpo no sucesso
 * (ou faz o que `aoSucesso` mandar).
 */
export function useEnvio(
  acao: (dados: FormData) => Promise<Resultado<unknown>>,
  aoSucesso: (form: HTMLFormElement) => void = (form) => form.reset(),
) {
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const dados = new FormData(form);
    setErro(null);
    const grande = [...dados.values()].find((v): v is File => v instanceof File && v.size > limiteAnexoBytes());
    if (grande) {
      setErro(`"${grande.name}" tem ${(grande.size / 1024 / 1024).toFixed(1)} MB — o limite é ${limiteAnexoTexto()} por arquivo.`);
      return;
    }
    iniciar(async () => {
      let r: Resultado<unknown>;
      try {
        r = await acao(dados);
      } catch (err) {
        if (ehNavegacaoDoNext(err)) throw err; // redirect() da action
        setErro("Não foi possível enviar. Verifique sua conexão e tente de novo.");
        return;
      }
      if (!r.ok) return setErro(r.erro);
      aoSucesso(form);
    });
  }

  return { onSubmit, pendente, erro };
}
