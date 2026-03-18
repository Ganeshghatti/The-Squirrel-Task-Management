import axios from "axios";
import { PDFDocument } from "pdf-lib";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import connectDB from "@/lib/mongodb";
import LinkedInAccount from "@/models/LinkedInAccount";
import LinkedInUploadHistory from "@/models/LinkedInUploadHistory";

function getVisibility() {
  return { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" as const };
}

async function registerUpload(params: {
  accessToken: string;
  personId: string;
  recipe: "urn:li:digitalmediaRecipe:feedshare-image" | "urn:li:digitalmediaRecipe:feedshare-document";
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
  mediaCategory: "NONE" | "IMAGE" | "DOCUMENT";
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

  return postRes.data.id as string;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string; role?: string; linkedinAccess?: boolean } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role;
  const linkedinAccess = (session?.user as { linkedinAccess?: boolean } | undefined)?.linkedinAccess;

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (role !== "admin" && !linkedinAccess) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const text = formData.get("text")?.toString() || "";
    const files = formData.getAll("files").filter((item) => item instanceof Blob) as Blob[];

    if (!text.trim()) {
      return Response.json({ error: "Text is required" }, { status: 400 });
    }

    await connectDB();
    const account = await LinkedInAccount.findOne({ userId });

    if (!account?.accessToken || !account.personId) {
      return Response.json({ error: "LinkedIn is not connected" }, { status: 400 });
    }

    const accessToken = account.accessToken;
    const personId = account.personId;

    // Text-only post
    if (files.length === 0) {
      const postId = await publishUgcPost({
        accessToken,
        personId,
        text,
        mediaCategory: "NONE",
      });

      await LinkedInUploadHistory.create({
        userId,
        postId,
        postType: "text",
        text,
        visibility: "PUBLIC",
      });

      return Response.json({ postId });
    }

    // Single image -> image post
    if (files.length === 1) {
      const image = files[0];
      const { uploadUrl, asset } = await registerUpload({
        accessToken,
        personId,
        recipe: "urn:li:digitalmediaRecipe:feedshare-image",
      });

      const imageBytes = Buffer.from(await image.arrayBuffer());
      await axios.put(uploadUrl, imageBytes, {
        headers: { "Content-Type": image.type || "image/png" },
        maxBodyLength: Infinity,
      });

      const postId = await publishUgcPost({
        accessToken,
        personId,
        text,
        mediaCategory: "IMAGE",
        asset,
      });

      await LinkedInUploadHistory.create({
        userId,
        postId,
        postType: "image",
        text,
        asset,
        visibility: "PUBLIC",
      });

      return Response.json({ postId });
    }

    // Multiple images -> document post (PDF)
    const pdfDoc = await PDFDocument.create();
    for (const image of files) {
      const imageBytes = Buffer.from(await image.arrayBuffer());
      const embedded = image.type === "image/jpeg"
        ? await pdfDoc.embedJpg(imageBytes)
        : await pdfDoc.embedPng(imageBytes);
      const page = pdfDoc.addPage([embedded.width, embedded.height]);
      page.drawImage(embedded, { x: 0, y: 0, width: embedded.width, height: embedded.height });
    }
    const pdfBytes = Buffer.from(await pdfDoc.save());

    const { uploadUrl, asset } = await registerUpload({
      accessToken,
      personId,
      recipe: "urn:li:digitalmediaRecipe:feedshare-document",
    });

    await axios.put(uploadUrl, pdfBytes, {
      headers: { "Content-Type": "application/pdf" },
      maxBodyLength: Infinity,
    });

    const postId = await publishUgcPost({
      accessToken,
      personId,
      text,
      mediaCategory: "DOCUMENT",
      asset,
    });

    await LinkedInUploadHistory.create({
      userId,
      postId,
      postType: "document",
      text,
      asset,
      visibility: "PUBLIC",
    });

    return Response.json({ postId });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : (error as any)?.response?.data || "Failed to publish to LinkedIn";
    return Response.json({ error: message }, { status: 500 });
  }
}

