// Decisão pendente 9.2: assinatura digital desacoplada atrás de uma interface própria,
// permitindo trocar o "local" (mock, valor probatório mínimo: quem, quando, IP) por um
// provedor externo (gov.br, Clicksign, DocuSign) sem tocar no restante do sistema.

export interface AssinaturaResultado {
  assinadoEm: Date;
  ipAssinatura: string;
  provider: string;
}

export interface SignatureProvider {
  nome: string;
  assinar(params: { signatarioId: string; ip: string }): Promise<AssinaturaResultado>;
}

class LocalSignatureProvider implements SignatureProvider {
  nome = "local";

  async assinar({ ip }: { signatarioId: string; ip: string }): Promise<AssinaturaResultado> {
    return { assinadoEm: new Date(), ipAssinatura: ip, provider: this.nome };
  }
}

const providers: Record<string, SignatureProvider> = {
  local: new LocalSignatureProvider(),
};

export function getSignatureProvider(nome: string = "local"): SignatureProvider {
  const provider = providers[nome];
  if (!provider) throw new Error(`Provedor de assinatura desconhecido: ${nome}`);
  return provider;
}
