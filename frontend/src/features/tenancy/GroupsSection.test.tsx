import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  makeAuthContext,
  makeAuthUser,
  renderWithProviders,
} from "../../test/providers";
import { GroupsSection } from "./GroupsSection";
import type { Group } from "./tenancyApi";
import * as tenancyApi from "./tenancyApi";

vi.mock("./tenancyApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./tenancyApi")>();
  return {
    ...actual,
    listGroups: vi.fn(),
    createGroup: vi.fn(),
    updateGroup: vi.fn(),
  };
});

const listGroupsMock = vi.mocked(tenancyApi.listGroups);

function makeGroup(overrides: Partial<Group> = {}): Group {
  return {
    id: 1,
    name: "North Group",
    slug: "north-group",
    is_active: true,
    created_at: "2026-06-17T09:00:00Z",
    updated_at: "2026-06-17T09:00:00Z",
    ...overrides,
  };
}

function tenancyAuth(canManageGroups = true) {
  return makeAuthContext({
    user: makeAuthUser({
      permissions: {
        "group.manage": canManageGroups,
        "pharmacy.manage": true,
      },
    }),
  });
}

describe("GroupsSection", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    listGroupsMock.mockResolvedValue([makeGroup()]);
  });

  it("renders group rows", async () => {
    renderWithProviders(<GroupsSection />, { auth: tenancyAuth() });

    expect(await screen.findByText("North Group")).toBeInTheDocument();
    expect(screen.getByText("north-group")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("renders empty state", async () => {
    listGroupsMock.mockResolvedValue([]);

    renderWithProviders(<GroupsSection />, { auth: tenancyAuth() });

    expect(await screen.findByText("No groups yet.")).toBeInTheDocument();
  });

  it("renders error state", async () => {
    listGroupsMock.mockRejectedValue(new Error("Nope"));

    renderWithProviders(<GroupsSection />, { auth: tenancyAuth() });

    expect(await screen.findByText("Could not load groups.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("shows create group button with group.manage", async () => {
    renderWithProviders(<GroupsSection />, { auth: tenancyAuth() });

    expect(
      await screen.findByRole("button", { name: "Create group" }),
    ).toBeInTheDocument();
  });

  it("hides create group button without group.manage", async () => {
    renderWithProviders(<GroupsSection />, { auth: tenancyAuth(false) });

    expect(await screen.findByText("North Group")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create group" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });

  it("opens the create modal", async () => {
    const user = userEvent.setup();
    renderWithProviders(<GroupsSection />, { auth: tenancyAuth() });

    await user.click(await screen.findByRole("button", { name: "Create group" }));

    expect(screen.getByRole("dialog", { name: "Create group" })).toBeInTheDocument();
  });
});
