import { INSTAGRAM_GRAPH_VERSION } from "@/lib/instagramAuth";

/** Instagram API with Instagram Login — media + user calls use graph.instagram.com */
const GRAPH = `https://graph.instagram.com/${INSTAGRAM_GRAPH_VERSION}`;

type GraphErrorBody = { error?: { message?: string; code?: number } };

function graphErrorMessage(body: GraphErrorBody, fallback: string) {
  return body.error?.message || fallback;
}

async function readGraphJson<T extends Record<string, unknown>>(res: Response): Promise<T> {
  const data = (await res.json()) as T;
  const err = data as GraphErrorBody;
  if (err.error || !res.ok) {
    throw new Error(graphErrorMessage(err, `Graph API error (${res.status})`));
  }
  return data;
}

/** Step 2: Exchange authorization code for short-lived Instagram user token. */
export async function exchangeInstagramAuthCode(
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  code: string
): Promise<{ access_token: string; user_id: string }> {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    code,
  });

  const res = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const data = (await res.json()) as {
    access_token?: string;
    user_id?: number | string;
    error_message?: string;
    error_type?: string;
    error?: { message?: string };
  };

  if (!res.ok || !data.access_token) {
    throw new Error(
      data.error_message ||
        data.error?.message ||
        `Instagram token exchange failed (${res.status})`
    );
  }

  const userId = data.user_id != null ? String(data.user_id) : "";
  if (!userId) {
    throw new Error("Instagram token response missing user_id");
  }

  return { access_token: data.access_token, user_id: userId };
}

/** Step 3: Short-lived → long-lived Instagram user token. */
export async function exchangeInstagramLongLivedToken(
  clientSecret: string,
  shortLivedAccessToken: string
): Promise<{ access_token: string; expires_in?: number }> {
  const url = new URL("https://graph.instagram.com/access_token");
  url.searchParams.set("grant_type", "ig_exchange_token");
  url.searchParams.set("client_secret", clientSecret);
  url.searchParams.set("access_token", shortLivedAccessToken);

  const res = await fetch(url.toString());
  const raw = (await res.json()) as Record<string, unknown>;
  if (!res.ok || raw.error) {
    const msg =
      (raw.error as { message?: string })?.message ||
      String((raw as { error_message?: string }).error_message || "Long-lived token exchange failed");
    throw new Error(msg);
  }
  const access_token = raw.access_token as string | undefined;
  if (!access_token) {
    throw new Error("Long-lived token response missing access_token");
  }
  return {
    access_token,
    expires_in: raw.expires_in as number | undefined,
  };
}

export async function fetchInstagramMe(accessToken: string): Promise<{
  id?: string;
  username?: string;
  profile_picture_url?: string;
}> {
  const url = new URL(`${GRAPH}/me`);
  url.searchParams.set("fields", "id,username,profile_picture_url");
  url.searchParams.set("access_token", accessToken);

  const res = await fetch(url.toString());
  return readGraphJson<{
    id?: string;
    username?: string;
    profile_picture_url?: string;
  }>(res);
}

async function pollUntilReelReady(containerId: string, accessToken: string) {
  const maxAttempts = 45;
  const delayMs = 2000;

  for (let i = 0; i < maxAttempts; i++) {
    const url = new URL(`${GRAPH}/${containerId}`);
    url.searchParams.set(
      "fields",
      "id,status_code,status,video_status{uploading_phase,processing_phase}"
    );
    url.searchParams.set("access_token", accessToken);

    const res = await fetch(url.toString());
    const data = await readGraphJson<{
      status_code?: string;
      status?: string;
      video_status?: {
        uploading_phase?: { status?: string };
        processing_phase?: { status?: string };
      };
    }>(res);

    const statusCode = data.status_code;
    if (statusCode === "ERROR" || statusCode === "EXPIRED") {
      throw new Error(data.status || "Instagram container processing failed");
    }

    const uploadStatus = data.video_status?.uploading_phase?.status;
    const processStatus = data.video_status?.processing_phase?.status;
    const ready =
      statusCode === "FINISHED" ||
      statusCode === "PUBLISHED" ||
      (uploadStatus === "complete" && processStatus === "complete");

    if (ready) {
      return;
    }

    await new Promise((r) => setTimeout(r, delayMs));
  }

  throw new Error("Timed out waiting for Instagram video processing");
}

