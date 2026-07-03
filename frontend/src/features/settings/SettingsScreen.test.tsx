import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../lib/apiClient";
import { renderWithProviders } from "../../test/providers";
import * as settingsApi from "./settingsApi";
import { SettingsScreen } from "./SettingsScreen";

vi.mock("./settingsApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./settingsApi")>();
  return {
    ...actual,
    getBackupSchedule: vi.fn(),
    updateBackupSchedule: vi.fn(),
    listBackupRuns: vi.fn(),
    runBackupNow: vi.fn(),
    restoreBackup: vi.fn(),
  };
});

const getBackupScheduleMock = vi.mocked(settingsApi.getBackupSchedule);
const updateBackupScheduleMock = vi.mocked(settingsApi.updateBackupSchedule);
const listBackupRunsMock = vi.mocked(settingsApi.listBackupRuns);
const runBackupNowMock = vi.mocked(settingsApi.runBackupNow);
const restoreBackupMock = vi.mocked(settingsApi.restoreBackup);

const backupSchedule: settingsApi.BackupSchedule = {
  id: 1,
  group: 1,
  group_name: "JMW Pharmacy Group",
  enabled: true,
  daily_time: "02:00:00",
  retention_count: 3,
  scheduler_note: "Scheduled backups run when the scheduler command is active.",
  created_at: "2026-06-29T08:00:00Z",
  updated_at: "2026-06-29T08:00:00Z",
};

const backupRuns: settingsApi.BackupRun[] = [
  {
    id: 11,
    group: 1,
    group_name: "JMW Pharmacy Group",
    status: "SUCCESS",
    trigger: "MANUAL",
    file: "jmw/backup-11.zip",
    file_size: 2048,
    started_at: "2026-06-29T09:00:00Z",
    completed_at: "2026-06-29T09:01:00Z",
    error_message: "",
    checksum: "abc",
    created_at: "2026-06-29T09:00:00Z",
    updated_at: "2026-06-29T09:01:00Z",
  },
  {
    id: 10,
    group: 1,
    group_name: "JMW Pharmacy Group",
    status: "SUCCESS",
    trigger: "SCHEDULED",
    file: "jmw/backup-10.zip",
    file_size: 4096,
    started_at: "2026-06-28T02:00:00Z",
    completed_at: "2026-06-28T02:01:00Z",
    error_message: "",
    checksum: "def",
    created_at: "2026-06-28T02:00:00Z",
    updated_at: "2026-06-28T02:01:00Z",
  },
  {
    id: 9,
    group: 1,
    group_name: "JMW Pharmacy Group",
    status: "SUCCESS",
    trigger: "SCHEDULED",
    file: "jmw/backup-9.zip",
    file_size: 8192,
    started_at: "2026-06-27T02:00:00Z",
    completed_at: "2026-06-27T02:01:00Z",
    error_message: "",
    checksum: "ghi",
    created_at: "2026-06-27T02:00:00Z",
    updated_at: "2026-06-27T02:01:00Z",
  },
];

