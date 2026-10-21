/**
 * Campos de um formulário de Cadastros › Formulários (modelos de memorando e o formulário das
 * etapas de projeto). A chave de cada campo — onde a resposta fica guardada — não aparece para o
 * gestor: nasce do rótulo e não muda depois, para que renomear um campo não perca as respostas.
 */

export type CampoFormulario = { chave: string; label: string; tipo: string; obrigatorio: boolean };

const TIPOS_CAMPO = ["text", "textarea", "date"];

const chaveDoRotulo = (rotulo: string) =>
  rotulo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);

/** FormData do editor → campos validados. Campos que já existem mantêm a chave; os novos ganham uma livre. */
export function camposDoFormulario(formData: FormData): CampoFormulario[] {
  const existentes = formData.getAll("campoChave").map((c) => String(c).trim().slice(0, 80));
  const labels = formData.getAll("campoLabel").map(String);
  const tipos = formData.getAll("campoTipo").map(String);
  const obrigatorios = formData.getAll("campoObrigatorio").map(String);

  const usadas = new Set(existentes.filter(Boolean));
  const campos = labels
    .map((labelRaw, i) => {
      const label = labelRaw.trim().slice(0, 120);
      let chave = existentes[i] ?? "";
      if (!chave) {
        const base = chaveDoRotulo(label) || "campo";
        chave = base;
        for (let n = 2; usadas.has(chave); n++) chave = `${base}_${n}`;
        usadas.add(chave);
      }
      return { chave, label, tipo: TIPOS_CAMPO.includes(tipos[i]) ? tipos[i] : "text", obrigatorio: obrigatorios.includes(String(i)) };
    })
    .filter((c) => c.label)
    .slice(0, 40);

  if (new Set(campos.map((c) => c.chave)).size !== campos.length) throw new Error("Há campos repetidos no formulário. Recarregue a página e tente de novo.");
  if (campos.length === 0) throw new Error("Informe ao menos um campo para o formulário.");
  return campos;
}
