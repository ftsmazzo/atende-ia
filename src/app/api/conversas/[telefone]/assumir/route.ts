import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { isAdmin } from "@/lib/access";
import { isResponse, requireUser } from "@/lib/api";
import { tables } from "@/lib/schema";

type Params = { params: Promise<{ telefone: string }> };

export async function POST(_request: Request, { params }: Params) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const { telefone } = await params;

  // Corretor não “pega” conversa da fila geral — só recebe por encaminhamento.
  if (!isAdmin(user)) {
    return NextResponse.json(
      { error: "Aguarde o administrador encaminhar a conversa para você" },
      { status: 403 },
    );
  }

  await query(
    `INSERT INTO ${tables.attendances} (telefone, modo, operador_id, assumido_em, devolvido_em, updated_at)
     VALUES ($1, 'humano', $2, NOW(), NULL, NOW())
     ON CONFLICT (telefone) DO UPDATE SET
       modo = 'humano',
       operador_id = EXCLUDED.operador_id,
       assumido_em = NOW(),
       devolvido_em = NULL,
       updated_at = NOW()`,
    [telefone, user.id],
  );

  return NextResponse.json({ ok: true, modo: "humano", operador_id: user.id });
}
