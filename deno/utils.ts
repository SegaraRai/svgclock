import { USER_AGENT } from "./config.ts";

export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * `input` and `expected` must have the same length, by hashing or other means.
 * otherwise, this function will return `false` immediately and no timing attack will be prevented.
 * @param input input value
 * @param expected expected value
 * @returns `true` if `input` and `expected` are equal, `false` otherwise.
 */
export function timingSafeEqual(
  input: Uint8Array,
  expected: Uint8Array
): boolean {
  if (input.length !== expected.length) {
    return false;
  }

  let diff = 0xff00 >>> 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= input[i] ^ expected[i];
  }
  return diff === 0xff00;
}

export async function fetchGitHubCamoURL(url: string): Promise<string> {
  // Rate-limit: 60 requests per hour (with IP-based rate limiting)
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
