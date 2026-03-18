import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";

export interface GoogleClientCredentials {
  client_id: string;
  client_secret: string;
  auth_uri: string;
  token_uri: string;
}

let cachedCredentials: GoogleClientCredentials | null = null;

const CANDIDATE_SECRET_DIRECTORIES = [process.cwd()];

function getCredentialsFromEnv(): GoogleClientCredentials | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    return null;
  }

  return {
    client_id: clientId,
    client_secret: clientSecret,
    auth_uri: process.env.GOOGLE_AUTH_URI?.trim() || "https://accounts.google.com/o/oauth2/auth",
    token_uri: process.env.GOOGLE_TOKEN_URI?.trim() || "https://oauth2.googleapis.com/token",
  };
}

function getCredentialsFromFile(): GoogleClientCredentials | null {
  const explicitPath = process.env.GOOGLE_CLIENT_SECRET_PATH?.trim();
  const candidateFiles = explicitPath ? [explicitPath] : [];

  for (const directory of CANDIDATE_SECRET_DIRECTORIES) {
    if (!existsSync(directory)) {
      continue;
    }

    const fileName = readdirSync(directory).find((entry) => entry.startsWith("client_secret_"));
    if (fileName) {
      candidateFiles.push(join(directory, fileName));
    }
  }

  for (const filePath of candidateFiles) {
    if (!existsSync(filePath)) {
      continue;
    }

    const raw = readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as { web?: GoogleClientCredentials };

    if (parsed.web?.client_id && parsed.web?.client_secret) {
      return parsed.web;
    }
  }

  return null;
}

export function getGoogleClientCredentials(): GoogleClientCredentials {
  if (cachedCredentials) {
    return cachedCredentials;
  }

  const credentials = getCredentialsFromEnv() || getCredentialsFromFile();

  if (!credentials) {
    throw new Error(
      "Missing Google OAuth credentials. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or provide a client_secret JSON file."
    );
  }

  cachedCredentials = credentials;
  return credentials;
}

export const YOUTUBE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/userinfo.email",
];
