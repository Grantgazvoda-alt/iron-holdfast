import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const index = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const ui = readFileSync(new URL("../public/campaign-ui.js", import.meta.url), "utf8");

describe("campaign mobile HUD certification", () => {
  it("loads the socket observer before the main client", () => {
    const campaign = index.indexOf('src="/campaign-ui.js"');
    const client = index.indexOf('src="/client.js"');
    expect(campaign).toBeGreaterThan(0);
    expect(client).toBeGreaterThan(campaign);
  });

  it("uses a mobile-safe viewport", () => {
    expect(index).toContain("maximum-scale=1");
    expect(index).toContain("user-scalable=no");
    expect(index).toContain("viewport-fit=cover");
  });

  it("sends only the server-recognized campaign actions", () => {
    expect(ui).toContain('type: "world_resupply"');
    expect(ui).toContain('type: "world_assault_town"');
    expect(ui).toContain('type: "campaign_battle_order"');
    expect(ui).toContain('data-order="hold"');
    expect(ui).toContain('data-order="advance"');
    expect(ui).toContain('data-order="charge"');
    expect(ui).toContain('data-order="withdraw"');
  });

  it("reuses the existing WebSocket rather than opening a second room claim", () => {
    expect(ui).toContain("new Proxy(NativeWebSocket");
    expect(ui).not.toContain("new NativeWebSocket(");
  });

  it("accounts for iOS safe areas and touch targets", () => {
    expect(ui).toContain("safe-area-inset-bottom");
    expect(ui).toContain("min-height:44px");
  });
});
