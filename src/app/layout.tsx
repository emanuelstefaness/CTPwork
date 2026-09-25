import type { Metadata } from "next";
import { connection } from "next/server";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "CTP Work", template: "%s · CTP Work" },
  description: "Gestão de memorandos, contratos e projetos técnicos do CTP",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Toda página é gerada por requisição: a política de segurança (src/proxy.ts) usa um nonce novo
  // a cada acesso, e uma página estática gerada no build teria scripts sem ele — seriam bloqueados.
  await connection();
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
