export const KV_KEY_SPACE_GITHUB_CAMO = "ghCamo";
export const KV_EXPIRES_IN = 24 * 60 * 60 * 1000;

export const ENV_NAME_AUTH_TOKEN_SHA256 = "AUTH_TOKEN_SHA256";

export const USER_AGENT = "purge.deno.dev";

export function isAllowedURL(url: URL): boolean {
  return url.hostname === "svgclock.abelia.workers.dev";
}
