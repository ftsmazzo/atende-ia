import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { assertConversaAccess } from "@/lib/access";
import { isResponse, requireUser } from "@/lib/api";
import { sendWhatsAppReaction } from "@/lib/evolution";
import { tables } from "@/lib/schema";

type Params = { params: Promise<{ telefone: string }> };

export async function POST(request: Request, { params }: Params) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const { telefone } = await params;
  const allowed = await assertConversaAccess(user, telefone);
  if (allowed !== true) return allowed;

  const body = (await request.json()) as { messageId?: string; reaction?: string; fromMe?: boolean };
  const messageId = body.messageId?.trim();
  const reaction = body.reaction ?? "";
  if (!messageId) {
    return NextResponse.json({ error: "Mensagem sem id do WhatsApp" }, { status: 400 });
  }

  await sendWhatsAppReaction(telefone, messageId, reaction, Boolean(body.fromMe));
  await query(
    `UPDATE ${tables.messages}
     SET reacao = $2
     WHERE telefone = $1 AND id_mensagem_wa = $3`,
    [telefone, reaction || null, messageId],
  ).catch(() => undefined);

  return NextResponse.json({ ok: true });
}