describe("SettingsScreen", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    window.localStorage.clear();
    document.documentElement.className = "";
    document.documentElement.style.fontSize = "";
    getBackupScheduleMock.mockResolvedValue(backupSchedule);
    updateBackupScheduleMock.mockResolvedValue(backupSchedule);
    listBackupRunsMock.mockResolvedValue(backupRuns);
    runBackupNowMock.mockResolvedValue(backupRuns[0]);
    restoreBackupMock.mockResolvedValue({ ...backupRuns[0], status: "RESTORED" });
  });

  afterEach(() => {
    document.documentElement.className = "";
    document.documentElement.style.fontSize = "";
  });

  it("renders the accessibility controls", () => {
    renderWithProviders(<SettingsScreen />);
    expect(
      screen.getByRole("heading", { name: "Settings", exact: true }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Appearance" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("heading", { name: "Accessibility" }).length,
    ).toBeGreaterThan(0);
    expect(screen.getByLabelText("Settings hub")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Motion" })).toBeInTheDocument();
    expect(
      screen.getByRole("radiogroup", { name: "Contrast" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radiogroup", { name: "Text size" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radiogroup", { name: "Focus visibility" }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Colour vision mode"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("switch", { name: "Reduce motion" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("switch", { name: "Dyslexia-friendly spacing" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("heading", { name: "Backup & restore" }).length,
    ).toBeGreaterThan(0);
  });

  it("shows real backup controls and latest retained runs", async () => {
    renderWithProviders(<SettingsScreen />);

    expect(await screen.findByLabelText("Daily backup time")).toHaveValue(
      "02:00",
    );
    await waitFor(() => {
      expect(screen.getByRole("switch", { name: "Enable daily backups" }))
        .toHaveAttribute("aria-checked", "true");
    });
    expect(screen.getByText("Retention keeps the latest 3 files."))
      .toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Run backup now" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Restore" })).toHaveLength(3);
  });

  it("requires typed confirmation before restoring a backup", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsScreen />);

    await user.click((await screen.findAllByRole("button", { name: "Restore" }))[0]);
    expect(screen.getByLabelText("Type RESTORE to confirm")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Restore selected backup" }),
    ).toBeDisabled();

    await user.type(screen.getByLabelText("Type RESTORE to confirm"), "RESTORE");
    await user.click(
      screen.getByRole("button", { name: "Restore selected backup" }),
    );

    expect(restoreBackupMock.mock.calls[0]?.[0]).toBe(11);
  });

  it("shows an error state when backup history cannot be loaded", async () => {
    listBackupRunsMock.mockRejectedValue(new Error("unavailable"));

    renderWithProviders(<SettingsScreen />);

    expect(
      await screen.findByText(
        "Could not load the backup history. Reload the page or try again later.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("No backups have been created for this group yet."),
    ).toBeNull();
  });

  it("shows a message when a manual backup fails to run", async () => {
    const user = userEvent.setup();
    runBackupNowMock.mockRejectedValue(new Error("unavailable"));

    renderWithProviders(<SettingsScreen />);

    await user.click(
      await screen.findByRole("button", { name: "Run backup now" }),
    );

    expect(
      await screen.findByText("The backup did not run. Please try again."),
    ).toBeInTheDocument();
  });

  it("surfaces a failed restore with the backend reason", async () => {
    const user = userEvent.setup();
    restoreBackupMock.mockRejectedValue(
      new ApiError(400, { detail: "Selected backup has no archive file." }),
    );

    renderWithProviders(<SettingsScreen />);

    await user.click(
      (await screen.findAllByRole("button", { name: "Restore" }))[0],
    );
    await user.type(screen.getByLabelText("Type RESTORE to confirm"), "RESTORE");
    await user.click(
      screen.getByRole("button", { name: "Restore selected backup" }),
    );

    expect(
      await screen.findByText("Selected backup has no archive file."),
    ).toBeInTheDocument();
  });

  it("does not offer restore for runs without a usable archive", async () => {
    listBackupRunsMock.mockResolvedValue([
      {
        ...backupRuns[0],
        id: 12,
        status: "FAILED",
        file: "",
        file_size: 0,
      },
      backupRuns[1],
    ]);

    renderWithProviders(<SettingsScreen />);

    expect(await screen.findAllByRole("button", { name: "Restore" })).toHaveLength(
      1,
    );
  });

  it("enables high contrast and persists it", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsScreen />);

    await user.click(screen.getByRole("radio", { name: "High" }));

    await waitFor(() => {
      expect(document.documentElement.classList.contains("contrast-high")).toBe(
        true,
      );
    });
    expect(window.localStorage.getItem("apm.preferences")).toContain("high");
  });

  it("applies a larger text scale", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsScreen />);

    await user.click(screen.getByRole("radio", { name: "Extra large" }));

    await waitFor(() => {
      expect(document.documentElement.style.fontSize).toBe("125%");
    });
  });

  it("toggles reduce motion on and off", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsScreen />);

    const toggle = screen.getByRole("switch", { name: "Reduce motion" });
    expect(toggle).toHaveAttribute("aria-checked", "false");

    await user.click(toggle);
    await waitFor(() => {
      expect(document.documentElement.classList.contains("reduce-motion")).toBe(
        true,
      );
    });
    expect(toggle).toHaveAttribute("aria-checked", "true");
  });

  it("applies enhanced focus, colour vision, and dyslexia spacing preferences", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsScreen />);

    await user.click(screen.getByRole("radio", { name: "Enhanced" }));
    await user.selectOptions(
      screen.getByLabelText("Colour vision mode"),
      "deuteranopia",
    );
    await user.click(
      screen.getByRole("switch", { name: "Dyslexia-friendly spacing" }),
    );

    await waitFor(() => {
      expect(document.documentElement.classList.contains("focus-enhanced")).toBe(
        true,
      );
      expect(
        document.documentElement.classList.contains("colour-deuteranopia"),
      ).toBe(true);
      expect(
        document.documentElement.classList.contains("dyslexia-spacing"),
      ).toBe(true);
    });
    expect(window.localStorage.getItem("apm.preferences")).toContain(
      "deuteranopia",
    );
  });

  it("renders printer preferences with label paper options", () => {
    renderWithProviders(<SettingsScreen />);

    expect(
      screen.getByRole("heading", { name: "Printer preferences" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Default paper size")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "A4" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "A5" })).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "4x6 label" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "72x36 label" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Orientation")).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Portrait" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Landscape" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Label printer note")).toBeInTheDocument();
  });

  it("persists printer preferences and resets to defaults", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsScreen />);

    await user.selectOptions(screen.getByLabelText("Default paper size"), "a5");
    await user.selectOptions(screen.getByLabelText("Orientation"), "landscape");
    await user.selectOptions(screen.getByLabelText("Print scale"), "actual");
    await user.selectOptions(screen.getByLabelText("Default copies"), "3");
    await user.selectOptions(
      screen.getByLabelText("Default output type"),
      "stock_label",
    );
    await user.type(screen.getByLabelText("Label printer note"), "Zebra ZD230");

    await waitFor(() => {
      const stored = window.localStorage.getItem("apm.preferences");
      expect(stored).toContain("a5");
      expect(stored).toContain("landscape");
      expect(stored).toContain("actual");
      expect(stored).toContain("stock_label");
      expect(stored).toContain("Zebra ZD230");
    });

    await user.click(screen.getByRole("button", { name: "Reset to defaults" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Default paper size")).toHaveValue("a4");
      expect(screen.getByLabelText("Orientation")).toHaveValue("portrait");
      expect(screen.getByLabelText("Print scale")).toHaveValue("fit");
      expect(screen.getByLabelText("Default copies")).toHaveValue("1");
      expect(screen.getByLabelText("Default output type")).toHaveValue(
        "dosette_tray",
      );
      expect(screen.getByLabelText("Label printer note")).toHaveValue("");
    });
  });
});
