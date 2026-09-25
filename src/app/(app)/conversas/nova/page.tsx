import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/tenant";
import { BackLink, PageHeader } from "@/components/ui";
import NovaConversaForm from "./NovaConversaForm";

export const metadata: Metadata = { title: "Nova conversa" };

export default async function NovaConversaPage({ searchParams }: { searchParams: Promise<{ municipio?: string; contrato?: string; projeto?: string }> }) {
  const user = await requireSession();
  const isInterno = user.tipo === "INTERNO";
  const params = await searchParams;
  const doMunicipio = isInterno ? {} : { contratanteId: user.municipioId ?? "__nenhum__" };

  const [municipios, contratos, projetos] = await Promise.all([
    isInterno ? prisma.municipio.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }) : Promise.resolve([]),
    prisma.contrato.findMany({ where: doMunicipio, orderBy: { codigo: "desc" }, select: { id: true, codigo: true, objeto: true, contratanteId: true } }),
    prisma.projeto.findMany({ where: doMunicipio, orderBy: { codigo: "desc" }, select: { id: true, codigo: true, tipo: true, contratanteId: true, contratoOrigem: { select: { objeto: true } } } }),
  ]);

  // Vindo de um contrato/projeto ("Nova conversa sobre este contrato"), já chega preenchido.
  const vinculoInicial = params.projeto ? `projeto:${params.projeto}` : params.contrato ? `contrato:${params.contrato}` : "";
  const municipioInicial =
    params.municipio ??
    projetos.find((p) => p.id === params.projeto)?.contratanteId ??
    contratos.find((c) => c.id === params.contrato)?.contratanteId ??
    "";

  return (
    <div className="mx-auto max-w-3xl">
      <BackLink href="/conversas" label="Conversas" />
      <PageHeader
        title="Nova conversa"
        description={isInterno ? "Abra um assunto com o município. Todos os usuários do município são avisados." : "Escreva para a equipe do CTP. O responsável pelo seu contrato é avisado."}
      />
      <NovaConversaForm
        isInterno={isInterno}
        municipios={municipios}
        vinculos={[
          ...contratos.map((c) => ({ valor: `contrato:${c.id}`, rotulo: `${c.codigo} — ${c.objeto}`, grupo: "Contratos", municipioId: c.contratanteId })),
          ...projetos.map((p) => ({ valor: `projeto:${p.id}`, rotulo: `${p.codigo} — ${p.contratoOrigem.objeto}`, grupo: "Projetos", municipioId: p.contratanteId })),
        ]}
        municipioInicial={municipioInicial}
        vinculoInicial={vinculoInicial}
      />
    </div>
  );
}
