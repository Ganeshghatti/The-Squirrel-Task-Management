/**
 * Behind a reverse proxy (e.g. Nginx on a VPS), `request.url` may not reflect the
 * public origin. OAuth redirects should use the browser-facing host/proto from
 * `x-forwarded-*` or `NEXTAUTH_URL` / `AUTH_URL`.
 */
export function getPublicOriginFromRequest(request: Request): {
  origin: string;
  host: string;
  protocol: "http" | "https";
} {
  const forwardedHost = request.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();
  const forwardedProto = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim()
    .toLowerCase();

  if (forwardedHost) {
    const protocol: "http" | "https" =
      forwardedProto === "http" || forwardedProto === "https"
        ? forwardedProto
        : forwardedHost.includes("localhost") ||
            forwardedHost.startsWith("127.")
          ? "http"
          : "https";
    return {
      host: forwardedHost,
      protocol,
      origin: `${protocol}://${forwardedHost}`,
    };
  }

  const fromRequest = new URL(request.url);
  const internal =
    fromRequest.hostname === "localhost" ||
    fromRequest.hostname === "127.0.0.1" ||
    fromRequest.hostname === "0.0.0.0";

  if (!internal) {
    const protocol = fromRequest.protocol === "https:" ? "https" : "http";
    return {
      host: fromRequest.host,
      protocol,
      origin: fromRequest.origin,
    };
  }

  const canonical = process.env.NEXTAUTH_URL?.trim() || process.env.AUTH_URL?.trim() || "";

  if (canonical) {
    try {
      const u = new URL(canonical);
      const protocol = u.protocol === "https:" ? "https" : "http";
      return { host: u.host, protocol, origin: u.origin };
    } catch {
      /* use fromRequest below */
    }
  }

  const protocol = fromRequest.protocol === "https:" ? "https" : "http";
  return {
    host: fromRequest.host,
    protocol,
    origin: fromRequest.origin,
  };
}
