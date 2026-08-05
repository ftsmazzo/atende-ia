import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { isResponse, requireUser } from "@/lib/api";
import { tables } from "@/lib/schema";

type Params = { params: Promise<{ telefone: string }> };

export async function POST(_request: Request, { params }: Params) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const { telefone } = await params;

  await query(
    `INSERT INTO ${tables.attendances} (telefone, modo, operador_id, devolvido_em, updated_at)
     VALUES ($1, 'ia', NULL, NOW(), NOW())
     ON CONFLICT (telefone) DO UPDATE SET
       modo = 'ia',
       operador_id = NULL,
       devolvido_em = NOW(),
       updated_at = NOW()`,
    [telefone],
  );

  return NextResponse.json({ ok: true, modo: "ia" });
}
