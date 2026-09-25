"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction } from "./actions";

export default function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [state, action, pending] = useActionState(loginAction, undefined);

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-semibold text-slate-700">E-mail</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="username"
          defaultValue={state?.email}
          key={state?.email ?? "vazio"}
          className="form-control h-11"
          placeholder="voce@ctp.org.br"
        />
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between">
          <label htmlFor="password" className="text-sm font-semibold text-slate-700">Senha</label>
          <Link href="/esqueci-senha" className="text-xs font-semibold text-cyan-700 hover:text-cyan-900">Esqueci minha senha</Link>
        </div>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="form-control h-11"
          placeholder="••••••••"
        />
      </div>
      {state?.erro && <p className="text-sm text-red-600" role="alert">{state.erro}</p>}
      <button
        type="submit"
        disabled={pending}
        className="primary-button mt-1 h-11 w-full disabled:opacity-60"
      >
        {pending ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
