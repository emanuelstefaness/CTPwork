import type { ReactNode } from "react";
import { exigirPermissao } from "@/lib/tenant";
import { MenuCadastros } from "./_ui/MenuCadastros";

/** Cadastros: menu agrupado à esquerda (Pessoas, Clientes, Como o trabalho anda) e a seção à direita. */
export default async function CadastrosLayout({ children }: { children: ReactNode }) {
  await exigirPermissao("cadastros");
  return (
    <div className="mx-auto grid max-w-[1320px] gap-6 lg:grid-cols-[230px_minmax(0,1fr)]">
      <aside className="min-w-0">
        <p className="mb-4 hidden px-3 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-700 lg:block">Cadastros</p>
        <MenuCadastros />
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
