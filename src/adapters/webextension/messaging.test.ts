import { describe, expect, it, vi, beforeEach } from "vitest";

const sendMessage = vi.fn();
const connect = vi.fn();

vi.mock("webextension-polyfill", () => ({
  default: {
    runtime: {
      sendMessage: (...args: unknown[]) => sendMessage(...args),
      connect: (...args: unknown[]) => connect(...args),
    },
  },
}));

import { keepBackgroundAlive, sendPostingToBackground } from "@/adapters/webextension/messaging";
import type { ExtractedJobPosting } from "@/core/types";

const posting: ExtractedJobPosting = {
  title: "Senior Backend Engineer",
  company: "Nimbus Data",
  location: "Remote",
  salary: null,
  descriptionText: "x".repeat(200),
  sourceUrl: "https://www.indeed.com/jobs",
};

describe("sendPostingToBackground", () => {
  beforeEach(() => {
    sendMessage.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns the first response without retrying when it's truthy", async () => {
    sendMessage.mockResolvedValueOnce({ ok: true, applicationId: "abc" });

    const result = await sendPostingToBackground(posting, "2026-09-22T00:00:00.000Z");

    expect(result).toEqual({ ok: true, applicationId: "abc" });
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  // The exact failure mode reported live: an idle background answers with nothing at all
  // (no thrown error, sendMessage just resolves undefined) rather than rejecting outright.
  it("retries once after a short delay when the first attempt resolves to nothing", async () => {
    sendMessage.mockResolvedValueOnce(undefined).mockResolvedValueOnce({ ok: true, applicationId: "abc" });

    const result = await sendPostingToBackground(posting, "2026-09-22T00:00:00.000Z");

    expect(result).toEqual({ ok: true, applicationId: "abc" });
    expect(sendMessage).toHaveBeenCalledTimes(2);
  });

  it("retries once when the first attempt throws (background genuinely unreachable)", async () => {
    sendMessage.mockRejectedValueOnce(new Error("Could not establish connection.")).mockResolvedValueOnce({
      ok: true,
      applicationId: "abc",
    });

    const result = await sendPostingToBackground(posting, "2026-09-22T00:00:00.000Z");

    expect(result).toEqual({ ok: true, applicationId: "abc" });
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("couldn't reach the background"), expect.anything());
  });

  it("gives up and returns undefined only once both attempts fail", async () => {
    sendMessage.mockResolvedValue(undefined);

    const result = await sendPostingToBackground(posting, "2026-09-22T00:00:00.000Z");

    expect(result).toBeUndefined();
    expect(sendMessage).toHaveBeenCalledTimes(2);
  });
});

describe("keepBackgroundAlive", () => {
  beforeEach(() => {
    connect.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("opens a port named for the background's onConnect listener to recognize", () => {
    connect.mockReturnValue({ onDisconnect: { addListener: vi.fn() } });

    keepBackgroundAlive();

    expect(connect).toHaveBeenCalledWith({ name: "sonar-catch-keepalive" });
  });

  it("reconnects when the port disconnects, so a background restart doesn't end keep-alive for good", () => {
    let disconnectHandler: (() => void) | undefined;
    connect.mockReturnValue({
      onDisconnect: {
        addListener: (fn: () => void) => {
          disconnectHandler = fn;
        },
      },
    });

    keepBackgroundAlive();
    expect(connect).toHaveBeenCalledTimes(1);

    disconnectHandler?.();
    expect(connect).toHaveBeenCalledTimes(2);
  });

  it("logs rather than throws if connecting fails (e.g. an invalidated extension context)", () => {
    connect.mockImplementation(() => {
      throw new Error("Extension context invalidated.");
    });

    expect(() => keepBackgroundAlive()).not.toThrow();
    expect(console.error).toHaveBeenCalled();
  });
});
