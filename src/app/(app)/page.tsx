import { redirect } from "next/navigation";
import { sessaoValidaOuNula } from "@/lib/tenant";
import { pode } from "@/lib/permissoes";

/** Página inicial de cada um: dashboard para quem tem essa permissão, senão a lista de projetos. */
export default async function HomePage() {
  const session = await sessaoValidaOuNula();
  if (!session) redirect("/login");
  redirect(pode(session, "painel") ? "/dashboard" : "/projetos");
}
