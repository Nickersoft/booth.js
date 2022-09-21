const { build } = require("esbuild");

Promise.all([
  build({
    entryPoints: ["src/index.ts"],
    outfile: "dist/booth.js",
    bundle: true,
    sourcemap: true,
    platform: "browser",
    target: "chrome58",
    globalName: "BoothJS",
  }),
  build({
    entryPoints: ["src/index.ts"],
    outfile: "dist/booth.min.js",
    bundle: true,
    minify: true,
    sourcemap: true,
    platform: "browser",
    target: "chrome58",
    globalName: "BoothJS",
  }),
]);
