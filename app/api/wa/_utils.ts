export function getWaBaseUrl() {
  const raw = process.env.WA_BAILEYS_URL || "http://localhost:3001";
  return raw.replace(/\/+$/, "");
}

export async function waFetch(path: string, init?: RequestInit) {
  const base = getWaBaseUrl();
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, init);
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { res, json };
}

