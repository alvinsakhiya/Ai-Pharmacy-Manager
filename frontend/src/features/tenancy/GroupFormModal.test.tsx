import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../lib/apiClient";
import { renderWithProviders } from "../../test/providers";
import { GroupFormModal } from "./GroupFormModal";
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

const createGroupMock = vi.mocked(tenancyApi.createGroup);
const updateGroupMock = vi.mocked(tenancyApi.updateGroup);

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

describe("GroupFormModal", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    createGroupMock.mockResolvedValue(makeGroup());
    updateGroupMock.mockResolvedValue(makeGroup());
  });

  it("create form submits createGroup with name, slug, and is_active", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <GroupFormModal group={null} isOpen onClose={vi.fn()} />,
    );

    await user.type(screen.getByLabelText("Name"), "South Group");
    await user.type(screen.getByLabelText("Slug"), "south-group");
    await user.click(screen.getByRole("button", { name: "Save group" }));

    await waitFor(() => {
      expect(createGroupMock).toHaveBeenCalledWith({
        name: "South Group",
        slug: "south-group",
        is_active: true,
      });
    });
  });

  it("duplicate slug backend 400 renders on slug field", async () => {
    createGroupMock.mockRejectedValue(
      new ApiError(400, {
        slug: ["A group with this slug already exists."],
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(
      <GroupFormModal group={null} isOpen onClose={vi.fn()} />,
    );

    await user.type(screen.getByLabelText("Name"), "South Group");
    await user.type(screen.getByLabelText("Slug"), "north-group");
    await user.click(screen.getByRole("button", { name: "Save group" }));

    expect(
      await screen.findByText("A group with this slug already exists."),
    ).toBeInTheDocument();
  });

  it("required-field validation works", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <GroupFormModal group={null} isOpen onClose={vi.fn()} />,
    );

    await user.click(screen.getByRole("button", { name: "Save group" }));

    expect(await screen.findByText("Name is required.")).toBeInTheDocument();
    expect(screen.getByText("Slug is required.")).toBeInTheDocument();
    expect(createGroupMock).not.toHaveBeenCalled();
  });

  it("edit form pre-fills existing group", () => {
    renderWithProviders(
      <GroupFormModal group={makeGroup()} isOpen onClose={vi.fn()} />,
    );

    expect(screen.getByLabelText("Name")).toHaveValue("North Group");
    expect(screen.getByLabelText("Slug")).toHaveValue("north-group");
    expect(screen.getByLabelText("Active")).toBeChecked();
  });

  it("edit submit calls updateGroup", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <GroupFormModal group={makeGroup()} isOpen onClose={vi.fn()} />,
    );

    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Updated Group");
    await user.click(screen.getByLabelText("Active"));
    await user.click(screen.getByRole("button", { name: "Save group" }));

    await waitFor(() => {
      expect(updateGroupMock).toHaveBeenCalledWith(1, {
        name: "Updated Group",
        slug: "north-group",
        is_active: false,
      });
    });
  });
});
