import net from "node:net";
import os from "node:os";
import path from "node:path";
import { HOME_DIR } from "./hooks-config.mjs";

const user = os.userInfo().username.replace(/[^\w.-]/g, "_");
const PIPE_PATH =
  process.platform === "win32" ? `\\\\.\\pipe\\cursor-presence-${user}` : path.join(HOME_DIR, "daemon.sock");

function send(message) {
  return new Promise((resolve) => {
    const socket = net.connect(PIPE_PATH);
    socket.setTimeout(800, () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("connect", () => socket.end(`${message}\n`, () => resolve(true)));
    socket.on("error", () => resolve(false));
  });
}

export async function stopDaemon() {
  if (!(await send("quit"))) return;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 150));
    if (!(await send("ping"))) return;
  }
}
