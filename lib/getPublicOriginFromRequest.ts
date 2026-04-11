function isUntrustedForwardedHost(host: string): boolean {
  const h = host.split(":")[0]?.toLowerCase() ?? "";
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "0.0.0.0" ||
    h === "[::1]"
  );
}

/**
 * `request.url` on serverless / reverse proxies often points at an internal host
 * (e.g. localhost). Redirects must use the browser-facing origin instead.
 *
 * Ignores `x-forwarded-host` when it is loopback (common nginx misconfig toward Node).
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

  if (forwardedHost && !isUntrustedForwardedHost(forwardedHost)) {
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

  const canonical =
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

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
