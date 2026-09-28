import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { exigirPermissao } from "@/lib/tenant";
import { pode } from "@/lib/permissoes";
import { FLUXO_PADRAO_ID } from "@/lib/fluxo-contrato";
import { BackLink, PageHeader } from "@/components/ui";
import NovoContratoForm from "./NovoContratoForm";

export const metadata: Metadata = { title: "Novo contrato" };

export default async function NovoContratoPage() {
  const user = await exigirPermissao("contrato.gerenciar");
  const [municipios, usuarios, fluxos] = await Promise.all([
    prisma.municipio.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    prisma.user.findMany({ where: { tipo: "INTERNO", ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    // Só tipos ativos e com ao menos 2 etapas podem receber contratos novos.
    prisma.fluxoContrato.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, descricao: true, municipioId: true, etapas: { orderBy: { ordem: "asc" }, select: { nome: true, exigeAssinaturas: true, liberaProjeto: true } } },
    }),
  ]);
  const utilizaveis = fluxos.filter((f) => f.etapas.length >= 2);

  return (
    <div className="mx-auto max-w-4xl">
      <BackLink href="/contratos" label="Contratos" />
      <PageHeader title="Novo contrato" description="Registre o pedido que abre um novo fluxo contratual." />
      <NovoContratoForm
        municipios={municipios}
        usuarios={usuarios}
        fluxos={utilizaveis}
        responsavelPadrao={user.id}
        fluxoPadrao={utilizaveis.some((f) => f.id === FLUXO_PADRAO_ID) ? FLUXO_PADRAO_ID : utilizaveis[0]?.id ?? ""}
        podeConfigurar={pode(user, "cadastros")}
      />
    </div>
  );
}
