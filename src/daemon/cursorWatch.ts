import { execFile } from "node:child_process";

function run(cmd: string, args: string[]): Promise<{ ok: boolean; out: string }> {
  return new Promise((resolve) => {
    execFile(cmd, args, { windowsHide: true, timeout: 10_000 }, (err, stdout) =>
      resolve({ ok: !err, out: String(stdout ?? "") }),
    );
  });
}

export async function isCursorRunning(): Promise<boolean> {
  if (process.platform === "win32") {
    const { out } = await run("tasklist", ["/FI", "IMAGENAME eq Cursor.exe", "/FO", "CSV", "/NH"]);
    return /"cursor\.exe"/i.test(out);
  }
  if (process.platform === "darwin") return (await run("pgrep", ["-x", "Cursor"])).ok;
  return (await run("pgrep", ["-x", "cursor"])).ok || (await run("pgrep", ["-x", "Cursor"])).ok;
}
