import {
  createSVG,
  escapeHTML,
  getTimezoneOffsetFromRequest,
  isViaCamo,
} from "./utils.ts";

const WAIT_BEFORE_PURGE = 1000;
const USER_AGENT = "svg-clock/1.0.0";

const CLOCK_TIMESTAMP_OFFSET_CAMO = 200;
const CLOCK_TIMESTAMP_OFFSET_NORMAL = 0;

const LINK_URL_REPOSITORY = "https://github.com/SegaraRai/svgclock";

export interface Env {
  readonly PURGE_TOKEN: string;
}

function getTimestampFromRequest(
  request: Request,
  timestamp = Date.now()
): [ts: number, dynamic: boolean] | undefined {
  const pathname = new URL(request.url).pathname;

  let match;
  if (/^\/utc\.svg$/i.test(pathname)) {
    return [timestamp, true];
  }

  if (/^\/local\.svg$/i.test(pathname)) {
    const timezoneOffset =
      getTimezoneOffsetFromRequest(request, timestamp) ?? 0;
    return [timestamp + timezoneOffset * 60_000, true];
  }

  if ((match = /^\/utc([+-])(\d\d)(\d\d)\.svg$/i.exec(pathname))) {
    return [
      timestamp +
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
    // no CORS support for now
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405 });
    }

    const viaCamo = isViaCamo(request);

    const url = new URL(request.url);
    const normalizedURL = url.toString();

    const timestamp = getTimestampFromRequest(request);
    if (!timestamp) {
      return new Response("Not found", { status: 404 });
    }

    const linkURL =
      url.searchParams.get("link") === "repository" ? LINK_URL_REPOSITORY : "";

    const [ts, dynamic] = timestamp;
    const tsWithOffset =
      ts +
      (viaCamo && dynamic
        ? CLOCK_TIMESTAMP_OFFSET_CAMO
        : CLOCK_TIMESTAMP_OFFSET_NORMAL);

    const extraContent = linkURL
      ? `<a href="${escapeHTML(
          linkURL
        )}">\n<rect x="-40" y="-10" width="920" height="200" fill="transparent" stroke="none" />\n</a>\n`
      : "";

    const svg = createSVG(tsWithOffset, normalizedURL, extraContent);

    if (dynamic && viaCamo) {
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
              url: normalizedURL,
            }),
          });
        })()
      );
    }

    const svgBinary = new TextEncoder().encode(svg);

    return new Response(request.method === "HEAD" ? null : svgBinary, {
      headers: {
        "Cache-Control": dynamic
          ? "private, no-cache, no-store, must-revalidate, max-age=0"
          : "public, max-age=3600",
        "Content-Length": String(svgBinary.length),
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline'",
        "Content-Type": "image/svg+xml",
      },
    });
  },
};
