import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { exigirPermissao } from "@/lib/tenant";
import { PERFIL_MUNICIPIO } from "@/lib/permissoes";
import { BackLink, PageHeader } from "@/components/ui";
import NovaPrefeituraForm from "./NovaPrefeituraForm";

export const metadata: Metadata = { title: "Nova prefeitura" };

export default async function NovaPrefeituraPage() {
  await exigirPermissao("cadastros");
  const [perfis, fluxos, tipos] = await Promise.all([
    prisma.perfil.findMany({ where: { tipo: "EXTERNO" }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    prisma.fluxoContrato.findMany({ where: { ativo: true, municipioId: null }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    prisma.tipoProjetoModelo.findMany({ where: { municipioId: null }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <BackLink href="/cadastros?aba=municipios" label="Municípios" />
      <PageHeader
        title="Nova prefeitura"
        description="Cadastre a prefeitura, os acessos dela e, se quiser, fluxos exclusivos — tudo de uma vez."
      />
      <NovaPrefeituraForm
        perfisPrefeitura={perfis}
        fluxosContrato={fluxos}
        tiposProjeto={tipos}
        perfilPadrao={perfis.some((p) => p.id === PERFIL_MUNICIPIO) ? PERFIL_MUNICIPIO : perfis[0]?.id ?? ""}
      />
    </div>
  );
}
