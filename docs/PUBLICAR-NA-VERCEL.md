# Publicar o CTP Work na Vercel

No computador o sistema usa SQLite e guarda anexos na pasta `storage/`. A Vercel não tem disco
permanente, então lá ele usa:

- **Neon** (PostgreSQL) para o banco de dados;
- **Vercel Blob** (privado) para os anexos.

Os dois têm plano gratuito e são criados dentro da própria Vercel. O código já está pronto para os
dois: nada precisa ser alterado, só configurado.

## Passo a passo

### 1. Importar o projeto

1. Entre em [vercel.com](https://vercel.com) com a conta do GitHub.
2. **Add New… › Project** e escolha o repositório **CTPwork** › **Import**.
3. Em **Environment Variables**, adicione:

   | Nome | Valor |
   |---|---|
   | `AUTH_SECRET` | Um texto aleatório longo. Para gerar: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
   | `DADOS_DEMONSTRACAO` | `true` para publicar **com os dados de exemplo** (prefeituras, contratos, projetos, conversas). Sem ela, o sistema nasce vazio |
   | `ADMIN_SENHA` | Só sem dados de exemplo: senha do administrador (mínimo 8 caracteres) |
   | `ADMIN_EMAIL` | *(opcional, só sem dados de exemplo)* E-mail do administrador. Padrão: `admin@ctp.org.br` |

   Com `DADOS_DEMONSTRACAO=true`, a tela de login mostra as contas de exemplo, todas com a senha
   `ctpwork123` (ex.: `gestor@ctp.org.br`; prefeitura: `carlos.pellizzaro@clevelandia.pr.gov.br`).
   Qualquer pessoa com o link consegue entrar: use só para demonstração, nunca com dados reais.

4. Clique em **Deploy**. **Essa primeira tentativa vai falhar** com a mensagem
   "DATABASE_URL precisa ser um PostgreSQL": é esperado, o banco ainda não existe.

### 2. Criar o banco (Neon)

1. No projeto, aba **Storage › Create Database › Neon** (Serverless Postgres) › **Continue**.
2. Região: **Washington, D.C., USA (iad1)**. É a mesma região padrão das funções da Vercel; banco
   e sistema longe um do outro deixam todas as telas lentas.
3. Plano **Free** › dê um nome (ex.: `ctp-work`) › **Create**.
4. Em **Connect Project**, confirme o projeto CTPwork, todos os ambientes marcados e o prefixo das
   variáveis **em branco**. Isso cria `DATABASE_URL` e `DATABASE_URL_UNPOOLED`, que o sistema usa.

### 3. Criar o espaço dos anexos (Blob)

1. Aba **Storage › Create Database › Blob** › **Continue**.
2. Acesso: **Private**. Os anexos (contratos, documentos das prefeituras) não podem ter link
   público; quem baixa passa sempre pela checagem de permissão do sistema.
3. Dê um nome (ex.: `ctp-work-anexos`) › **Create** › conecte ao projeto CTPwork.
   Isso cria `BLOB_READ_WRITE_TOKEN`.

### 4. Publicar de novo

Aba **Deployments** › no último deploy, menu **⋯ › Redeploy**.

Na publicação o sistema:

1. cria as tabelas no banco;
2. no banco vazio, cria os dados de exemplo (com `DADOS_DEMONSTRACAO=true`) ou só a configuração
   base (perfis, tipo de contrato Padrão, tipos de projeto, setores, modelos) e o administrador com
   `ADMIN_SENHA`;
3. gera o build.

Nas publicações seguintes ele só atualiza as tabelas: nenhum dado cadastrado é tocado.

### 5. Primeiro acesso

Com dados de exemplo: abra o endereço e entre por uma das contas mostradas no login.

Sem dados de exemplo:

1. Abra o endereço que a Vercel mostra (ex.: `https://ctpwork.vercel.app`).
2. Entre com o e-mail do administrador e a `ADMIN_SENHA`.
3. Troque a senha em **Minha conta**.
4. Comece por **Cadastros › Municípios › Nova prefeitura (assistente)**.

*(Opcional)* Em **Settings › Environment Variables**, adicione `APP_URL` com esse endereço. É o
link que vai nos e-mails do sistema.

### Trocar a demonstração pelo sistema vazio

Os dados de exemplo só são criados num banco sem usuários. Para começar o uso real: em Storage,
apague o banco Neon e crie outro (passo 2), remova `DADOS_DEMONSTRACAO`, defina `ADMIN_SENHA` e
faça o Redeploy.

## Limites desta configuração

- **Anexos de até 4 MB.** A Vercel aceita no máximo 4,5 MB por envio. Em servidor próprio o
  limite é 20 MB. O sistema avisa antes de enviar um arquivo maior.
- **E-mails não saem** enquanto não houver SMTP configurado (`SMTP_HOST`, `SMTP_PORT`,
  `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`; ver README). Sem e-mail, "Esqueci minha senha" não
  funciona: o gestor redefine a senha em Cadastros › Usuários. Os avisos continuam aparecendo no
  sino dentro do sistema.
- **Mudanças no banco** (novos campos no `prisma/schema.prisma`) entram sozinhas na próxima
  publicação. Se uma mudança apagaria dados (ex.: remover uma coluna com conteúdo), a publicação
  **falha de propósito** em vez de apagar; aí é preciso migrar esses dados à mão antes.
- O plano gratuito (Hobby) da Vercel é para uso não comercial. Para uso real pelo CTP, use o
  plano Pro ou um servidor próprio.

## Testar contra PostgreSQL no computador

Os testes automáticos podem rodar num PostgreSQL descartável, igual ao da Vercel.
**O banco indicado é apagado.**

```bash
TESTE_POSTGRES_URL="postgresql://usuario:senha@localhost:5432/ctp_teste" npm run test:e2e
```

Depois rode o comando abaixo para o desenvolvimento voltar ao SQLite:

```bash
npx prisma generate
```
