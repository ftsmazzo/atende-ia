# Painel Agente

Painel genérico para agentes de WhatsApp (n8n + Evolution):

- dashboard de decisão
- inbox de atendimento
- contas de operadores
- assumir / atribuir / devolver (o agente para e volta)

Um repositório, vários clientes: cada um com o próprio Postgres, Evolution e variáveis de ambiente.

## 1. Postgres do cliente

No database do cliente, rode `sql/001_painel.sql`.

Isso cria só as tabelas do painel:

- `usuarios_painel`
- `atendimentos_agente`
- `mensagens_agente`

As tabelas de CRM (contatos, ações, etc.) continuam as do cliente. Você só aponta os nomes no `.env`.

Login inicial:

- e-mail: `admin@local`
- senha: `Pazotti@2026` (troque no primeiro acesso)

## 2. Gate no n8n do agente

Depois do nó que extrai telefone/mensagem:

1. Consultar `atendimentos_agente.modo`
2. Gravar inbound em `mensagens_agente`
3. Se `modo = humano`, **parar** (não chamar o agente)

## 3. Deploy (EasyPanel)

App na porta `3000`:

```env
DATABASE_URL=postgres://usuario:senha@host:5432/cliente
AUTH_SECRET=chave-longa

APP_NAME=Painel Agente
APP_BRAND=Nome do Cliente
AGENT_NAME=SofIA

CONTACTS_TABLE=contatos_pazotti
CONTACT_PHONE_COLUMN=telefone_cliente
CONTACT_NAME_COLUMN=nome_cliente
ACTIONS_TABLE=lead_acoes_pazotti
ACTION_PHONE_COLUMN=telefone_cliente

EVOLUTION_URL=https://evo.cliente.com
EVOLUTION_API_KEY=
EVOLUTION_INSTANCE=instancia
```

Para outro cliente, clone o mesmo app com outro database e outro `.env`.

## 4. Local

```bash
cp .env.example .env.local
npm install
npm run dev
```

## 5. Produção / cutover (Pazotti)

Ver **`CUTOVER-PRODUCAO.md`**: dump do Postgres antigo no dia D, restore no EasyPanel, SQL do painel, Evolution e webhook SofIA.
