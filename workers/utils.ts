import {
  PRECALCULATED_DISPLAYS,
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
