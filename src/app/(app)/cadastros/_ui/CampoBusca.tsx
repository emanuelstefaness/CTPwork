"use client";

import { useRef, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";

/** Busca das listas de Cadastros: filtra enquanto digita (o termo fica na URL, em `q`). */
export function CampoBusca({ valor, placeholder, rotulo }: { valor?: string; placeholder: string; rotulo: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pendente, iniciar] = useTransition();
  const espera = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function buscar(texto: string) {
    clearTimeout(espera.current);
    espera.current = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      if (texto.trim()) params.set("q", texto.trim());
      else params.delete("q");
      params.delete("editar");
      const query = params.toString();
      iniciar(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
    }, 250);
  }

  return (
    <label className="relative block w-full sm:max-w-xs">
      <span className="sr-only">{rotulo}</span>
      <MagnifyingGlassIcon className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${pendente ? "animate-pulse text-cyan-600" : "text-slate-400"}`} />
      <input
        type="search"
        defaultValue={valor}
        placeholder={placeholder}
        onChange={(e) => buscar(e.target.value)}
        className="form-control py-2 !pl-9 text-sm"
      />
    </label>
  );
}
