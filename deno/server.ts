import {
  ENV_NAME_AUTH_TOKEN_SHA256,
  KV_EXPIRES_IN,
  KV_KEY_SPACE_GITHUB_CAMO,
  USER_AGENT,
  isAllowedURL,
} from "./config.ts";
import { fetchGitHubCamoURL, hexToBytes, timingSafeEqual } from "./utils.ts";

const kv = await Deno.openKv();

const expectedTokenSHA256 = hexToBytes(
  Deno.env.get(ENV_NAME_AUTH_TOKEN_SHA256) || ""
);

Deno.serve(async (req: Request): Promise<Response> => {
  const reqURL = new URL(req.url);
  if (req.method !== "POST" || reqURL.pathname !== "/purge/github") {
    return new Response("Not found", { status: 404 });
  }

  const token = /^Bearer (\S+)$/.exec(
    req.headers.get("Authorization") || ""
  )?.[1];
  if (!token) {
    return new Response("Unauthorized", { status: 401 });
  }

  const tokenSHA256 = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token)
  );
  if (!timingSafeEqual(new Uint8Array(tokenSHA256), expectedTokenSHA256)) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const data = await req.json().catch(() => undefined);
    if (
      typeof data !== "object" ||
      data == null ||
      !("url" in data) ||
      typeof data.url !== "string"
    ) {
      return new Response("Bad request", { status: 400 });
    }

    const { url } = data;

    const parsedURL = new URL(url);
    if (parsedURL.toString() !== url) {
      return new Response("Malformed URL", { status: 400 });
    }

    if (!isAllowedURL(parsedURL)) {
      return new Response("Forbidden", { status: 403 });
    }

    let camoURL = (
      await kv.get<string>([KV_KEY_SPACE_GITHUB_CAMO, url], {
        consistency: "eventual",
      })
    ).value;

    if (!camoURL) {
      camoURL = await fetchGitHubCamoURL(url);

      await kv.set([KV_KEY_SPACE_GITHUB_CAMO, url], camoURL, {
        expireIn: KV_EXPIRES_IN,
      });
    }

    const res = await fetch(camoURL, {
      method: "PURGE",
      headers: {
        "User-Agent": USER_AGENT,
      },
    });
    if (!res.ok) {
      return new Response(`Upstream returned ${res.status}`, { status: 502 });
    }

    return new Response("No Content", { status: 204 });
  } catch {
    return new Response("Internal Server Error", { status: 500 });
  }
});
