"use client";

import { useEffect, useId, useRef, useState } from "react";

// Sem caracteres que se confundem ao ditar ou copiar (0/O, 1/l/I).
const LETRAS = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITOS = "23456789";

/** Senha aleatória de 10 caracteres, sempre com letras e números. */
export function gerarSenha() {
  const todos = LETRAS + DIGITOS;
  const sorteio = crypto.getRandomValues(new Uint32Array(10));
  const chars = Array.from(sorteio, (n) => todos[n % todos.length]);
  chars[sorteio[0] % 10] = DIGITOS[sorteio[1] % DIGITOS.length];
  if (!chars.some((c) => LETRAS.includes(c))) chars[(sorteio[0] + 1) % 10] = LETRAS[sorteio[2] % LETRAS.length];
  return chars.join("");
}

/**
 * Senha definida pelo gestor no cadastro: fica visível (é ele quem repassa para a pessoa) e tem
 * um botão para gerar uma senha forte.
 */
export function CampoSenha({ name, label, obrigatoria = true, placeholder, rotuloAcessivel }: {
  name: string;
  label: React.ReactNode;
  obrigatoria?: boolean;
  placeholder?: string;
  rotuloAcessivel?: string;
}) {
  const [valor, setValor] = useState("");
  const id = useId();
  const campo = useRef<HTMLInputElement>(null);
  // Campo controlado não é limpo pelo form.reset() do envio com sucesso — limpa junto.
  useEffect(() => {
    const form = campo.current?.form;
    const limpar = () => setValor("");
    form?.addEventListener("reset", limpar);
    return () => form?.removeEventListener("reset", limpar);
  }, []);
  return (
    <div className="text-xs font-semibold text-slate-600">
      <label htmlFor={id}>{label}</label>
      <span className="mt-1 flex gap-1.5">
        <input
          ref={campo}
          id={id}
          name={name}
          type="text"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          required={obrigatoria}
          minLength={8}
          autoComplete="new-password"
          spellCheck={false}
          placeholder={placeholder ?? "Mínimo 8 caracteres"}
          aria-label={rotuloAcessivel}
          className="form-control min-w-0 flex-1 py-2 font-mono text-sm"
        />
        <button type="button" onClick={() => setValor(gerarSenha())} aria-label={`Gerar ${rotuloAcessivel?.toLowerCase() ?? "senha"}`} className="secondary-button shrink-0 px-2.5 text-xs">
          Gerar
        </button>
      </span>
    </div>
  );
}
