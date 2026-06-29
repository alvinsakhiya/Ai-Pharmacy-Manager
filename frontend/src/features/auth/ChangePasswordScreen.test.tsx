import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { AuthContext, type AuthContextValue } from "../../auth/AuthContext";
import { ChangePasswordScreen } from "./ChangePasswordScreen";

function renderChangePassword() {
  const auth: AuthContextValue = {
    user: null,
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
    changePassword: vi.fn(),
    refreshMe: vi.fn(),
  };

  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter>
        <ChangePasswordScreen />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe("ChangePasswordScreen", () => {
  it("names the brand once and keeps the logo mark decorative", () => {
    renderChangePassword();

    // The visible wordmark carries the brand name.
    expect(screen.getByText("AI Pharmacy Manager")).toBeInTheDocument();

    // The adjacent logo mark must not duplicate the brand announcement.
    expect(
      screen.queryByRole("img", { name: /AI Pharmacy Manager/i }),
    ).toBeNull();
  });
});
