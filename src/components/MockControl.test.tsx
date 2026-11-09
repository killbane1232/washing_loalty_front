// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MockControl } from "./MockControl";

const station = { id: 1, name: "Пост 1", point: "1", qr: "qr", address: "mock://local", connection_type: "mock" };
const state = { online: true, balance: 100, user_id: 7 };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
beforeEach(() => {
  localStorage.clear();
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const open = () => render(<MockControl station={station} onClose={vi.fn()} onChange={vi.fn()} />);

it("restores an uncertain command after remount and retries the exact request", async () => {
  const commands: unknown[] = [];
  vi.stubGlobal("fetch", vi.fn(async (path: string, options?: RequestInit) => {
    if (path.endsWith("/mock")) {
      commands.push(JSON.parse(options!.body as string));
      if (commands.length === 1) throw new TypeError("lost acknowledgement");
      return response({ state, event_id: "mock:test" });
    }
    return response(path.endsWith("/state") ? { station, state } : { items: [] });
  }));
  const first = open();
  await screen.findByText(/Клиент №7/);
  fireEvent.change(screen.getByLabelText("Начислить бонусы клиенту"), { target: { value: "15" } });
  fireEvent.click(screen.getByRole("button", { name: "Начислить бонусы" }));
  await screen.findByText(/Нет связи с сервером/);
  expect(commands[0]).toEqual({ action: "accrue", diff: 15, request_id: expect.any(String) });
  first.unmount(); open();
  fireEvent.click(await screen.findByRole("button", { name: "Проверить команду" }));
  await screen.findByText(/Начисление сохранено в очереди/);
  expect(commands[1]).toEqual(commands[0]);
  expect(localStorage.getItem("washing-mock-command:1")).toBeNull();
});

it("requires a linked online customer for accrual but allows zero station balance", async () => {
  const fetch = vi.fn(async (path: string) => response(path.endsWith("/state")
    ? { station, state: { ...state, online: false, user_id: null } }
    : path.endsWith("/mock") ? { state } : { items: [] }));
  vi.stubGlobal("fetch", fetch); open();
  await screen.findByText(/Без клиента/);
  expect(screen.getByRole("button", { name: "Начислить бонусы" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Баланс поста"), { target: { value: "0" } });
  fireEvent.click(screen.getByRole("button", { name: "Установить баланс" }));
  await screen.findByText("Команда выполнена.");
  expect(fetch).toHaveBeenCalledWith("/api/admin/stations/1/mock", expect.objectContaining({ body: expect.stringContaining('"balance":0') }));
});

it("retries a failed delivery by event ID without issuing another accrual", async () => {
  const fetch = vi.fn(async (path: string) => response(path.endsWith("/state") ? { station, state } : {
    items: [{ event_id: "mock:accrual-event-0001", user_id: 7, diff: 15, status: "failed", last_error: "http_401" }],
  }));
  vi.stubGlobal("fetch", fetch); open();
  fireEvent.click(await screen.findByRole("button", { name: "Повторить доставку" }));
  await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/admin/stations/1/mock/events/mock%3Aaccrual-event-0001/retry", expect.objectContaining({ method: "POST", body: "{}" })));
  expect(fetch.mock.calls.filter(([path]) => path.endsWith("/mock"))).toHaveLength(0);
});
