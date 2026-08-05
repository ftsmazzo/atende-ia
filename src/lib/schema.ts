function ident(value: string | undefined, fallback: string) {
  const name = (value || fallback).trim();
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error(`Nome de tabela/coluna inválido: ${name}`);
  }
  return name;
}

export const branding = {
  appName: process.env.NEXT_PUBLIC_APP_NAME || process.env.APP_NAME || "Painel Agente",
  brand: process.env.NEXT_PUBLIC_APP_BRAND || process.env.APP_BRAND || "Atendimento",
  agentName: process.env.NEXT_PUBLIC_AGENT_NAME || process.env.AGENT_NAME || "Agente",
};

export const tables = {
  contacts: ident(process.env.CONTACTS_TABLE, "contatos"),
  actions: ident(process.env.ACTIONS_TABLE, "lead_acoes"),
  attendances: ident(process.env.ATTENDANCES_TABLE, "atendimentos_agente"),
  messages: ident(process.env.MESSAGES_TABLE, "mensagens_agente"),
  users: "usuarios_painel",
  contactPhone: ident(process.env.CONTACT_PHONE_COLUMN, "telefone"),
  contactName: ident(process.env.CONTACT_NAME_COLUMN, "nome"),
  actionPhone: ident(process.env.ACTION_PHONE_COLUMN || process.env.CONTACT_PHONE_COLUMN, "telefone"),
};
