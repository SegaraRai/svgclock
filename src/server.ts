import { createSVG } from "./utils.ts";

function getTimestampFromPathname(
  pathname: string
): [ts: number, dynamic: boolean] | undefined {
  let match;
  if (/^utc\.svg$/i.test(pathname)) {
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

Deno.serve((req: Request): Response => {
  const url = new URL(req.url);

  const timestamp = getTimestampFromPathname(url.pathname);
  if (!timestamp) {
    return new Response("Not found", { status: 404 });
  }

  const [ts, dynamic] = timestamp;
  const svg = createSVG(ts, url.toString());

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": dynamic ? "no-cache" : "public, max-age=31536000",
    },
  });
});
