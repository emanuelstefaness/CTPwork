/**
 * Filtro "contém" das buscas, sem diferenciar maiúsculas de minúsculas. O SQLite (desenvolvimento)
 * já compara assim; no PostgreSQL (produção) é preciso pedir com `mode: "insensitive"` — opção que
 * o cliente gerado para SQLite nem conhece, daí o tipo restrito a `contains`.
 */
const ehPostgres = () => /^postgres(ql)?:/.test(process.env.DATABASE_URL ?? "");

export const contem = (texto: string) => (ehPostgres() ? { contains: texto, mode: "insensitive" } : { contains: texto }) as { contains: string };
