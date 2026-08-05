import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { isResponse, requireUser } from "@/lib/api";
import { sendWhatsAppText } from "@/lib/evolution";
import { tables } from "@/lib/schema";

type Params = { params: Promise<{ telefone: string }> };

export async function POST(request: Request, { params }: Params) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const { telefone } = await params;
  const body = (await request.json()) as { texto?: string };
  const texto = body.texto?.trim();
  if (!texto) {
    return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 });
  }

  const [atendimento] = await query<{ modo: string; operador_id: number | null }>(
    `SELECT modo, operador_id FROM ${tables.attendances} WHERE telefone = $1`,
    [telefone],
  );
  if (!atendimento || atendimento.modo !== "humano") {
    return NextResponse.json(
      { error: "Assuma o atendimento antes de responder" },
      { status: 409 },
    );
  }

  await sendWhatsAppText(telefone, texto);
  await query(
    `INSERT INTO ${tables.messages} (telefone, direcao, texto, instancia, operador_id)
     VALUES ($1, 'outbound_humano', $2, $3, $4)`,
    [telefone, texto, process.env.EVOLUTION_INSTANCE ?? null, user.id],
  );

  return NextResponse.json({ ok: true });
}