export async function publishReelFromVideoBuffer(params: {
  igUserId: string;
  pageAccessToken: string;
  video: Buffer;
  caption?: string;
}) {
  const { igUserId, pageAccessToken, video, caption } = params;

  const createUrl = new URL(`${GRAPH}/${igUserId}/media`);
  createUrl.searchParams.set("access_token", pageAccessToken);

  const createBody: Record<string, string> = {
    media_type: "REELS",
    upload_type: "resumable",
  };
  if (caption?.trim()) {
    createBody.caption = caption.trim();
  }

  const createRes = await fetch(createUrl.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(createBody),
  });

  const created = await readGraphJson<{ id: string; uri?: string }>(createRes);
  const containerId = created.id;
  const uploadUri = created.uri;
  if (!uploadUri) {
    throw new Error("Instagram did not return an upload URL for this reel");
  }

  const uploadRes = await fetch(uploadUri, {
    method: "POST",
    headers: {
      Authorization: `OAuth ${pageAccessToken}`,
      offset: "0",
      file_size: String(video.length),
    },
    body: new Uint8Array(video),
  });

  const uploadJson = (await uploadRes.json()) as {
    success?: boolean;
    message?: string;
    debug_info?: { message?: string };
  };
  if (!uploadRes.ok || uploadJson.success === false) {
    throw new Error(
      uploadJson.debug_info?.message || uploadJson.message || "Video upload to Instagram failed"
    );
  }

  await pollUntilReelReady(containerId, pageAccessToken);

  const publishUrl = new URL(`${GRAPH}/${igUserId}/media_publish`);
  publishUrl.searchParams.set("access_token", pageAccessToken);
  publishUrl.searchParams.set("creation_id", containerId);

  const publishRes = await fetch(publishUrl.toString(), { method: "POST" });
  const published = await readGraphJson<{ id: string }>(publishRes);

  return { mediaId: published.id, containerId };
}

export async function publishFeedImage(params: {
  igUserId: string;
  pageAccessToken: string;
  imageUrl: string;
  caption?: string;
}) {
  const { igUserId, pageAccessToken, imageUrl, caption } = params;

  const mediaUrl = new URL(`${GRAPH}/${igUserId}/media`);
  mediaUrl.searchParams.set("access_token", pageAccessToken);
  mediaUrl.searchParams.set("image_url", imageUrl);
  if (caption?.trim()) {
    mediaUrl.searchParams.set("caption", caption.trim());
  }

  const mediaRes = await fetch(mediaUrl.toString(), { method: "POST" });
  const media = await readGraphJson<{ id: string }>(mediaRes);
  const creationId = media.id;

  const publishUrl = new URL(`${GRAPH}/${igUserId}/media_publish`);
  publishUrl.searchParams.set("access_token", pageAccessToken);
  publishUrl.searchParams.set("creation_id", creationId);

  const publishRes = await fetch(publishUrl.toString(), { method: "POST" });
  const published = await readGraphJson<{ id: string }>(publishRes);

  return { mediaId: published.id, containerId: creationId };
}

export async function fetchMediaPermalink(
  mediaId: string,
  accessToken: string
): Promise<string | undefined> {
  const url = new URL(`${GRAPH}/${mediaId}`);
  url.searchParams.set("fields", "permalink");
  url.searchParams.set("access_token", accessToken);

  const res = await fetch(url.toString());
  try {
    const data = await readGraphJson<{ permalink?: string }>(res);
    return data.permalink;
  } catch {
    return undefined;
  }
}
