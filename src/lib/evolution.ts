function config() {
  const base = process.env.EVOLUTION_URL?.replace(/\/$/, "");
  const key = process.env.EVOLUTION_API_KEY;
  const instance = process.env.EVOLUTION_INSTANCE;
  if (!base || !key || !instance) {
    throw new Error("Evolution não configurada (EVOLUTION_URL / API_KEY / INSTANCE)");
  }
  return { base, key, instance };
}

async function evolutionFetch(path: string, body: unknown) {
  const { base, key } = config();
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    json = { raw: text };
  }
  if (!response.ok) {
    throw new Error(`Evolution ${response.status}: ${text.slice(0, 300)}`);
  }
  return json;
}

export async function sendWhatsAppText(telefone: string, texto: string) {
  const { instance } = config();
  const number = telefone.replace(/\D/g, "");
  const json = await evolutionFetch(`/message/sendText/${instance}`, {
    number,
    text: texto,
  });
  const key = (json.key ?? (json.data as Record<string, unknown> | undefined)?.key) as
    | { id?: string }
    | undefined;
  return { id: key?.id ?? null, raw: json };
}

export async function sendWhatsAppPresence(
  telefone: string,
  presence: "composing" | "recording" | "paused" = "composing",
  delay = 4000,
) {
  const { instance } = config();
  const number = telefone.replace(/\D/g, "");
  return evolutionFetch(`/chat/sendPresence/${instance}`, {
    number,
    delay,
    presence,
  });
}

export async function sendWhatsAppReaction(
  telefone: string,
  messageId: string,
  reaction: string,
  fromMe = false,
) {
  const { instance } = config();
  const number = telefone.replace(/\D/g, "");
  return evolutionFetch(`/message/sendReaction/${instance}`, {
    key: {
      remoteJid: `${number}@s.whatsapp.net`,
      fromMe,
      id: messageId,
    },
    reaction,
  });
}
