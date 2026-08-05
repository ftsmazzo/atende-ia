export type ContatoCrm = {
  telefone: string;
  nome_cliente?: string | null;
  perfil_cliente?: string | null;
  preferencia_local?: string | null;
  compra_comalguem?: string | null;
  tipo_renda?: string | null;
  renda_bruta?: number | null;
};

export type HistoriaMsg = {
  role: "human" | "ai" | "other";
  text: string;
};

export function isBadName(value?: string | null) {
  if (!value) return true;
  const s = value.trim();
  if (!s || s === "-" || s === "—") return true;
  if (s.length < 2) return true;
  if (/^[A-Z]{2}\d{4}$/i.test(s)) return true;
  if (/^\d+$/.test(s)) return true;
  if (/^(bom|boa|oi|ola|olá|tudo|sim|nao|não|ok|cliente)$/i.test(s)) return true;
  return false;
}

export function parseMemoryMessage(raw: unknown): HistoriaMsg | null {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return { role: "other", text: value };
    }
  }
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const type = String(row.type || row._type || "").toLowerCase();
  const data = (row.data || row.kwargs || row) as Record<string, unknown>;
  const content = data.content ?? row.content ?? "";
  const text =
    typeof content === "string"
      ? content
      : Array.isArray(content)
        ? content
            .map((part) =>
              typeof part === "string"
                ? part
                : String((part as { text?: string }).text || ""),
            )
            .join(" ")
        : "";
  const cleaned = text.trim();
  if (!cleaned) return null;
  const role = type.includes("human") || type === "user"
    ? "human"
    : type.includes("ai") || type.includes("assistant")
      ? "ai"
      : "other";
  return { role, text: cleaned };
}

export function extractCrmFromTexts(telefone: string, texts: string[]): ContatoCrm {
  const blob = texts.join("\n");
  const nomeMatch = blob.match(
    /(?:me chamo|meu nome(?:\s+[ée])?|pode me chamar de|me chama(?:r)? de|sou a |sou o )\s*([A-ZÁÉÍÓÚÂÊÔÃÕÀ][\p{L}'’-]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÀ][\p{L}'’-]+){0,3})/iu,
  );
  const locais = [
    ...blob.matchAll(
      /\b((?:jardim|vila|parque|residencial|conjunto)\s+[\p{L}]+|ribeir[aã]o preto|sert[aã]ozinho|serrana|cravinhos|bonfim paulista|centro)\b/giu,
    ),
  ].map((m) => m[1]);
  const perfilHints: Array<[RegExp, string]> = [
    [/casal|namorad|esposa|marido|companheir/i, "casal"],
    [/fam[ií]lia|filho|filha|crian[cç]a/i, "família"],
    [/invest/i, "investimento"],
    [/primeiro im[oó]vel|mora de aluguel/i, "primeiro imóvel"],
    [/financi/i, "financiamento"],
    [/alug/i, "interesse em aluguel"],
  ];
  const perfis = perfilHints.filter(([re]) => re.test(blob)).map(([, label]) => label);
  const rendaMatch = blob.match(/renda[^0-9]{0,12}(\d[\d\.]{2,})/i);
  const comAlguem = /com (minha|meu|a |o )?(esposa|esposo|marido|namorad[ao]|fam[ií]lia|filho|s[oó]cio)/i.test(
    blob,
  )
    ? "sim"
    : /sozinh/i.test(blob)
      ? "não"
      : null;
  const tipoRenda = /clt|carteira assinada/i.test(blob)
    ? "CLT"
    : /aut[oô]nomo|pj|empresa/i.test(blob)
      ? "autônomo/PJ"
      : null;

  return {
    telefone,
    nome_cliente: nomeMatch?.[1]?.trim() || null,
    perfil_cliente: perfis.length ? [...new Set(perfis)].join(", ") : null,
    preferencia_local: locais.length ? [...new Set(locais.map((x) => x.trim()))].join(", ") : null,
    compra_comalguem: comAlguem,
    tipo_renda: tipoRenda,
    renda_bruta: rendaMatch ? Number(rendaMatch[1].replace(/\./g, "")) : null,
  };
}

export function mergeCrm(current: ContatoCrm | null | undefined, extracted: ContatoCrm): ContatoCrm {
  const pickName = (cur?: string | null, next?: string | null) => {
    if (!isBadName(next) && isBadName(cur)) return next ?? null;
    if (!isBadName(next) && !isBadName(cur) && String(next).length > String(cur).length + 2) {
      return next ?? null;
    }
    return cur || next || null;
  };
  const pickText = (cur?: string | null, next?: string | null) => {
    if (isBadName(cur) && !isBadName(next)) return next ?? null;
    return cur || next || null;
  };
  return {
    telefone: extracted.telefone,
    nome_cliente: pickName(current?.nome_cliente, extracted.nome_cliente),
    perfil_cliente: pickText(current?.perfil_cliente, extracted.perfil_cliente),
    preferencia_local: pickText(current?.preferencia_local, extracted.preferencia_local),
    compra_comalguem: pickText(current?.compra_comalguem, extracted.compra_comalguem),
    tipo_renda: pickText(current?.tipo_renda, extracted.tipo_renda),
    renda_bruta: current?.renda_bruta ?? extracted.renda_bruta ?? null,
  };
}
