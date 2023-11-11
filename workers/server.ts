import { createSVG } from "./utils.ts";

const WAIT_BEFORE_PURGE = 1000;
const USER_AGENT = "svg-clock/1.0.0";

export interface Env {
  readonly PURGE_TOKEN: string;
}

function getTimestampFromPathname(
  pathname: string
): [ts: number, dynamic: boolean] | undefined {
  let match;
  if (/^\/utc\.svg$/i.test(pathname)) {
    return [Date.now(), true];
  }

  if ((match = /^\/utc([+-])(\d\d)(\d\d)\.svg$/i.exec(pathname))) {
    return [
      Date.now() +
        (match[1] === "-" ? -1 : 1) *
          (parseInt(match[2], 10) * 60 + parseInt(match[3], 10)) *
          60 *
          1000,
      true,
    ];
  }

  if ((match = /^\/(\d\d)(\d\d)(\d\d)(\.\d\d\d)?\.svg$/i.exec(pathname))) {
    return [
      Date.UTC(
        2023,
        1,
        1,
        parseInt(match[1], 10),
        parseInt(match[2], 10),
        parseInt(match[3], 10),
        parseInt(match[4]?.slice(1) || "0", 10)
      ),
      false,
    ];
  }

  return undefined;
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Response {
    const url = new URL(request.url);

    const timestamp = getTimestampFromPathname(url.pathname);
    if (!timestamp) {
      return new Response("Not found", { status: 404 });
    }

    const [ts, dynamic] = timestamp;
    const svg = createSVG(ts, url.toString());

    if (dynamic && /camo/i.test(request.headers.get("User-Agent") || "")) {
      ctx.waitUntil(
        (async (): Promise<void> => {
          await new Promise((resolve) =>
            setTimeout(resolve, WAIT_BEFORE_PURGE)
          );

          // We have to use Deno Deploy instead of directly calling GitHub API since Cloudflare doesn't allow us to call `PURGE` method from the worker
          // Also we cannot use Deno Deploy to host whole app since it doesn't support `waitUntil` or similar API

          await fetch("https://purge.deno.dev/purge/github", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${env.PURGE_TOKEN}`,
              "Content-Type": "application/json",
              "User-Agent": USER_AGENT,
            },
            body: JSON.stringify({
              url: url.toString(),
            }),
          });
        })()
      );
    }

    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": dynamic
          ? "private, no-cache, no-store, must-revalidate, max-age=0"
          : "public, max-age=3600",
      },
    });
  },
};
