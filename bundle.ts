import * as esbuild from "https://deno.land/x/esbuild@v0.19.4/mod.js";
import { denoPlugins } from "https://deno.land/x/esbuild_deno_loader@0.8.2/mod.ts";

await esbuild.build({
  plugins: [...denoPlugins()],
  entryPoints: [new URL("./src/server.ts", import.meta.url).toString()],
  outfile: "./dist/server.js",
  bundle: true,
  minify: true,
  format: "esm",
});
esbuild.stop();
