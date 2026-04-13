import axios from "axios";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import connectDB from "@/lib/mongodb";
import LinkedInAccount from "@/models/LinkedInAccount";
import LinkedInUploadHistory from "@/models/LinkedInUploadHistory";

// LinkedIn Marketing (versioned) APIs require this header on `/rest/*` calls.
// See: https://learn.microsoft.com/en-us/linkedin/marketing/versioning?view=li-lms-2026-03
const LINKEDIN_MARKETING_VERSION = "202603";

function linkedinMarketingHeaders(params: {
  accessToken: string;
  contentType?: string;
}) {
  return {
    Authorization: `Bearer ${params.accessToken}`,
    "X-Restli-Protocol-Version": "2.0.0",
    "Linkedin-Version": LINKEDIN_MARKETING_VERSION,
    ...(params.contentType ? { "Content-Type": params.contentType } : {}),
  };
}

function readRestliId(response: { headers: Record<string, string | undefined> }) {
  return (
    response.headers["x-restli-id"] ||
    response.headers["X-RestLi-Id"] ||
    response.headers["x-restLi-id"]
  );
}

function debugPrefix(requestId: string) {
  return `[linkedin.post][${requestId}]`;
}

function safeAxiosError(err: unknown) {
  const anyErr = err as any;
  const status = anyErr?.response?.status as number | undefined;
  const data = anyErr?.response?.data;
  const headers = anyErr?.response?.headers as Record<string, string> | undefined;

  return {
    message: err instanceof Error ? err.message : "Unknown error",
    status,
    data,
    headers: headers
      ? {
          "x-restli-id": headers["x-restli-id"],
          "x-li-uuid": headers["x-li-uuid"],
        }
      : undefined,
  };
}

