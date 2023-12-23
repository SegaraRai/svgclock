import {
  PRECALCULATED_DISPLAYS,
  PRECALCULATED_COUNTRY_TIMEZONE_MAP,
  createSVG as createSVGImported,
} from "./generated.ts";

export function escapeHTML(str: string): string {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function writeOpacity(on: boolean): string {
  return `opacity: ${on ? "1" : "0.04"}`;
}

export function createStyle(timestamp: number): string {
  const offsetMSec = 86400_000 - (timestamp % 86400_000);

  let text = "";
  for (const display of PRECALCULATED_DISPLAYS) {
    const div = display.d * 10;
    const div100 = display.d * 1000;

    for (const { c: className, i: initial, k: keyframes } of display.p) {
      if (keyframes.length) {
        let initialOn = !initial;
        let max = 0;
        text += `@keyframes k${className} {\n`;
        for (const [i, msec] of keyframes.entries()) {
          const p = ((msec + offsetMSec) % div100) / div;
          const mod = (i + initial) & 3;
          const on = mod === 0 || mod === 3;
          text += `${p}% { ${writeOpacity(on)} }\n`;
          if (max < p) {
            max = p;
            initialOn = on;
          }
        }
        text += "}\n";
        text += `.${className} { ${writeOpacity(
          initialOn
        )}; animation: k${className} ${display.d}s ease infinite }\n`;
      } else {
        text += `.${className} { ${writeOpacity(!initial)} }\n`;
      }
    }
  }

  return text;
}

export function createSVG(
  timestamp: number,
  linkURL: string,
  extraContent = ""
): string {
  return createSVGImported({
    style: createStyle(timestamp),
    linkURL: escapeHTML(linkURL),
    extraContent,
  });
}

export function isViaCamo(request: Request): boolean {
  return /camo/i.test(
    request.headers.get("User-Agent") ?? request.headers.get("Via") ?? ""
  );
}

function getTimezoneFromCountry(
  country: string | null | undefined
): string | undefined {
  return (
    PRECALCULATED_COUNTRY_TIMEZONE_MAP as Record<string, string | undefined>
  )[country?.toUpperCase() ?? ""];
}

function getCountryFromAcceptLanguage(request: Request): string | undefined {
  return request.headers.get("Accept-Language")?.split(",")[0].split("-")[1];
}

function getTimezoneOffset(
  timezone: string,
  timestamp = Date.now()
): number | undefined {
  const offset = new Date(timestamp)
    .toLocaleString("sv-SE", {
      timeZone: timezone,
      timeZoneName: "longOffset",
    })
    .split("GMT")[1];
  if (!offset) {
    return;
  }

  const sign = offset.startsWith("-") ? -1 : 1;
  const [hour, minute] = offset.slice(1).split(":");
  return sign * (parseInt(hour, 10) * 60 + parseInt(minute, 10));
}

export function getTimezoneOffsetFromRequest(
  request: Request,
  timestamp = Date.now()
): number | undefined {
  try {
    let timezone: string | undefined;
    if (isViaCamo(request)) {
      timezone = getTimezoneFromCountry(getCountryFromAcceptLanguage(request));
    } else {
      timezone =
        (request.cf?.timezone as string | undefined) ??
        getTimezoneFromCountry(request.cf?.country as string | undefined) ??
        getTimezoneFromCountry(request.headers.get("CF-IPCountry")) ??
        getTimezoneFromCountry(getCountryFromAcceptLanguage(request));
    }
    if (!timezone) {
      return;
    }

    return getTimezoneOffset(timezone, timestamp);
  } catch (e) {
    console.error(e);
    return;
  }
}
