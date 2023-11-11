const KV_KEY_SPACE_GITHUB_CAMO = "ghCamo";
const KV_EXPIRES_IN = 24 * 60 * 60 * 1000;

const USER_AGENT = "purge.deno.dev";

function isAllowedURL(url: URL): boolean {
  return url.hostname === "svgclock.abelia.workers.dev";
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function timingSafeEqual(input: Uint8Array, expected: Uint8Array): boolean {
  let diff = 0xff00 >>> 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= input[i % expected.length] ^ expected[i];
  }
  return diff === 0xff00;
}

async function getGitHubCamoURL(url: string): Promise<string> {
  // Rate-limit: 60 requests per hour
  const res = await fetch("https://api.github.com/markdown", {
    method: "POST",
    headers: {
      Accept: "text/html",
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT,
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      text: `![image](${url})`,
    }),
  });
  if (!res.ok) {
    throw new Error(`GitHub API returned ${res.status}`);
  }

  const text = await res.text();
  const match = /src="([^"]+)"/.exec(text);
  if (!match) {
    throw new Error("GitHub API returned unexpected response");
  }

  return match[1];
}

const kv = await Deno.openKv();
const expectedTokenSHA256 = hexToBytes(Deno.env.get("AUTH_TOKEN_SHA256") || "");

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
      camoURL = await getGitHubCamoURL(url);

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
