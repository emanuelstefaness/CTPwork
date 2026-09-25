/**
 * Layout HTML dos e-mails: tabela com estilos inline (o que Outlook/Gmail renderizam de forma
 * previsível), cores do sistema e sempre um botão para abrir o CTP Work.
 */

const escapar = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function montarEmail({
  titulo,
  introducao,
  itens = [],
  botao,
  rodape,
}: {
  titulo: string;
  introducao: string;
  itens?: { texto: string; url?: string; quando?: string }[];
  botao: { rotulo: string; url: string };
  rodape: string;
}): { html: string; texto: string } {
  const listaHtml = itens
    .map(
      (i) => `
        <tr><td style="padding:12px 0;border-top:1px solid #e2e8f0;">
          <p style="margin:0;font-size:14px;line-height:21px;color:#0f172a;">${escapar(i.texto)}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#64748b;">${i.quando ? `${escapar(i.quando)} · ` : ""}${i.url ? `<a href="${escapar(i.url)}" style="color:#0e7490;font-weight:600;text-decoration:none;">Abrir</a>` : ""}</p>
        </td></tr>`,
    )
    .join("");

  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapar(titulo)}</title></head>
<body style="margin:0;padding:0;background:#f4f7fa;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fa;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
        <tr><td style="padding:0 4px 16px;">
          <span style="display:inline-block;background:#082843;color:#67e8f9;font-weight:800;font-size:12px;padding:8px 10px;border-radius:10px;">CTP</span>
          <span style="font-weight:700;font-size:16px;color:#082843;margin-left:6px;">CTP Work</span>
        </td></tr>
        <tr><td style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:28px;">
          <h1 style="margin:0 0 8px;font-size:20px;line-height:28px;color:#020617;">${escapar(titulo)}</h1>
          <p style="margin:0 0 16px;font-size:14px;line-height:22px;color:#475569;">${escapar(introducao)}</p>
          ${listaHtml ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${listaHtml}</table>` : ""}
          <p style="margin:24px 0 0;"><a href="${escapar(botao.url)}" style="display:inline-block;background:#0e7490;color:#ffffff;font-weight:600;font-size:14px;padding:12px 20px;border-radius:10px;text-decoration:none;">${escapar(botao.rotulo)}</a></p>
        </td></tr>
        <tr><td style="padding:16px 4px;font-size:12px;line-height:18px;color:#94a3b8;">${escapar(rodape)}</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const texto = [
    titulo,
    "",
    introducao,
    "",
    ...itens.map((i) => `• ${i.texto}${i.url ? `\n  ${i.url}` : ""}`),
    "",
    `${botao.rotulo}: ${botao.url}`,
    "",
    rodape,
  ].join("\n");

  return { html, texto };
}
