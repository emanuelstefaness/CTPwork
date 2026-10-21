import { redirect } from "next/navigation";

/** Endereço antigo do assistente — agora em Cadastros › Prefeituras. */
export default function NovaPrefeituraAntiga() {
  redirect("/cadastros/prefeituras/nova");
}
