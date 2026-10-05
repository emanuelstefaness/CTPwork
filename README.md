# CTP Work

Sistema de gestão de memorandos, contratos e projetos técnicos do CTP (Cilla Tech Park) — consultoria formal a municípios (Estatuto e PCCS, Plano Diretor, projetos personalizados), com assinatura digital multiusuário, chat rastreável por etapa e revisão colaborativa de minutas.

Construído a partir do "Prompt Mestre — Construção do Sistema CTP Work".

## Stack escolhida (seção 12 do prompt mestre)

- **Linguagem/Framework full-stack:** Next.js 16 (App Router) + TypeScript. Unifica frontend e backend, com Server Actions cobrindo mutações sem precisar de uma API REST separada.
- **Banco de dados:** SQLite via Prisma ORM em desenvolvimento (zero-install, roda em qualquer máquina). Trocar para PostgreSQL em produção é apenas mudar `provider` no `prisma/schema.prisma` + `DATABASE_URL` — o schema já usa strings em vez de enums nativos justamente para ser portável entre os dois.
- **Autenticação:** NextAuth v5 (Credentials + JWT), com `tipo` (INTERNO/EXTERNO) e `perfilInterno` no token de sessão.
- **Isolamento por contratante (ponto 1 da seção 12):** aplicado na camada de aplicação, não via RLS nativo do banco — todo acesso de usuário externo passa por `assertAcessoContratante()` (`src/lib/tenant.ts`), que compara `municipioId` da sessão com o `contratanteId` do recurso. Decisão registrada porque SQLite não tem RLS nativo e a lógica de aplicação é portável para qualquer banco.
- **Assinatura digital (ponto 2, decisão pendente 9.2):** desacoplada atrás da interface `SignatureProvider` (`src/lib/signature/provider.ts`). Implementação padrão `local` registra quem/quando/IP para valor probatório mínimo; trocar por gov.br/Clicksign/DocuSign é implementar a interface e trocar o registro em `getSignatureProvider`.
- **Revisão de documento (ponto 3):** editor de documentos próprio (TipTap/ProseMirror) com versões, grifos, comentários, concordo/discordo e sugestão de redação por trecho — ver "Editor de documentos" abaixo.
- **E-mail:** nodemailer via SMTP de qualquer provedor; sem SMTP configurado, os e-mails são gravados em `storage/emails` (nada é enviado).
- **Upload/versionamento de arquivos:** armazenamento local privado em `storage/uploads` (`src/lib/storage.ts`), registrado como `Anexo` no banco e servido somente pela rota autenticada `/api/files/[id]`. Há validação de tipo e limite de 20 MB; trocar por S3/Blob storage continua isolado a este módulo.
- **Notificações:** registros `Notificacao` criados automaticamente nas transições da seção 6.3 (etapa aguardando município / resposta do município), com página `/notificacoes` e contador no header. Não há push/e-mail — apenas notificação in-app.

## Rodando localmente

```bash
npm install
npx prisma migrate dev
npm run seed
npm run dev
```

Abre em `http://localhost:3000` (ou na porta configurada).

Variáveis de ambiente (`.env`, fora do git):

| Variável | Para quê |
| --- | --- |
| `DATABASE_URL` | Banco SQLite (`file:./dev.db`). |
| `AUTH_SECRET` | Assinatura do cookie de sessão — gere um valor aleatório próprio em produção (`npx auth secret`). |
| `AUTH_TRUST_HOST=true` | **Obrigatória em produção fora da Vercel.** Sem ela o Auth.js recusa o host (`UntrustedHost`) e ninguém consegue entrar. |
| `APP_URL` | Endereço público do sistema (ex.: `https://work.ctp.org.br`), usado nos links dos e-mails. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Servidor de e-mail. **Sem `SMTP_HOST` nenhum e-mail sai**: eles são gravados em `storage/emails/*.html` para conferência. `SMTP_SECURE=true` força TLS direto (padrão: só na porta 465). |
| `EMAIL_FROM` | Remetente, ex.: `CTP Work <nao-responda@ctp.org.br>`. |
| `MOSTRAR_CONTAS_DEMO=true` | Mostra as contas de demonstração na tela de login em produção (em desenvolvimento aparecem sempre). |

> Não ligue o SMTP num banco com os dados de demonstração: os usuários de exemplo têm e-mails de domínios reais de prefeituras.

Produção local: `npm run build` e depois `npm run dev -- --port 4150 --strictPort` (o `--strictPort` faz o script rodar `next start`).

