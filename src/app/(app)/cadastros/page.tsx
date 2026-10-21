import { redirect } from "next/navigation";
import { exigirPermissao } from "@/lib/tenant";
import { urlCom } from "./_ui/busca";

/**
 * /cadastros abre a Equipe do CTP. Links antigos com abas (`?aba=usuarios`, `?aba=fluxos-contrato`…)
 * levam à seção nova equivalente.
 */
export default async function CadastrosPage({ searchParams }: { searchParams: Promise<{ aba?: string; perfil?: string; fluxo?: string; editar?: string }> }) {
  await exigirPermissao("cadastros");
  const { aba, perfil, fluxo, editar } = await searchParams;
  const destinos: Record<string, string> = {
    setores: "/cadastros/equipe?setores=1",
    usuarios: "/cadastros/equipe",
    perfis: urlCom("/cadastros/perfis", { perfil }),
    municipios: editar ? `/cadastros/prefeituras/${encodeURIComponent(editar)}` : "/cadastros/prefeituras",
    modelos: urlCom("/cadastros/formularios", { editar }),
    fluxos: urlCom("/cadastros/tipos-de-projeto", { tipo: fluxo }),
    "fluxos-contrato": urlCom("/cadastros/tipos-de-contrato", { tipo: fluxo }),
  };
  redirect((aba && destinos[aba]) || "/cadastros/equipe");
}
