export async function sendWhatsAppText(telefone: string, texto: string) {
  const base = process.env.EVOLUTION_URL?.replace(/\/$/, "");
  const key = process.env.EVOLUTION_API_KEY;
  const instance = process.env.EVOLUTION_INSTANCE;
  if (!base || !key || !instance) {
    throw new Error("Evolution não configurada (EVOLUTION_URL / API_KEY / INSTANCE)");
  }

  const number = telefone.replace(/\D/g, "");
  const response = await fetch(`${base}/message/sendText/${instance}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
    },
    body: JSON.stringify({
      number,
      text: texto,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Evolution ${response.status}: ${body.slice(0, 300)}`);
  }

  return response.json().catch(() => ({}));
}
