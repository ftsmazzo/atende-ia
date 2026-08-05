import { NextResponse } from "next/server";
import { isResponse, requireUser } from "@/lib/api";
import { sendWhatsAppPresence } from "@/lib/evolution";

type Params = { params: Promise<{ telefone: string }> };

export async function POST(_request: Request, { params }: Params) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const { telefone } = await params;
  try {
    await sendWhatsAppPresence(telefone, "composing", 4000);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao enviar digitando" },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true });
}
