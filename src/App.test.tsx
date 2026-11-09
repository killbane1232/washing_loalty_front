// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { App } from "./App";
import { AuthProvider } from "./lib/auth";
import { connectStation } from "./lib/stationSocket";

vi.mock("./components/Scanner", () => ({ Scanner: () => <div>Камера</div> }));
vi.mock("./lib/stationSocket", () => ({
  connectStation: vi.fn(),
  watchStation: vi.fn(() => () => {}),
}));
const user = {
  role: "user",
  user: { id: 1, login: "alex", balance: 500 },
  expires_at: new Date(Date.now() + 3_600_000).toISOString(),
};
const response = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
function open(path = "/") {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("opens login when the session cookie is missing or expired", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response({ error: { code: "unauthorized" } }, 401)),
  );
  open("/admin/users");
  expect(await screen.findByText("С возвращением")).toBeInTheDocument();
  expect(screen.queryByText("Участники программы")).not.toBeInTheDocument();
});
it("does not expose admin pages to a regular user", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string) =>
      response(path === "/api/me" ? user : { items: [], has_more: false }),
    ),
  );
  open("/admin/stations");
  expect(await screen.findByText("Привет, alex!")).toBeInTheDocument();
  expect(screen.queryByText("Добавить станцию")).not.toBeInTheDocument();
});
it("uses the server-verified admin role to open administration", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string) =>
      response(
        path === "/api/me"
          ? { role: "admin", expires_at: user.expires_at }
          : {
              users: 4,
              stations: 2,
              balance: "500",
              earned: "800",
              spent: "300",
            },
      ),
    ),
  );
  open();
  expect(
    await screen.findByRole("heading", { name: "Всё под контролем" }),
  ).toBeInTheDocument();
  expect(await screen.findByText("Начислено за всё время")).toBeInTheDocument();
});
it("sends a selected spend amount through WebSocket and surfaces a busy station", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response(user)),
  );
  vi.mocked(connectStation).mockRejectedValue(
    new Error("Станция занята другим пользователем"),
  );
  open("/scan");
  fireEvent.change(await screen.findByLabelText("Код станции"), {
    target: { value: "station-01" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Продолжить с кодом станции" }),
  );
  fireEvent.click(screen.getByRole("radio", { name: /Списать баллы/ }));
  fireEvent.change(
    screen.getByLabelText("Сколько баллов списать?", { exact: false }),
    { target: { value: "75" } },
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Списать и подключиться" }),
  );
  await waitFor(() =>
    expect(connectStation).toHaveBeenCalledWith(
      expect.objectContaining({
        qr: "station-01",
        action: "spend",
        amount: 75,
        request_id: expect.any(String),
      }),
    ),
  );
  expect(
    await screen.findByText("Станция занята другим пользователем"),
  ).toBeInTheDocument();
});
