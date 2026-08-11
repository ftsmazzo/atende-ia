# Cutover produção — SofIA / Painel Pazotti

Ordem recomendada no dia do desligar das VPS antigas.

## O que já está no EasyPanel

| Serviço | Host interno | Papel |
|---------|--------------|--------|
| `db` | `pazotti_db` | Postgres (SofIA + painel) |
| `redis` | `pazotti_redis` | Evolution |
| `n8n` | `pazotti_n8n` | Workflows |
| `evolution` | `pazotti_evolution` | WhatsApp |

Painel: app novo neste repo (`Dockerfile`, porta `3000`).

## Bancos / dados

No EasyPanel o DB de app é **`pazotti`**.

Já deve ter (dump anterior):

- `pazotti_fila`, `pazotti_historico`
- `contatos_pazotti`, `lead_acoes_pazotti`
- (opcional) `rag_pazotti`

Ainda precisa rodar **uma vez** (painel):

```bash
# no psql do DB pazotti
\i sql/001_painel.sql
\i sql/002_mensagens_reacao.sql
```

Isso cria `usuarios_painel`, `atendimentos_agente`, `mensagens_agente`.

Login do painel: `rodrigovazpazotti@gmail.com` / `p@zotti2026!`.

---

## A) Antes do cutover (pode fazer hoje, sem desligar Zap)

1. Confirmar SofIA no EasyPanel respondendo (número de teste).
2. Rodar SQL do painel no DB `pazotti`.
3. Subir app **painel** no projeto EasyPanel `pazotti` (imagem deste repo).
4. Env do painel (exemplo):

```env
DATABASE_URL=postgres://postgres:SENHA@pazotti_db:5432/pazotti
AUTH_SECRET=CHAVE_LONGA
APP_NAME=Painel Pazotti
APP_BRAND=Pazotti Imóveis
AGENT_NAME=SofIA
CONTACTS_TABLE=contatos_pazotti
CONTACT_PHONE_COLUMN=telefone_cliente
CONTACT_NAME_COLUMN=nome_cliente
ACTIONS_TABLE=lead_acoes_pazotti
ACTION_PHONE_COLUMN=telefone_cliente
EVOLUTION_URL=https://pazotti-evolution.kxryyk.easypanel.host
EVOLUTION_API_KEY=sua_api_key
EVOLUTION_INSTANCE=nome-da-instancia-producao
```

5. Publicar/ativar **IA Pazotti** com gate (já no fluxo):
   - consulta `atendimentos_agente.modo`
   - grava inbound/outbound em `mensagens_agente`
   - se `modo=humano` → **não** chama SofIA

6. Testar no painel: Assumir → mensagem não gera resposta IA → Devolver → IA volta.

---

## B) Dump “do dia” (quando for desligar a VPS antiga)

Objetivo: levar o estado **mais recente** do Postgres antigo para o EasyPanel (contatos, histórico, fila).

### 1. Na VPS / Postgres antigo (pgAdmin ou shell)

Backup **custom** do database `pazotti` (o de dados da SofIA, não o `n8n`):

```bash
pg_dump -Fc -d pazotti -f pazotti-cutover-$(date +%Y%m%d-%H%M).dump
```

Se o Vector for outro DB e `rag_pazotti` for usado:

```bash
pg_dump -Fc -d NOME_DB_VECTOR -t rag_pazotti -f rag-pazotti-cutover.dump
```

### 2. Janela curta (15–30 min)

1. Avisar cliente (pausa no Zap).
2. **Desconectar** o número operacional na Evolution **antiga**.
3. Freeze: não mexer mais no Postgres antigo (ou fazer o dump **depois** de desconectar e **antes** de apontar o número novo — ideal: dump imediatamente após desconectar).
4. Restore no EasyPanel (`pazotti_db` / DB `pazotti`):

```bash
# Cuidado: --clean apaga objetos com mesmo nome.
# Preferência se o EasyPanel JÁ tem dados de teste:
# restore só das tabelas de CRM/histórico, sem dropar tabelas do painel.

pg_restore -d pazotti --no-owner --no-acl --data-only \
  -t contatos_pazotti \
  -t lead_acoes_pazotti \
  -t pazotti_historico \
  -t pazotti_fila \
  pazotti-cutover-XXXX.dump
```

Se o EasyPanel ainda for “vazio” de CRM (só schema/painel):

```bash
pg_restore -d pazotti --no-owner --no-acl pazotti-cutover-XXXX.dump
```

Depois (se preciso):

```bash
\i sql/001_painel.sql
\i sql/002_mensagens_reacao.sql
```

`001` usa `IF NOT EXISTS` / `ON CONFLICT` — não apaga admin existente.

5. Conectar o **mesmo número** na Evolution **nova** (`pazotti_evolution`).
6. Webhook da instância → URL de produção do n8n novo:

```text
https://pazotti-n8n.kxryyk.easypanel.host/webhook/0aa44bf2-a5a9-404c-bda4-815ef1168e88/sofia
```

7. Smoke test: 3–5 conversas reais + Assumir/Devolver no painel.
8. Só então desligar Portainer das VPS. Manter dump 7–14 dias.

---

## C) O que NÃO restaurar por cima

| Objeto | Motivo |
|--------|--------|
| DB `n8n` | workflows já no n8n EasyPanel |
| DB `evolution` | sessão WhatsApp nasce na Evo nova |
| `usuarios_painel` com dump antigo | em geral não existe no antigo; não sobrescrever |
| `mensagens_agente` | começa no EasyPanel; histórico antigo vem de `pazotti_historico` se quiser importar depois |

---

## D) Checklist rápido do dia D

- [ ] Dump fresco `pazotti` (+ `rag_pazotti` se usar)
- [ ] SQL painel aplicado no EasyPanel
- [ ] Painel no ar + login admin
- [ ] `EVOLUTION_*` apontando para Evo nova / instância correta
- [ ] Desconectar número na Evo antiga
- [ ] Restore data-only CRM/histórico
- [ ] Conectar número na Evo nova + webhook n8n
- [ ] Teste Zap + Assumir/Devolver
- [ ] Monitorar executions n8n 1–2h
- [ ] Desligar VPS depois de 24–72h estável
