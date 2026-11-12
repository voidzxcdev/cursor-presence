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

/** "[[dd-]hh:]mm:ss" from ps -o etime, in seconds. */
function parseElapsed(etime: string): number {
  const [days, clock] = etime.includes("-") ? etime.split("-") : ["0", etime];
  const parts = clock.split(":").map(Number);
  while (parts.length < 3) parts.unshift(0);
  return Number(days) * 86_400 + parts[0] * 3_600 + parts[1] * 60 + parts[2];
}

/** When the oldest Cursor process (the app itself) started, in epoch ms. */
export async function cursorLaunchedAt(): Promise<number | null> {
  if (process.platform === "win32") {
    const { out } = await run("powershell", [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "$p = Get-Process -Name Cursor -ErrorAction SilentlyContinue | Sort-Object StartTime | Select-Object -First 1; if ($p) { [DateTimeOffset]::new($p.StartTime).ToUnixTimeMilliseconds() }",
    ]);
    const ms = Number(out.trim());
    return Number.isFinite(ms) && ms > 0 ? ms : null;
  }
  const { out } = await run("ps", ["-axo", "etime=,comm="]);
  let oldest = -1;
  for (const line of out.split("\n")) {
    const m = line.trim().match(/^(\S+)\s+(.+)$/);
    if (m && /(^|\/)cursor$/i.test(m[2].trim())) oldest = Math.max(oldest, parseElapsed(m[1]));
  }
  return oldest >= 0 ? Date.now() - oldest * 1000 : null;
}
