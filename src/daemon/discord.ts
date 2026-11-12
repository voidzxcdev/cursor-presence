import { Client, type SetActivity } from "@xhayper/discord-rpc";
import { log } from "./log";

// Discord accepts 5 activity updates per 20 seconds.
const MIN_GAP_MS = 4_000;
const RETRY_MS = 15_000;
const UNSENT = "\u0000unsent";

export class DiscordLink {
  private client: Client | null = null;
  private clientId = "";
  private ready = false;
  private connecting = false;
  private retryAt = 0;
  private failures = 0;
  private desired: SetActivity | null = null;
  private sentKey = UNSENT;
  private lastSentAt = 0;
  private flushTimer: NodeJS.Timeout | null = null;
  lastError: string | null = null;

  get connected(): boolean {
    return this.ready;
  }

  configure(clientId: string): void {
    const id = clientId.trim();
    if (id === this.clientId) return;
    this.clientId = id;
    this.retryAt = 0;
    this.failures = 0;
    this.lastError = null;
    void this.teardown();
  }

  set(activity: SetActivity | null): void {
    this.desired = activity;
    this.schedule();
  }

  tick(): void {
    if (this.ready || this.connecting || !this.clientId || Date.now() < this.retryAt) return;
    void this.connect();
  }

  private async connect(): Promise<void> {
    this.connecting = true;
    const client = new Client({ clientId: this.clientId, transport: { type: "ipc" } });
    client.on("disconnected", () => {
      if (this.client !== client) return;
      log("discord disconnected");
      this.client = null;
      this.ready = false;
      this.sentKey = UNSENT;
      this.retryAt = Date.now() + 5_000;
    });
    try {
      await client.login();
      this.client = client;
      this.ready = true;
      this.failures = 0;
      this.lastError = null;
      this.sentKey = UNSENT;
      log("discord connected");
      this.schedule();
    } catch (err) {
      this.lastError = String((err as Error)?.message ?? err);
      if (this.failures++ === 0) log(`discord unavailable: ${this.lastError}`);
      this.retryAt = Date.now() + RETRY_MS;
      client.destroy().catch(() => {});
    } finally {
      this.connecting = false;
    }
  }

  private keyOf(activity: SetActivity | null): string {
    return activity ? JSON.stringify(activity) : "";
  }

  private schedule(): void {
    if (!this.ready || this.flushTimer) return;
    const wait = Math.max(0, this.lastSentAt + MIN_GAP_MS - Date.now());
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flush();
    }, wait);
  }

  private async flush(): Promise<void> {
    const client = this.client;
    if (!client || !this.ready) return;
    const activity = this.desired;
    const key = this.keyOf(activity);
    if (key === this.sentKey) return;
    this.lastSentAt = Date.now();
    try {
      if (activity) await client.user?.setActivity(activity);
      else await client.user?.clearActivity();
      this.sentKey = key;
    } catch (err) {
      log(`discord update failed: ${(err as Error)?.message ?? err}`);
    }
    if (this.keyOf(this.desired) !== this.sentKey) this.schedule();
  }

  async teardown(): Promise<void> {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = null;
    const client = this.client;
    this.client = null;
    this.ready = false;
    this.sentKey = UNSENT;
    if (!client) return;
    await client.user?.clearActivity().catch(() => {});
    await client.destroy().catch(() => {});
  }
}
