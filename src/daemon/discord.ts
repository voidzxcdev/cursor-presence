import { Client, type SetActivity } from "@xhayper/discord-rpc";
import { log } from "./log";

// Discord accepts 5 activity updates per 20 seconds; spend them as they come rather than one per 4s.
const WINDOW_MS = 20_000;
const MAX_PER_WINDOW = 5;
/** Lets a burst of hook events settle into one update. */
const SETTLE_MS = 400;
const MIN_GAP_MS = 1_200;
const RETRY_MS = 15_000;
/** Discord drops a card that is never sent again. Refresh the same one while you are away. */
const KEEPALIVE_MS = 25_000;
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
  private sentWall = 0;
  private sentAt: number[] = [];
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
      this.sentWall = 0;
      this.retryAt = Date.now() + 5_000;
    });
    try {
      await client.login();
      this.client = client;
      this.ready = true;
      this.failures = 0;
      this.lastError = null;
      this.sentKey = UNSENT;
      this.sentWall = 0;
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

  private arm(wait: number): void {
    if (!this.ready || this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flush();
    }, wait);
  }

  private schedule(): void {
    if (!this.ready || this.flushTimer) return;
    const now = Date.now();
    this.sentAt = this.sentAt.filter((t) => now - t < WINDOW_MS);
    const used = this.sentAt.length;
    const last = this.sentAt[used - 1] ?? 0;
    // Widen the gap as the budget runs low so a busy agent never hits a long freeze.
    const gap = used < 2 ? MIN_GAP_MS : used < MAX_PER_WINDOW - 1 ? 3_000 : 4_500;
    let wait = Math.max(SETTLE_MS, last + gap - now);
    if (used >= MAX_PER_WINDOW) wait = Math.max(wait, this.sentAt[0] + WINDOW_MS - now);
    this.arm(wait);
  }

  private async flush(): Promise<void> {
    const client = this.client;
    if (!client || !this.ready) return;
    const activity = this.desired;
    const key = this.keyOf(activity);
    const stale = !!activity && Date.now() - this.sentWall >= KEEPALIVE_MS;
    if (key === this.sentKey && !stale) {
      if (activity) this.arm(KEEPALIVE_MS);
      return;
    }
    this.sentAt.push(Date.now());
    try {
      if (activity) await client.user?.setActivity(activity);
      else await client.user?.clearActivity();
      this.sentKey = key;
      this.sentWall = Date.now();
    } catch (err) {
      log(`discord update failed: ${(err as Error)?.message ?? err}`);
      this.sentWall = 0;
    }
    if (activity && this.keyOf(this.desired) === this.sentKey) this.arm(KEEPALIVE_MS);
    else if (this.keyOf(this.desired) !== this.sentKey) this.schedule();
  }

  async teardown(): Promise<void> {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = null;
    const client = this.client;
    this.client = null;
    this.ready = false;
    this.sentKey = UNSENT;
    this.sentWall = 0;
    if (!client) return;
    await client.user?.clearActivity().catch(() => {});
    await client.destroy().catch(() => {});
  }
}
