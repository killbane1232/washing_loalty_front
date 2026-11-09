// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { connectStation, watchStation } from "./stationSocket";

class Socket {
  static instances: Socket[] = [];
  onopen?: () => void;
  onmessage?: (event: { data: string }) => void;
  onclose?: () => void;
  onerror?: () => void;
  send = vi.fn();
  close = vi.fn(() => this.onclose?.());
  constructor(public url: string) {
    Socket.instances.push(this);
  }
  message(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }
}
beforeEach(() => {
  Socket.instances = [];
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", Socket);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("station WebSocket", () => {
  it("sends the spend amount and idempotency key only after opening", async () => {
    const result = connectStation({
      qr: "post-1",
      action: "spend",
      amount: 45,
      request_id: "operation-id",
    });
    const socket = Socket.instances[0];
    expect(socket.send).not.toHaveBeenCalled();
    socket.onopen!();
    expect(JSON.parse(socket.send.mock.calls[0][0])).toEqual({
      type: "connect",
      qr: "post-1",
      action: "spend",
      amount: 45,
      request_id: "operation-id",
    });
    socket.message({ type: "connected" });
    await expect(result).resolves.toBeUndefined();
    expect(socket.close).toHaveBeenCalledOnce();
  });
  it("rejects busy stations without successful connection", async () => {
    const result = connectStation({ qr: "post-1", action: "save" });
    const check = expect(result).rejects.toMatchObject({
      code: "station_busy",
      status: 409,
    });
    Socket.instances[0].message({
      type: "error",
      error: { code: "station_busy", status: 409 },
    });
    await check;
  });
  it("reconnects a subscription, never replays a spending command, and cleans up", () => {
    const state = vi.fn();
    const status = vi.fn();
    const stop = watchStation("post-1", state, status);
    Socket.instances[0].onopen!();
    expect(JSON.parse(Socket.instances[0].send.mock.calls[0][0])).toEqual({
      type: "subscribe",
      qr: "post-1",
    });
    Socket.instances[0].message({
      type: "state",
      state: { online: true, balance: 100, linked_to_user: true },
    });
    expect(state).toHaveBeenCalledOnce();
    Socket.instances[0].close();
    vi.advanceTimersByTime(1000);
    expect(Socket.instances).toHaveLength(2);
    Socket.instances[1].onopen!();
    expect(JSON.parse(Socket.instances[1].send.mock.calls[0][0]).type).toBe(
      "subscribe",
    );
    stop();
    vi.advanceTimersByTime(60_000);
    expect(Socket.instances).toHaveLength(2);
  });
  it("stops reconnecting on revoked authentication", () => {
    const expired = vi.fn();
    window.addEventListener("session-expired", expired);
    const stop = watchStation("post-1", vi.fn(), vi.fn());
    Socket.instances[0].message({
      type: "error",
      error: { code: "unauthorized", status: 401 },
    });
    vi.advanceTimersByTime(60_000);
    expect(expired).toHaveBeenCalledOnce();
    expect(Socket.instances).toHaveLength(1);
    stop();
    window.removeEventListener("session-expired", expired);
  });
});
