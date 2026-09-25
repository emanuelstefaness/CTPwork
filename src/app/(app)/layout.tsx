import { signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { sessaoValidaOuNula } from "@/lib/tenant";
import { AppShell } from "@/components/app-shell";
import { PortalShell } from "@/components/portal-shell";
import { gerarNotificacoesPrazoEstourado } from "@/lib/prazos";
import { contarConversasNaoLidas } from "@/lib/conversas";

const internalNav = (conversasNaoLidas: number) => [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" as const },
  { href: "/memorandos", label: "Memorandos", icon: "memorandos" as const },
  { href: "/contratos", label: "Contratos", icon: "contratos" as const },
  { href: "/projetos", label: "Projetos", icon: "projetos" as const },
  { href: "/conversas", label: "Conversas", icon: "conversas" as const, badge: conversasNaoLidas },
  { href: "/prazos", label: "Prazos", icon: "prazos" as const },
];

async function fazerLogout() {
  "use server";
  await signOut({ redirectTo: "/login" });
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // sessaoValidaOuNula (não auth() puro) também rejeita um cookie cujo usuário não existe mais no
  // banco — sem essa checagem, a página carregava normalmente e só quebrava (com erro cru de FK do
  // Prisma) na primeira ação de escrita, como enviar uma mensagem no chat. Quando inválida,
  // redirecionamos para uma rota que limpa o cookie (não direto para /login): o middleware
  // (src/proxy.ts) só olha se existe um JWT validamente assinado, então um redirect direto para
  // /login com o cookie antigo ainda presente causava loop infinito (middleware manda de volta pra "/").
  const session = await sessaoValidaOuNula();
  if (!session) redirect("/api/sair-sessao-invalida");

  const isInterno = session.tipo === "INTERNO";
  const isGestor = session.perfilInterno === "GESTOR";

  if (isInterno) await gerarNotificacoesPrazoEstourado();

  const [notificacoesNaoLidas, conversasNaoLidas] = await Promise.all([
    prisma.notificacao.count({ where: { userId: session.id, lida: false } }),
    contarConversasNaoLidas(session),
  ]);

  if (!isInterno) {
    return (
      <PortalShell userName={session.name ?? "Usuário"} notificacoesNaoLidas={notificacoesNaoLidas} conversasNaoLidas={conversasNaoLidas} onSignOut={fazerLogout}>
        {children}
      </PortalShell>
    );
  }

  const navItems = isGestor
    ? [...internalNav(conversasNaoLidas), { href: "/cadastros", label: "Cadastros", icon: "cadastros" as const }]
    : internalNav(conversasNaoLidas);

  return (
    <AppShell navItems={navItems} userName={session.name ?? "Usuário"} isGestor={isGestor} notificacoesNaoLidas={notificacoesNaoLidas} conversasNaoLidas={conversasNaoLidas} onSignOut={fazerLogout}>
      {children}
    </AppShell>
  );
}
