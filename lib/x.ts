import { TwitterApi } from "twitter-api-v2";

function envAny(keys: string[]) {
  for (const k of keys) {
    const v = process.env[k];
    if (v && v.trim()) return v.trim();
  }
  return "";
}

export function getXClient() {
  const appKey = envAny(["X_CONSUMER_KEY", "CONSUMER_KEY"]);
  const appSecret = envAny(["X_CONSUMER_KEY_SECRET", "CONSUMER_KEY_SECRET"]);
  const accessToken = envAny(["X_ACCESS_TOKEN", "ACCESS_TOKEN"]);
  const accessSecret = envAny(["X_ACCESS_TOKEN_SECRET", "ACCESS_TOKEN_SECRET"]);

  const missing: string[] = [];
  if (!appKey) missing.push("CONSUMER_KEY (or X_CONSUMER_KEY)");
  if (!appSecret) missing.push("CONSUMER_KEY_SECRET (or X_CONSUMER_KEY_SECRET)");
  if (!accessToken) missing.push("ACCESS_TOKEN (or X_ACCESS_TOKEN)");
  if (!accessSecret) missing.push("ACCESS_TOKEN_SECRET (or X_ACCESS_TOKEN_SECRET)");

  if (missing.length) {
    throw new Error(`Missing X/Twitter env vars: ${missing.join(", ")}`);
  }

  return new TwitterApi({
    appKey,
    appSecret,
    accessToken,
    accessSecret,
  });
}

