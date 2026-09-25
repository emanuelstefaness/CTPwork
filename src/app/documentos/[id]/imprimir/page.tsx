import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { sessaoValidaOuNula, assertAcessoContratante } from "@/lib/tenant";
import { ImpressaoDocumento } from "@/components/editor/ImpressaoDocumento";
import type { DecisaoSugestao, TipoAnotacao } from "@/lib/editor/extensoes";

export const metadata: Metadata = { title: "Imprimir documento" };

// Fora do grupo (app): sem menu nem cabeçalho, só a página do documento para imprimir/PDF.
export default async function ImprimirDocumentoPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await sessaoValidaOuNula();
  if (!user) redirect("/login");
  const { id } = await params;
  const documento = await prisma.documentoVersionado.findUnique({
    where: { id },
    include: {
      etapa: { include: { projeto: true } },
      anotacoes: { include: { autor: true, respostas: { include: { autor: true }, orderBy: { createdAt: "asc" } } }, orderBy: { de: "asc" } },
    },
  });
  if (!documento || !documento.conteudo) notFound();
  assertAcessoContratante(user, documento.etapa.projeto.contratanteId);
  if (!documento.enviadoEm && user.tipo !== "INTERNO") notFound();

  return (
    <ImpressaoDocumento
      conteudo={JSON.parse(documento.conteudo)}
      titulo={documento.titulo ?? documento.nomeArquivo}
      cabecalho={`${documento.etapa.projeto.codigo} · ${documento.etapa.nome} · ${documento.enviadoEm ? `versão ${documento.versao}` : `rascunho v${documento.versao}`}`}
      anotacoes={documento.anotacoes.map((a) => ({
        id: a.id,
        autor: { id: a.autor.id, nome: a.autor.nome, tipo: a.autor.tipo },
        de: a.de,
        ate: a.ate,
        trecho: a.trecho,
        tipo: a.tipo as TipoAnotacao,
        cor: a.cor,
        texto: a.texto,
        sugestao: a.sugestao,
        decisao: a.decisao as DecisaoSugestao | null,
        resolvido: a.resolvido,
        resolvidoPor: null,
        criadoEm: a.createdAt.toISOString(),
        respostas: a.respostas.map((r) => ({ id: r.id, autor: { id: r.autor.id, nome: r.autor.nome, tipo: r.autor.tipo }, texto: r.texto, criadoEm: r.createdAt.toISOString() })),
      }))}
    />
  );
}