Para popular o sistema com dados de demonstração completos (contratos, projetos, minutas com grifos e comentários das duas partes, conversas, memorandos, notificações e PDFs reais), rode depois do `npm run seed`:

```bash
npm run seed:demo
```

É idempotente (pode rodar várias vezes) e não apaga dados existentes. Cria também usuários de município, ex.: `marina.kowalski@guarapuava.pr.gov.br`, `helena.bittencourt@mariopolis.pr.gov.br`, `juliana.menegatti@patobranco.pr.gov.br` (senha `ctpwork123`).

### Contas de demonstração (senha `ctpwork123`)

| Papel | Email |
|---|---|
| Gestor CTP | gestor@ctp.org.br |
| Colaborador CTP (Técnico) | colaborador@ctp.org.br |
| Colaborador CTP (Jurídico) | juridico@ctp.org.br |
| Colaborador CTP (Administrativo) | admin@ctp.org.br |
| Usuário externo (município) | municipio@cilla.mg.gov.br |

## Interface redesenhada

- Dashboard executivo com indicadores, gráficos, prazos e atividades recentes.
- Navegação por menu sanduíche (interno e portal do município), com busca, filtros e fichas de detalhe.
- Projetos em cards, busca, progresso por etapas, cronograma, documentos, revisão e chat contextual.
- Contratos, memorandos e prazos em tabelas consistentes, com estados visuais e filtros.
- Design system local com Inter, tokens de cor, painéis, badges, botões, formulários e foco acessível.

O seed inclui um cenário completo de demonstração de Guarapuava, com contrato, projeto, sete etapas, documentos, histórico, mensagens e revisão.

## Editor de documentos (revisão de minutas)

Nas etapas com revisão, o documento é escrito e revisado **dentro do sistema**, num editor tipo Word
(TipTap/ProseMirror): títulos, negrito/itálico/sublinhado, listas, tabelas, alinhamento e marca-texto.

- **CTP** edita um *rascunho* (salvo automaticamente, visível só ao CTP), pode importar um `.docx`
  e deixar notas em trechos. "Enviar ao município" congela o texto como **versão N** e passa a etapa
  para *Aguardando município*.
- **Município** confirma a leitura (obrigatória) e, selecionando qualquer trecho, pode **grifar**
  (4 cores), **comentar**, **concordar** ou **discordar** (com justificativa). Ao final dá o parecer
  da versão: *Aprovar* ou *Pedir ajustes*.
