const { glob } = require("glob");

const { build } = require("esbuild");

async function buildESM() {
  await build({
    entryPoints: glob.sync("src/**/*.ts"),
    outdir: "dist/esm",
    sourcemap: true,
    splitting: true,
    format: "esm",
    target: ["esnext"],
  });
}

async function buildCJS() {
  await build({
    entryPoints: glob.sync("src/**/*.ts"),
    outdir: "dist/cjs",
    sourcemap: true,
    format: "cjs",
    target: ["esnext"],
  });
}

async function buildIIEF() {
  await build({
    entryPoints: ["src/index.ts"],
    outfile: "dist/record.js",
    bundle: true,
    sourcemap: true,
    platform: "browser",
    target: "chrome58",
    globalName: "RecordJS",
  });
}

Promise.all([buildESM(), buildCJS(), buildIIEF()]);
