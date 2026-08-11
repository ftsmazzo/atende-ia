import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { isAdmin } from "@/lib/access";
import { isResponse, requireUser } from "@/lib/api";
import { tables } from "@/lib/schema";

type Params = { params: Promise<{ telefone: string }> };

export async function POST(request: Request, { params }: Params) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (!isAdmin(user)) {
    return NextResponse.json({ error: "Só o administrador pode encaminhar" }, { status: 403 });
  }

  const { telefone } = await params;
  const body = (await request.json()) as { operadorId?: number };
  if (!body.operadorId) {
    return NextResponse.json({ error: "Informe o operador" }, { status: 400 });
  }

  const [operador] = await query<{ id: number }>(
    `SELECT id FROM usuarios_painel WHERE id = $1 AND ativo = TRUE`,
    [body.operadorId],
  );
  if (!operador) {
    return NextResponse.json({ error: "Operador inválido" }, { status: 404 });
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
    [telefone, body.operadorId],
  );

  return NextResponse.json({ ok: true, modo: "humano", operador_id: body.operadorId });
}
