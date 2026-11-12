import * as esbuild from "esbuild";

const entries = {
  daemon: "src/daemon/index.ts",
  hook: "src/hook.ts",
  ctl: "src/ctl.ts",
};

await Promise.all(
  Object.entries(entries).map(([name, entry]) =>
    esbuild.build({
      entryPoints: [entry],
      bundle: true,
      platform: "node",
      target: "node20",
      format: "cjs",
      outfile: `dist/${name}.cjs`,
      minify: true,
      legalComments: "none",
      logLevel: "info",
    }),
  ),
);
