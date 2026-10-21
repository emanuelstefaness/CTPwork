import Link from "next/link";
import { ChevronRightIcon } from "@heroicons/react/24/outline";

const nomeCurto = (municipio: string) => municipio.replace(/^Prefeitura (Municipal )?de /, "");

/** Coluna com os tipos (de contrato ou de projeto): o escolhido abre ao lado. */
export function ListaDeTipos({
  titulo,
  itens,
  selecionado,
}: {
  titulo: string;
  itens: { id: string; nome: string; href: string; detalhe: string; exclusivoDe?: string | null; inativo?: boolean }[];
  selecionado?: string;
}) {
  return (
    <nav aria-label={titulo} className="surface-panel self-start p-2">
      <p className="px-3 pb-1.5 pt-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">{titulo}</p>
      <ul className="flex flex-col gap-0.5">
        {itens.map((t) => {
          const ativo = t.id === selecionado;
          return (
            <li key={t.id}>
              <Link
                href={t.href}
                aria-current={ativo ? "page" : undefined}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 transition-colors ${ativo ? "bg-cyan-50 ring-1 ring-inset ring-cyan-200" : "hover:bg-slate-50"} ${t.inativo ? "opacity-60" : ""}`}
              >
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm font-semibold ${ativo ? "text-cyan-900" : "text-slate-800"}`}>{t.nome}</span>
                  <span className="flex flex-wrap items-center gap-1 text-[11px] text-slate-400">
                    {t.detalhe}
                    {t.exclusivoDe && <span className="rounded bg-violet-50 px-1 font-semibold text-violet-700">só {nomeCurto(t.exclusivoDe)}</span>}
                    {t.inativo && <span className="rounded bg-slate-100 px-1 font-semibold text-slate-500">desativado</span>}
                  </span>
                </span>
                <ChevronRightIcon className={`h-4 w-4 shrink-0 ${ativo ? "text-cyan-600" : "text-slate-300"}`} />
              </Link>
            </li>
          );
        })}
        {itens.length === 0 && <li className="px-3 py-4 text-xs text-slate-400">Nenhum cadastrado ainda.</li>}
      </ul>
    </nav>
  );
}