function getVisibility() {
  return { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" as const };
}

async function registerUpload(params: {
  accessToken: string;
  personId: string;
  recipe:
    | "urn:li:digitalmediaRecipe:feedshare-image"
    | "urn:li:digitalmediaRecipe:feedshare-video";
}) {
  const registerRes = await axios.post(
    "https://api.linkedin.com/v2/assets?action=registerUpload",
    {
      registerUploadRequest: {
        recipes: [params.recipe],
        owner: `urn:li:person:${params.personId}`,
        serviceRelationships: [
          {
            relationshipType: "OWNER",
            identifier: "urn:li:userGeneratedContent",
          },
        ],
      },
    },
    {
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      maxBodyLength: Infinity,
    }
  );

  const uploadUrl =
    registerRes.data.value.uploadMechanism[
      "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
    ].uploadUrl as string;

  const asset = registerRes.data.value.asset as string;

  return { uploadUrl, asset };
}

async function publishUgcPost(params: {
  accessToken: string;
  personId: string;
  text: string;
  mediaCategory: "NONE" | "IMAGE" | "VIDEO";
  asset?: string;
}) {
  const body =
    params.mediaCategory === "NONE"
      ? {
          author: `urn:li:person:${params.personId}`,
          lifecycleState: "PUBLISHED",
          specificContent: {
            "com.linkedin.ugc.ShareContent": {
              shareCommentary: { text: params.text },
              shareMediaCategory: "NONE",
            },
          },
          visibility: getVisibility(),
        }
      : {
          author: `urn:li:person:${params.personId}`,
          lifecycleState: "PUBLISHED",
          specificContent: {
            "com.linkedin.ugc.ShareContent": {
              shareCommentary: { text: params.text },
              shareMediaCategory: params.mediaCategory,
              media: [{ status: "READY", media: params.asset }],
            },
          },
          visibility: getVisibility(),
        };

  const postRes = await axios.post("https://api.linkedin.com/v2/ugcPosts", body, {
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    maxBodyLength: Infinity,
  });

  const idFromBody = (postRes.data as { id?: string } | undefined)?.id;
  const idFromHeader = readRestliId(postRes as any);
  const id = idFromBody || idFromHeader;
  if (!id) {
    throw new Error("LinkedIn did not return a post id for ugcPosts");
  }
  return id;
}

async function initializeDocumentUpload(params: { accessToken: string; personId: string }) {
  const res = await axios.post(
    "https://api.linkedin.com/rest/documents?action=initializeUpload",
    {
      initializeUploadRequest: {
        owner: `urn:li:person:${params.personId}`,
      },
    },
    {
      headers: linkedinMarketingHeaders({
        accessToken: params.accessToken,
        contentType: "application/json",
      }),
      maxBodyLength: Infinity,
    }
  );

  const value = res.data?.value as
    | { uploadUrl?: string; document?: string; uploadUrlExpiresAt?: number }
    | undefined;

  if (!value?.uploadUrl || !value?.document) {
    throw new Error("LinkedIn document initializeUpload response was missing uploadUrl/document");
  }

  return { uploadUrl: value.uploadUrl, documentUrn: value.document };
}

async function waitForDocumentAvailable(params: {
  accessToken: string;
  documentUrn: string;
  timeoutMs: number;
}) {
  const started = Date.now();
  // Documents may briefly sit in PROCESSING after upload; poll until AVAILABLE or timeout.
  // See status field in: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/documents-api?view=li-lms-2026-03
  while (Date.now() - started < params.timeoutMs) {
    const res = await axios.get(`https://api.linkedin.com/rest/documents/${encodeURIComponent(params.documentUrn)}`, {
      headers: linkedinMarketingHeaders({ accessToken: params.accessToken }),
      validateStatus: () => true,
    });

    const status = (res.data as { status?: string } | undefined)?.status;
    if (status === "AVAILABLE") return;
    if (status === "PROCESSING_FAILED") {
      throw new Error("LinkedIn document processing failed after upload");
    }

    await new Promise((r) => setTimeout(r, 1500));
  }
}

async function publishDocumentPost(params: {
  accessToken: string;
  personId: string;
  commentary: string;
  documentUrn: string;
  title: string;
}) {
  const body = {
    author: `urn:li:person:${params.personId}`,
    commentary: params.commentary,
    visibility: "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    content: {
      media: {
        title: params.title,
        id: params.documentUrn,
      },
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };

  const postRes = await axios.post("https://api.linkedin.com/rest/posts", body, {
    headers: linkedinMarketingHeaders({
      accessToken: params.accessToken,
      contentType: "application/json",
    }),
    maxBodyLength: Infinity,
    validateStatus: () => true,
  });

  if (postRes.status !== 201) {
    throw new Error(
      typeof postRes.data === "string"
        ? postRes.data
        : JSON.stringify(postRes.data || { status: postRes.status })
    );
  }

  const idFromHeader = readRestliId(postRes as any);
  const idFromBody = (postRes.data as { id?: string } | undefined)?.id;
  const id = idFromHeader || idFromBody;
  if (!id) {
    throw new Error("LinkedIn did not return a post id for rest/posts (document)");
  }
  return id;
}

export async function POST(request: Request) {
  const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const log = (...args: any[]) => console.log(debugPrefix(requestId), ...args);
  const errorLog = (...args: any[]) => console.error(debugPrefix(requestId), ...args);

  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string; role?: string; linkedinAccess?: boolean } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role;
  const linkedinAccess = (session?.user as { linkedinAccess?: boolean } | undefined)?.linkedinAccess;

  if (!userId) {
    errorLog("Unauthorized (no userId)");
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (role !== "admin" && !linkedinAccess) {
    errorLog("Forbidden", { role, linkedinAccess });
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const text = formData.get("text")?.toString() || "";
    const files = formData.getAll("files").filter((item) => item instanceof Blob) as Blob[];

    log("Incoming request", {
      userId,
      textLength: text.length,
      filesCount: files.length,
      fileTypes: files.map((f) => (f as any)?.type || "unknown"),
      fileSizes: files.map((f) => (typeof (f as any)?.size === "number" ? (f as any).size : undefined)),
    });

    if (!text.trim()) {
      errorLog("Validation failed: missing text");
      return Response.json({ error: "Text is required" }, { status: 400 });
    }

    await connectDB();
    const account = await LinkedInAccount.findOne().sort({ updatedAt: -1 }).lean();

    if (!account?.accessToken || !account.personId) {
      errorLog("LinkedIn not connected", { hasToken: Boolean(account?.accessToken), hasPersonId: Boolean(account?.personId) });
      return Response.json({ error: "LinkedIn is not connected" }, { status: 400 });
    }

    const accessToken = account.accessToken;
    const personId = account.personId;
    log("LinkedIn account loaded", { personId });

    // Text-only post
    if (files.length === 0) {
      log("Publishing text-only post via ugcPosts");
      const postId = await publishUgcPost({
        accessToken,
        personId,
        text,
        mediaCategory: "NONE",
      });
      log("Published text-only", { postId });

      await LinkedInUploadHistory.create({
        userId,
        postId,
        postType: "text",
        text,
        visibility: "PUBLIC",
      });

      return Response.json({ postId });
    }

    if (files.length > 1) {
      errorLog("Validation failed: too many attachments", { filesCount: files.length });
      return Response.json(
        {
          error:
            "Only one attachment is supported. Please attach a single PDF, image, or video.",
        },
        { status: 400 }
      );
    }

    const file = files[0];
    const contentType = file?.type || "application/octet-stream";
    log("Single attachment detected", { contentType });

    // PDF -> Documents API + Posts API (Marketing versioned APIs)
    // https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/documents-api?view=li-lms-2026-03
    // https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api?view=li-lms-2026-03
    if (contentType === "application/pdf") {
      const maxBytes = 100 * 1024 * 1024;
      const bytes = Buffer.from(await file.arrayBuffer());
      if (bytes.length > maxBytes) {
        errorLog("PDF too large", { bytes: bytes.length, maxBytes });
        return Response.json({ error: "PDF exceeds LinkedIn's 100MB limit for Documents API uploads." }, { status: 400 });
      }

      log("Initializing document upload (rest/documents?action=initializeUpload)");
      const { uploadUrl, documentUrn } = await initializeDocumentUpload({ accessToken, personId });
      log("Initialized document upload", { documentUrn, uploadUrlHost: new URL(uploadUrl).host });

      log("Uploading PDF bytes to uploadUrl", { bytes: bytes.length });
      const uploadRes = await axios.put(uploadUrl, bytes, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          // The docs' curl example omits Content-Type, but in practice explicitly
          // setting it helps avoid HTML error pages from the upload edge.
          "Content-Type": "application/pdf",
          "Content-Length": String(bytes.length),
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        validateStatus: () => true,
      });
      log("UploadUrl response", {
        status: uploadRes.status,
        contentType: (uploadRes.headers as any)?.["content-type"],
        xLiUuid: (uploadRes.headers as any)?.["x-li-uuid"],
      });
      if (uploadRes.status !== 201 && uploadRes.status !== 200 && uploadRes.status !== 204) {
        throw new Error(
          `LinkedIn uploadUrl rejected PDF upload (status ${uploadRes.status})`
        );
      }
      log("Uploaded PDF, waiting for AVAILABLE", { documentUrn });

      await waitForDocumentAvailable({ accessToken, documentUrn, timeoutMs: 120_000 });
      log("Document AVAILABLE", { documentUrn });

      const title =
        file instanceof File && file.name?.trim()
          ? file.name.trim()
          : "document.pdf";

      log("Publishing document post via rest/posts", { title, documentUrn });
      const postId = await publishDocumentPost({
        accessToken,
        personId,
        commentary: text,
        documentUrn,
        title,
      });
      log("Published document post", { postId, documentUrn });

      await LinkedInUploadHistory.create({
        userId,
        postId,
        postType: "document",
        text,
        asset: documentUrn,
        visibility: "PUBLIC",
      });

      return Response.json({ postId });
    }

    // Single image/video -> ugcPosts image/video upload
    if (files.length === 1) {
      const isVideo = contentType.startsWith("video/");
      log("Registering upload via v2/assets?action=registerUpload", { isVideo, contentType });
      const { uploadUrl, asset } = await registerUpload({
        accessToken,
        personId,
        recipe: isVideo
          ? "urn:li:digitalmediaRecipe:feedshare-video"
          : "urn:li:digitalmediaRecipe:feedshare-image",
      });
      log("Registered upload", { asset, uploadUrlHost: new URL(uploadUrl).host });

      const bytes = Buffer.from(await file.arrayBuffer());
      log("Uploading media bytes to uploadUrl", { bytes: bytes.length });
      await axios.put(uploadUrl, bytes, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": contentType,
          "X-Restli-Protocol-Version": "2.0.0",
        },
        maxBodyLength: Infinity,
      });
      log("Uploaded media bytes", { asset });

      log("Publishing ugcPosts with media", { mediaCategory: isVideo ? "VIDEO" : "IMAGE", asset });
      const postId = await publishUgcPost({
        accessToken,
        personId,
        text,
        mediaCategory: isVideo ? "VIDEO" : "IMAGE",
        asset,
      });
      log("Published media ugcPost", { postId, asset });

      await LinkedInUploadHistory.create({
        userId,
        postId,
        postType: isVideo ? "video" : "image",
        text,
        asset,
        visibility: "PUBLIC",
      });

      return Response.json({ postId });
    }
  } catch (error) {
    errorLog("Publish failed", safeAxiosError(error));
    const message =
      error instanceof Error
        ? error.message
        : (error as any)?.response?.data || "Failed to publish to LinkedIn";
    return Response.json({ error: message }, { status: 500 });
  }
}

