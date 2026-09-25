import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeftIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        {eyebrow && <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-700">{eyebrow}</p>}
        <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`surface-panel ${className}`}>
      {(title || action) && (
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            {title && <h2 className="text-sm font-semibold text-slate-950">{title}</h2>}
            {description && <p className="mt-0.5 text-xs leading-5 text-slate-500">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

const toneClasses: Record<string, string> = {
  slate: "bg-slate-100 text-slate-600 ring-slate-200",
  blue: "bg-blue-50 text-blue-700 ring-blue-200",
  cyan: "bg-cyan-50 text-cyan-700 ring-cyan-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
};

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: keyof typeof toneClasses }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${toneClasses[tone]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-75" />
      {children}
    </span>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate-400">{description}</p>
    </div>
  );
}

const avatarTones = [
  "bg-cyan-100 text-cyan-800",
  "bg-emerald-100 text-emerald-800",
  "bg-violet-100 text-violet-800",
  "bg-amber-100 text-amber-800",
  "bg-sky-100 text-sky-800",
  "bg-rose-100 text-rose-800",
];

/** Iniciais com cor estável por nome — mesma pessoa, mesma cor em qualquer tela. */
export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const hash = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const initials = name.split(" ").filter(Boolean).map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  const dims = size === "sm" ? "h-6 w-6 text-[9px]" : "h-8 w-8 text-[11px]";
  return (
    <span className={`grid shrink-0 place-items-center rounded-full font-bold ${dims} ${avatarTones[hash % avatarTones.length]}`} aria-hidden>
      {initials}
    </span>
  );
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-cyan-700">
      <ArrowLeftIcon className="h-3.5 w-3.5" />
      {label}
    </Link>
  );
}

/** Painel lateral "Detalhes": rótulo à esquerda, valor à direita, estilo ficha de registro. */
export function DetailList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="divide-y divide-slate-100 px-5">
      {items.map((item) => (
        <div key={item.label} className="flex items-start justify-between gap-4 py-3 text-sm">
          <dt className="shrink-0 text-slate-500">{item.label}</dt>
          <dd className="min-w-0 text-right font-medium text-slate-800">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Abas de filtro por link (funcionam sem JS e mantêm o filtro na URL). */
export function FilterPills({ options }: { options: { label: string; href: string; active: boolean; count?: number }[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <Link
          key={o.href}
          href={o.href}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
            o.active ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"
          }`}
        >
          {o.label}
          {o.count !== undefined && (
            <span className={`rounded-full px-1.5 text-[10px] ${o.active ? "bg-white/20" : "bg-slate-100 text-slate-500"}`}>{o.count}</span>
          )}
        </Link>
      ))}
    </div>
  );
}

/** Busca por GET: preserva os demais filtros da URL em campos ocultos. */
export function SearchBox({
  defaultValue,
  placeholder,
  hidden = {},
}: {
  defaultValue?: string;
  placeholder: string;
  hidden?: Record<string, string | undefined>;
}) {
  return (
    <form className="relative w-full sm:max-w-xs">
      {Object.entries(hidden).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input name="q" defaultValue={defaultValue} placeholder={placeholder} className="form-control !pl-9" />
    </form>
  );
}

export function ProgressBar({ value, tone = "cyan" }: { value: number; tone?: "cyan" | "emerald" | "amber" }) {
  const color = tone === "emerald" ? "bg-emerald-500" : tone === "amber" ? "bg-amber-500" : "bg-cyan-500";
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

