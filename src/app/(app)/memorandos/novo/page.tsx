import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireInterno } from "@/lib/tenant";
import { BackLink, PageHeader } from "@/components/ui";
import NovoMemorandoForm from "./NovoMemorandoForm";

export const metadata: Metadata = { title: "Novo memorando" };

export default async function NovoMemorandoPage() {
  const user = await requireInterno();

  const [setores, usuarios, modelos] = await Promise.all([
    prisma.setor.findMany({ orderBy: { nome: "asc" } }),
    prisma.user.findMany({ where: { tipo: "INTERNO", ativo: true }, orderBy: { nome: "asc" }, include: { setor: true } }),
    prisma.modeloFormulario.findMany({ where: { tipo: "MEMORANDO" } }),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <BackLink href="/memorandos" label="Memorandos" />
      <PageHeader title="Novo memorando" description="Envie uma solicitação rastreável para um ou mais setores do Cilla Tech Park." />
      <NovoMemorandoForm
        meuId={user.id}
        setores={setores.map((s) => ({ id: s.id, nome: s.nome }))}
        usuarios={usuarios.map((u) => ({ id: u.id, nome: u.nome, setorId: u.setorId, setorNome: u.setor?.nome ?? null }))}
        modelos={modelos.map((m) => ({ id: m.id, nome: m.nome, campos: JSON.parse(m.campos) }))}
      />
    </div>
  );
}
