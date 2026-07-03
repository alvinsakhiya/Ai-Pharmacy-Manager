import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as authApi from "../auth/authApi";
import { redirectToLogin, reloadPage } from "../lib/navigation";
import { ErrorBoundary } from "./ErrorBoundary";

vi.mock("../auth/authApi", () => ({
  logout: vi.fn(),
}));

vi.mock("../lib/navigation", () => ({
  redirectToLogin: vi.fn(),
  reloadPage: vi.fn(),
}));

const logoutMock = vi.mocked(authApi.logout);
const reloadPageMock = vi.mocked(reloadPage);
const redirectToLoginMock = vi.mocked(redirectToLogin);

function Bomb(): never {
  throw new Error("internal database column patient_dob leaked");
}

function renderCrashed() {
  // React logs caught render errors to the console in test builds; keep the
  // test output clean without asserting on it.
  vi.spyOn(console, "error").mockImplementation(() => undefined);

  return render(
    <ErrorBoundary>
      <Bomb />
    </ErrorBoundary>,
  );
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("renders children when nothing fails", () => {
    render(
      <ErrorBoundary>
        <p>Healthy content</p>
      </ErrorBoundary>,
    );

    expect(screen.getByText("Healthy content")).toBeInTheDocument();
  });

  it("shows a recovery screen without exposing error internals", () => {
    const { container } = renderCrashed();

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Something went wrong.")).toBeInTheDocument();
    expect(container.textContent).not.toContain("patient_dob");
    expect(container.textContent).not.toContain("Error");
    expect(container.textContent).not.toContain(" at ");
  });

  it("offers a page reload", async () => {
    const user = userEvent.setup();
    renderCrashed();

    await user.click(screen.getByRole("button", { name: "Reload page" }));

    expect(reloadPageMock).toHaveBeenCalledTimes(1);
  });

  it("offers sign out that ends the session and returns to login", async () => {
    const user = userEvent.setup();
    logoutMock.mockResolvedValue(undefined);
    renderCrashed();

    await user.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => {
      expect(redirectToLoginMock).toHaveBeenCalledTimes(1);
    });
    expect(logoutMock).toHaveBeenCalledTimes(1);
  });

  it("returns to login even when the logout call fails", async () => {
    const user = userEvent.setup();
    logoutMock.mockRejectedValue(new Error("network down"));
    renderCrashed();

    await user.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => {
      expect(redirectToLoginMock).toHaveBeenCalledTimes(1);
    });
  });
});
