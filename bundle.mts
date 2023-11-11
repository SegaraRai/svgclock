import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["./deno/server.ts"],
  outfile: "./dist/deno/server.js",
  bundle: true,
  minify: true,
  format: "esm",
});

await esbuild.build({
  entryPoints: ["./workers/server.ts"],
  outfile: "./dist/workers/server.js",
  bundle: true,
  minify: true,
  format: "esm",
});
