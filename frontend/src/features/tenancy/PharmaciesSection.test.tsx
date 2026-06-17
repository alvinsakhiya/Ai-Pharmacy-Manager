import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  makeAuthContext,
  makeAuthUser,
  renderWithProviders,
} from "../../test/providers";
import { PharmaciesSection } from "./PharmaciesSection";
import type { Group, Pharmacy } from "./tenancyApi";
import * as tenancyApi from "./tenancyApi";

vi.mock("./tenancyApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./tenancyApi")>();
  return {
    ...actual,
    listGroups: vi.fn(),
    createGroup: vi.fn(),
    updateGroup: vi.fn(),
    listPharmacies: vi.fn(),
    createPharmacy: vi.fn(),
    updatePharmacy: vi.fn(),
  };
});

const listGroupsMock = vi.mocked(tenancyApi.listGroups);
const listPharmaciesMock = vi.mocked(tenancyApi.listPharmacies);

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

function makePharmacy(overrides: Partial<Pharmacy> = {}): Pharmacy {
  return {
    id: 10,
    group: 1,
    name: "Central Pharmacy",
    code: "CP1",
    address: "1 High Street",
    postcode: "AB1 2CD",
    is_active: true,
    created_at: "2026-06-17T09:00:00Z",
    updated_at: "2026-06-17T09:00:00Z",
    ...overrides,
  };
}

function tenancyAuth(canManagePharmacies = true) {
  return makeAuthContext({
    user: makeAuthUser({
      permissions: {
        "group.manage": true,
        "pharmacy.manage": canManagePharmacies,
      },
    }),
  });
}

describe("PharmaciesSection", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    listGroupsMock.mockResolvedValue([makeGroup()]);
    listPharmaciesMock.mockResolvedValue([makePharmacy()]);
  });

  it("renders pharmacy rows", async () => {
    renderWithProviders(<PharmaciesSection />, { auth: tenancyAuth() });

    expect(await screen.findByText("Central Pharmacy")).toBeInTheDocument();
    expect(screen.getByText("CP1")).toBeInTheDocument();
    expect(screen.getByText("AB1 2CD")).toBeInTheDocument();
  });

  it("maps group name from group id using groups data", async () => {
    renderWithProviders(<PharmaciesSection />, { auth: tenancyAuth() });

    expect(await screen.findByText("North Group")).toBeInTheDocument();
  });

  it("renders empty state", async () => {
    listPharmaciesMock.mockResolvedValue([]);

    renderWithProviders(<PharmaciesSection />, { auth: tenancyAuth() });

    expect(await screen.findByText("No pharmacies yet.")).toBeInTheDocument();
  });

  it("renders error state", async () => {
    listPharmaciesMock.mockRejectedValue(new Error("Nope"));

    renderWithProviders(<PharmaciesSection />, { auth: tenancyAuth() });

    expect(
      await screen.findByText("Could not load pharmacies."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("shows create pharmacy button with pharmacy.manage", async () => {
    renderWithProviders(<PharmaciesSection />, { auth: tenancyAuth() });

    expect(
      await screen.findByRole("button", { name: "Create pharmacy" }),
    ).toBeInTheDocument();
  });

  it("hides create pharmacy button without pharmacy.manage", async () => {
    renderWithProviders(<PharmaciesSection />, { auth: tenancyAuth(false) });

    expect(await screen.findByText("Central Pharmacy")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create pharmacy" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });

  it("opens the create modal", async () => {
    const user = userEvent.setup();
    renderWithProviders(<PharmaciesSection />, { auth: tenancyAuth() });

    await user.click(
      await screen.findByRole("button", { name: "Create pharmacy" }),
    );

    expect(
      screen.getByRole("dialog", { name: "Create pharmacy" }),
    ).toBeInTheDocument();
  });
});