- **Sugerir redação:** o município não edita o texto, mas pode propor a nova redação de qualquer
  trecho (ou a supressão dele), com justificativa. Na versão enviada a proposta aparece como no
  "controlar alterações" do Word (trecho atual riscado, texto novo em verde). O CTP decide no rascunho
  da versão seguinte: **Aceitar** troca o trecho no texto (dá para desfazer com Ctrl+Z; há "aceitar
  todas"), **Recusar** exige o motivo. O município é notificado da decisão.
- Os dois lados respondem em conversa encadeada em cada apontamento; o CTP (ou o autor) marca como
  resolvido. A versão N+1 nasce da N e mostra ao lado os apontamentos pendentes da anterior, com
  "Localizar no texto".
- **Comparar versões** (palavras inseridas/removidas), **exportar .docx** (grifos viram marca-texto e
  comentários viram comentários nativos do Word, com respostas encadeadas) e **imprimir/PDF**.

Anotações ficam fora do texto (`AnotacaoDocumento`), ancoradas por posição + trecho citado; o servidor
confere a âncora com o mesmo esquema do editor (`src/lib/editor`). Bancos criados antes do editor:
`npx tsx prisma/migrar-editor.ts` converte as versões antigas (seções/artigos) para o editor.

## Conversas com o município

Menu **Conversas** (interno e portal do município): canal para o que não pertence a uma etapa —
dúvidas sobre o contrato, agendamento de reunião, pedidos, ofícios. O chat de cada etapa continua
existindo para o assunto da etapa.

- Qualquer lado abre uma conversa com assunto, mensagem e anexo, opcionalmente citando um contrato
  ou projeto (as páginas do contrato e do projeto listam as conversas ligadas a eles).
- Cada conversa é de um município só — o isolamento é o mesmo do resto do sistema, inclusive nos
  anexos.
- Avisos vão sempre para o outro lado: mensagem do CTP avisa os usuários do município; mensagem do
  município avisa quem do CTP já participa (ou, numa conversa nova, o responsável pelo contrato/projeto
  citado, depois os responsáveis pelos contratos do município e, por fim, os gestores).
- Contador de não lidas no menu e no cabeçalho; filtro "Aguardando o CTP / Aguardando você";
  encerrar e reabrir (responder uma encerrada a reabre). A conversa aberta se atualiza a cada 20 s.

## Avisos por e-mail e conta

- **Todo aviso do sino também vai por e-mail**, sem código extra em cada ação: o cliente Prisma
  (`src/lib/prisma.ts`) agenda o despacho sempre que uma `Notificacao` é gravada, e
  `src/lib/email/despacho.ts` junta o que chegou para a mesma pessoa em poucos segundos num e-mail só.
  Cada aviso sai uma única vez (`emailStatus`); avisos com mais de 24 h sem envio são descartados.
  O despacho roda dentro do servidor Node (`next start`); numa hospedagem serverless, trocar por
  uma fila/cron chamando `despacharEmails()`.
- **Minha conta** (clicar no nome): trocar a senha e ligar/desligar os avisos por e-mail.
- **Esqueci minha senha**: link de uso único válido por 1 hora (só o hash fica no banco); a
  resposta é a mesma exista ou não a conta.
- **Login**: 5 senhas erradas seguidas bloqueiam aquele e-mail por 15 minutos.
- **Desativar acesso** (Cadastros › Usuários, só gestor): a pessoa não entra mais e é desconectada
  no próximo clique; sai das listas de escolha e dos avisos, mas o histórico (comentários,
  assinaturas, mensagens, auditoria) fica. Reativável. Ninguém desativa a si mesmo nem o último gestor.

## Prefeituras: assistente e fluxos exclusivos

- **Cadastros › Municípios › Nova prefeitura (assistente)**: numa tela só cadastra o município, as
  pessoas da prefeitura (cada uma com seu perfil) e, se quiser, um tipo de contrato e um tipo de
  projeto **exclusivos**, copiados de um existente para ajustar depois. O gestor define o **e-mail
  e a senha** de cada pessoa (botão "Gerar" cria uma senha forte) e repassa; cada uma só enxerga
  o que é daquela prefeitura e pode trocar a senha em Minha conta.
- **Fluxos exclusivos**: todo tipo de contrato e de projeto tem "Disponível para: todas as
  prefeituras / só a Prefeitura X". Ao criar um contrato, aparecem os tipos gerais mais os
  exclusivos da prefeitura escolhida (o exclusivo já vem sugerido); o servidor recusa usar o
  exclusivo de outra.
- **Senhas**: mínimo de 8 caracteres, no assistente e no cadastro avulso. O gestor troca a senha de
  alguém em Cadastros › Usuários › Editar › "Nova senha".

## Perfis e permissões

Em **Cadastros › Perfis e permissões** o gestor cria perfis (cargos) — ex.: Jurídico, Financeiro,
Prefeito, Secretário — e marca o que cada um pode fazer. Cada usuário tem um perfil (escolhido no
cadastro). O catálogo fica em `src/lib/permissoes.ts`:

| Para | Permissão |
| --- | --- |
| CTP | Ver o dashboard · Gerenciar contratos · Gerenciar etapas de projeto · Reabrir etapas · Escrever minutas · Cancelar memorandos de outras pessoas · Acessar Cadastros |
| Prefeitura | Revisar minutas (grifar/comentar/sugerir) · Dar o parecer da minuta · Assinar contratos pelo município · Enviar documentos e formulários |

- **"Vê só os contratos e projetos em que participa"** (perfis do CTP): onde a pessoa é responsável,
  responsável por alguma etapa ou signatária — vale para listas, detalhes, prazos, Word/PDF e anexos
  (`src/lib/visibilidade.ts`).
- Nas **etapas de contrato**, dá para restringir quais perfis podem concluí-la.
- Perfis de fábrica (Gestor, Colaborador, Município) reproduzem o comportamento anterior; podem ser
  editados, não excluídos. Mudanças valem no próximo clique (a sessão lê o perfil do banco a cada request).
- Regras fixas: a prefeitura só vê o próprio município; o sistema nunca fica sem alguém com acesso
  a Cadastros (a trava vale ao editar perfil, trocar o perfil de alguém ou desativar usuário).
- Avisos que iam "para os gestores" (prazo vencido, conversa sem responsável) vão para quem tem
  acesso a Cadastros.

## Fluxos de contrato (tipos de contrato)

Em **Cadastros › Fluxos de contrato** o gestor cria tipos de contrato (ex.: Padrão, Dispensa de
licitação, Termo aditivo), cada um com as próprias etapas, na ordem:

- **Exige assinaturas** (no máximo uma por tipo): ali se abre a coleta de assinaturas, e o contrato
  só avança com todas coletadas.
- **Libera o projeto**: a partir dessa etapa dá para criar o projeto técnico (um tipo sem ela não
  gera projeto — útil para aditivos).
- A última etapa é o estado final ("concluído").

Ao criar um contrato escolhe-se o tipo; as etapas são **copiadas** para o contrato (`EtapaContrato`),
então editar o tipo depois não mexe nos contratos em andamento. Cada etapa guarda quem a concluiu e
quando (aparece no stepper). Tipos não são apagados, só desativados. Contratos anteriores a esta
função seguem o tipo **Padrão** (as 6 etapas originais). Lógica comum em `src/lib/fluxo-contrato.ts`.

## Documentos e aprovações no contrato

- **Documentos da etapa** (`DocumentoContrato`): cada etapa do tipo de contrato lista os documentos que a
  prefeitura envia e os que o CTP envia; eles são pedidos automaticamente em todo contrato novo. A prefeitura
  envia pelo portal, o CTP confere e **aprova** ou **recusa com motivo** (volta a pendente, o arquivo fica no
  histórico); documentos do CTP valem como entregues ao enviar. O CTP pode pedir outros na hora. **A etapa só
  avança com todos aprovados.** Tipo Padrão: proposta de orçamento (CTP) na emissão; termo de referência,
  dotação orçamentária, portaria do fiscal (prefeitura), certidões e contrato social (CTP) na contratação.
- **Etapa concluída pela prefeitura** (`concluidaPelaPrefeitura`): quem decide é a prefeitura (permissão
  "Aprovar etapas do contrato"), não o CTP. No Padrão, a aprovação do orçamento: o prefeito vê o orçamento e
  aprova, ou pede revisão com motivo — o contrato volta à emissão e o orçamento volta a ser pedido.
- Em Cadastros › Fluxos de contrato, "aplicar aos contratos em andamento" leva a regra e os documentos que
  faltarem às etapas ainda não concluídas. Cada contrato mostra o "Próximo passo" de quem está vendo.

## Segurança HTTP

- `next.config.ts`: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`,
  `Permissions-Policy`, `Cross-Origin-Opener-Policy` e, em produção, HSTS — em todas as respostas,
  inclusive arquivos; sem `X-Powered-By`.
- `src/proxy.ts`: **Content-Security-Policy com nonce** por requisição (`script-src 'nonce-…'
  'strict-dynamic'`): só roda o script que o próprio Next gerou naquela resposta. Estilos inline
  seguem liberados (editor, gráficos e grifos usam `style`). Por causa do nonce, todas as páginas
  são geradas por requisição (`connection()` no layout raiz).
- Anexos de até **20 MB** (o Next limita server actions a 1 MB por padrão — ver `next.config.ts`).

## Testes automatizados

```bash
npm test                 # unidade + ponta a ponta
npm run test:unit        # regras puras (âncoras do editor, sugestão, não lidas, limite de tentativas) — ~2 s
npm run test:e2e         # navegador de verdade contra o sistema em modo produção — ~5 min
npm run test:relatorio   # abre o relatório HTML da última execução (com prints e rastros das falhas)
```

- **Unidade** (`testes/unidade`): `node:test` via `tsx`, sem dependência extra.
- **Ponta a ponta** (`testes/e2e`, Playwright): `scripts/servidor-teste.mjs` cria um banco próprio
  (`prisma/teste.db`) com o seed de demonstração, uma pasta de arquivos própria (`storage-teste/`),
  gera o build e sobe o sistema na porta 4200. **O banco de desenvolvimento nunca é tocado** e nenhum
  e-mail sai (os testes leem os e-mails gravados em `storage-teste/emails`).
  `PULAR_BUILD=1 npm run test:e2e` reaproveita o último build quando só os testes mudaram.
- Cobertura: login, bloqueio por tentativas, esqueci/troca de senha, isolamento entre municípios
  (páginas e arquivos), ciclo da minuta (leitura obrigatória → sugestão de redação → comentário →
  parecer → CTP aceita/recusa → nova versão → comparação → Word), checklist com anexo de 3 MB,
  chat da etapa (limite de 20 MB, aviso por e-mail) e conversas (não lidas, resposta com anexo,
  isolamento, encerrar).
- Usa o Google Chrome da máquina. Em CI: `npx playwright install chromium` e `PW_NAVEGADOR=chromium`.

## Verificações realizadas

- `npm run lint`
- `npm run build`
- seed em banco limpo
- testes HTTP autenticados das telas principais com os perfis interno e externo

O relatório detalhado de validação está em `design-qa.md`.

## Estrutura de etapas por tipo de projeto

Validada contra o mockup original (`CTP Work.zip` fornecido pelo usuário) — as duas telas de
"Diagnóstico/Minutas" do mockup trazem breadcrumb e barra de abas trocados entre si (a mesma
inconsistência já registrada na seção 9.1 do prompt mestre), então a sequência de nomes abaixo é
a reconstrução fiel a partir do conteúdo de cada tela, não do breadcrumb isolado:

- **Estatuto e PCCS** (modo `ARTIGO`): Informações iniciais → Documentos iniciais → Diagnóstico inicial → Minutas versão 01 → Análise e devolutiva 01 → Minutas 02 → Devolutiva 02.
- **Plano Diretor**: Informações iniciais → Documentos iniciais → Fase 01 — Leitura técnica e comunitária → Fase 02 — Diretrizes e propostas → Fase 03 — Minuta do projeto de lei → Fase 04 — Audiência pública (checklist: edital, ata, lista de presença) → Fase 05 — Versão final e envio à Câmara. Todas as fases, menos a 04, são entregas revisadas pela prefeitura no editor.
- **Personalizado:** Informações iniciais → Documentos iniciais → Fase 01 (entrega revisada pela prefeitura).

No Estatuto e PCCS, Diagnóstico inicial, Análise e devolutiva 01 e Devolutiva 02 também são entregas revisadas.
Nenhuma etapa de modelo fica sem função: Cadastros marca "Sem função — só chat" quando isso acontece.

Cada etapa carrega capacidades persistidas (`temInformacoesProjeto`, `temFormulario`, `temChecklist`, `temRevisao` em `EtapaProjeto`), não inferidas pelo nome — evita que uma etapa como "Fase 02" perca a revisão só por não ter "minuta" no nome. "Informações iniciais" é a etapa que mostra os dados do projeto (código/contratante/vigência, herdados do contrato) e o cronograma de atividades.

- **Documentos pedidos por padrão** (`EtapaModelo.documentosPadrao`): com checklist ligado, a etapa do modelo lista documentos que entram no checklist de todo projeto novo.
- **Aplicar aos projetos em andamento**: ao salvar uma etapa do modelo, as etapas **ainda não iniciadas** dos projetos desse tipo (achadas pelo nome anterior) recebem nome, funções e os documentos padrão que faltarem. Etapas iniciadas ou concluídas não mudam.

## Decisões e simplificações assumidas

Seguindo a seção 9 do prompt mestre ("siga o padrão recomendado, mas deixe configurável"):

- **9.1 Modo de revisão:** unificado no editor de documentos — qualquer trecho (um artigo, um parágrafo, uma frase) pode receber concordo/discordo/comentário, o que cobre tanto a revisão "artigo por artigo" quanto a do "documento inteiro". O campo `modoRevisao` permanece só por compatibilidade.
- **9.2 Provedor de assinatura:** `local` (mock com IP + timestamp), desacoplado via interface.
- **9.3 Duplicação "Contrato e termo de referência":** implementado como duas sub-etapas (`TERMO_REFERENCIA_MINUTA` e `TERMO_REFERENCIA_ASSINADO`).
- **9.4 Prazo estourado:** notificação automática ao responsável e aos gestores quando o dia do prazo termina (sem bloqueio automático); a aba Prazos destaca vencidos.
- **9.5 Reabertura:** só perfil Gestor, com motivo obrigatório e registro em `AuditLog`.
- **9.6 Herança Contrato → Projeto:** contratante, vínculo ao contrato e anexos herdados por referência (sem duplicar arquivo).

## Não coberto neste MVP (próximos incrementos)

- Edição simultânea em tempo real do mesmo rascunho por duas pessoas (hoje o fluxo é por vez/versão).
- Infra de produção: PostgreSQL, anexos em armazenamento de objetos (S3 ou similar) e backup — hoje SQLite e disco local.
- Assinatura com validade jurídica (ICP-Brasil / gov.br) — o provedor atual registra IP e horário.
- Cronograma de atividades: implementado como lista ordenada por data (não um grid de calendário visual mês-a-mês).
