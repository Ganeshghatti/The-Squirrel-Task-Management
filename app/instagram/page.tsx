import { buildInstagramOAuthAuthorizeUrl } from "@/lib/instagramOAuthFlow";
import InstagramPageClient from "./InstagramPageClient";

export default function InstagramPage() {
  let instagramAuthorizeUrl = "";
  try {
    instagramAuthorizeUrl = buildInstagramOAuthAuthorizeUrl();
  } catch {
    instagramAuthorizeUrl = "";
  }

  return <InstagramPageClient instagramAuthorizeUrl={instagramAuthorizeUrl} />;
}
