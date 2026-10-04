import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  RequestLogTable,
  appShortName,
  formatLogTime,
} from "@/components/usage/RequestLogTable";
import type { RequestLog, UsageRangeSelection } from "@/types/usage";

const useRequestLogsMock = vi.hoisted(() => vi.fn());

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (
      key: string,
      options?: {
        defaultValue?: string;
      },
    ) => options?.defaultValue ?? key,
    i18n: {
      resolvedLanguage: "en",
      language: "en",
    },
  }),
}));

vi.mock("@/lib/query/usage", () => ({
  useRequestLogs: (args: unknown) => useRequestLogsMock(args),
}));

describe("RequestLogTable", () => {
  beforeEach(() => {
    useRequestLogsMock.mockReset();
    useRequestLogsMock.mockImplementation(
      ({ page = 0, pageSize = 20 }: { page?: number; pageSize?: number }) => ({
        data: {
          data: [],
          total: 120,
          page,
          pageSize,
        },
        isLoading: false,
      }),
    );
  });

  it("jumps to the typed page only when the jump button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <RequestLogTable range={{ preset: "today" }} refreshIntervalMs={0} />,
    );
    const input = screen.getByRole("textbox", {
      name: "usage.pageInputPlaceholder",
    });
    const jump = screen.getByRole("button", { name: "usage.goToPage" });
    expect(jump).toBeDisabled();

    await user.clear(input);
    await user.type(input, "5");
    expect(jump).toBeEnabled();
    fireEvent.blur(input);
    expect(useRequestLogsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 0 }),
    );
    await user.click(jump);

    expect(useRequestLogsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 4 }),
    );
    expect(input).toHaveValue("5");
    expect(jump).toBeDisabled();
  });

  it("supports Enter to jump and Escape to discard a page draft", () => {
    render(
      <RequestLogTable range={{ preset: "today" }} refreshIntervalMs={0} />,
    );
    const input = screen.getByRole("textbox", {
      name: "usage.pageInputPlaceholder",
    });
    fireEvent.change(input, { target: { value: "6" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(useRequestLogsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 5 }),
    );
    expect(
      screen.getByRole("button", { name: "usage.nextPage" }),
    ).toBeDisabled();

    fireEvent.change(input, { target: { value: "2" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input).toHaveValue("6");
    expect(
      screen.getByRole("button", { name: "usage.goToPage" }),
    ).toBeDisabled();
    expect(useRequestLogsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 5 }),
    );
  });

  it.each(["", "0", "-1", "7", "1.5", "abc", "1e2", "999999999999999999999"])(
    "rejects invalid or out-of-range page input %j",
    (value) => {
      render(
        <RequestLogTable range={{ preset: "today" }} refreshIntervalMs={0} />,
      );
      const input = screen.getByRole("textbox", {
        name: "usage.pageInputPlaceholder",
      });
      fireEvent.change(input, { target: { value } });
      expect(input).toHaveAttribute("aria-invalid", "true");
      expect(
        screen.getByRole("button", { name: "usage.goToPage" }),
      ).toBeDisabled();
      fireEvent.keyDown(input, { key: "Enter" });
      expect(useRequestLogsMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 0 }),
      );
    },
  );

  it("clears an uncommitted draft when navigating with the arrows", () => {
    render(
      <RequestLogTable range={{ preset: "today" }} refreshIntervalMs={0} />,
    );
    const input = screen.getByRole("textbox", {
      name: "usage.pageInputPlaceholder",
    });
    fireEvent.change(input, { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "usage.nextPage" }));
    expect(input).toHaveValue("2");
    expect(useRequestLogsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1 }),
    );

    fireEvent.change(input, { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "usage.prevPage" }));
    expect(input).toHaveValue("1");
    expect(useRequestLogsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 0 }),
    );
  });

  it("resets pagination when the dashboard range changes", async () => {
    const initialRange: UsageRangeSelection = { preset: "today" };
    const nextRange: UsageRangeSelection = {
      preset: "custom",
      customStartDate: 1_710_000_000,
      customEndDate: 1_710_086_400,
    };

    const { rerender } = render(
      <RequestLogTable
        range={initialRange}
        rangeLabel="Today"
        appType="all"
        refreshIntervalMs={0}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "usage.nextPage" }));

    await waitFor(() => {
      expect(useRequestLogsMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 1,
          range: initialRange,
        }),
      );
    });

    rerender(
      <RequestLogTable
        range={nextRange}
        rangeLabel="Custom"
        appType="all"
        refreshIntervalMs={0}
      />,
    );

    await waitFor(() => {
      expect(useRequestLogsMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 0,
          range: nextRange,
        }),
      );
    });
  });

  it("resets pagination when the dashboard app filter changes", async () => {
    const range: UsageRangeSelection = { preset: "today" };
    const { rerender } = render(
      <RequestLogTable
        range={range}
        rangeLabel="Today"
        appType="all"
        refreshIntervalMs={0}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "usage.nextPage" }));

    await waitFor(() => {
      expect(useRequestLogsMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 1,
          range,
        }),
      );
    });

    rerender(
      <RequestLogTable
        range={range}
        rangeLabel="Today"
        appType="claude"
        refreshIntervalMs={0}
      />,
    );

    await waitFor(() => {
      expect(useRequestLogsMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 0,
          range,
        }),
      );
    });
  });

  it("shows exact speed for routed requests and an estimate for timed session logs", () => {
    const base = {
      providerId: "p1",
      providerName: "DeepSeek",
      appType: "codex",
      model: "deepseek-v4-pro",
      costMultiplier: "1",
      inputTokens: 1_000,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      inputCostUsd: "0",
      outputCostUsd: "0",
      cacheReadCostUsd: "0",
      cacheCreationCostUsd: "0",
      totalCostUsd: "0.0114",
      isStreaming: true,
      statusCode: 200,
      createdAt: 1_759_212_000,
    };
    useRequestLogsMock.mockReturnValue({
      data: {
        data: [
          // 1100 token / (12.9 - 1.8) s ≈ 99 tok/s
          {
            ...base,
            requestId: "fast",
            outputTokens: 1_100,
            latencyMs: 12_900,
            firstTokenMs: 1_800,
          },
          // 输出不到 100：不算
          {
            ...base,
            requestId: "short",
            outputTokens: 64,
            latencyMs: 2_400,
            firstTokenMs: 1_900,
          },
          // 会话日志：没有首字，也没估出耗时
          {
            ...base,
            requestId: "session",
            outputTokens: 900,
            latencyMs: 0,
            dataSource: "codex_session",
          },
          // 会话日志：按估算耗时算，900 token / 10 s = 90 tok/s，带 ≈
          {
            ...base,
            requestId: "session-estimated",
            outputTokens: 900,
            latencyMs: 10_000,
            dataSource: "codex_session",
          },
        ],
        total: 4,
        page: 0,
        pageSize: 20,
      },
      isLoading: false,
    });
    const onOpenDetail = vi.fn();

    render(
      <RequestLogTable
        range={{ preset: "7d" }}
        refreshIntervalMs={0}
        onOpenDetail={onOpenDetail}
      />,
    );

    const rows = screen.getAllByRole("row").slice(1);
    expect(rows).toHaveLength(4);
    expect(rows[0].children[6]).toHaveTextContent("12.9s/1.8s");
    expect(rows[1].children[6]).toHaveTextContent("2.4s/1.9s");
    expect(rows[2].children[6]).toHaveTextContent("—");
    expect(rows[3].children[6]).toHaveTextContent("≈10.0s/—");
    expect(
      screen.getByRole("columnheader", { name: "usage.timingInfo" }),
    ).toBeInTheDocument();
    expect(rows[0].lastElementChild).toHaveTextContent("99tok/s");
    expect(rows[0].lastElementChild).toHaveAttribute(
      "title",
      "usage.timingTip",
    );
    expect(rows[1].lastElementChild).toHaveTextContent("—");
    expect(rows[2].lastElementChild).toHaveTextContent("—");
    expect(rows[3].lastElementChild).toHaveTextContent("≈90tok/s");
    expect(rows[3].lastElementChild).toHaveAttribute(
      "title",
      "usage.estimatedTimingTip",
    );
    expect(
      screen.getByRole("columnheader", { name: /usage.speed/ }),
    ).toBeInTheDocument();

    fireEvent.click(rows[1]);
    expect(onOpenDetail).toHaveBeenCalledWith("short");
  });

  it("shows full cache counts below fresh input without double-counting Codex input", () => {
    const base: RequestLog = {
      requestId: "claude-cache",
      providerId: "p1",
      providerName: "Codex subscription",
      appType: "claude",
      model: "gpt-6.1-sol",
      costMultiplier: "1",
      inputTokens: 2_195,
      outputTokens: 1_543,
      cacheReadTokens: 600_960,
      cacheCreationTokens: 1_024,
      inputCostUsd: "0",
      outputCostUsd: "0",
      cacheReadCostUsd: "0",
      cacheCreationCostUsd: "0",
      totalCostUsd: "0.28",
      latencyMs: 46_300,
      firstTokenMs: 7_000,
      isStreaming: true,
      statusCode: 200,
      createdAt: Math.floor(Date.now() / 1000),
    };
    useRequestLogsMock.mockReturnValue({
      data: {
        data: [
          base,
          {
            ...base,
            requestId: "codex-cache",
            appType: "codex",
            inputTokens: 603_155,
            cacheCreationTokens: 0,
          },
          { ...base, requestId: "write-only", cacheReadTokens: 0 },
        ],
        total: 3,
      },
      isLoading: false,
    });

    render(
      <RequestLogTable range={{ preset: "today" }} refreshIntervalMs={0} />,
    );

    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0].children[4].firstElementChild).toHaveTextContent("2,195");
    expect(rows[0].children[4]).toHaveTextContent("R600,960");
    expect(rows[0].children[4]).toHaveTextContent("W1,024");
    expect(rows[0].children[6]).toHaveTextContent("46.3s/7.0s");
    expect(rows[1].children[4].firstElementChild).toHaveTextContent("2,195");
    expect(rows[1].children[4]).toHaveTextContent("R600,960");
    expect(rows[1].children[4]).not.toHaveTextContent("W");
    expect(rows[2].children[4]).toHaveTextContent("W1,024");
    expect(rows[2].children[4]).not.toHaveTextContent("R");
    expect(rows[0].children).toHaveLength(9);
  });

  it("keeps missing timings distinct from zero and supports stored duration", () => {
    const base: RequestLog = {
      requestId: "missing",
      providerId: "p1",
      appType: "claude",
      model: "model",
      costMultiplier: "1",
      inputTokens: 10,
      outputTokens: 10,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      inputCostUsd: "0",
      outputCostUsd: "0",
      cacheReadCostUsd: "0",
      cacheCreationCostUsd: "0",
      totalCostUsd: "0",
      latencyMs: 0,
      isStreaming: false,
      statusCode: 200,
      createdAt: Math.floor(Date.now() / 1000),
    };
    useRequestLogsMock.mockReturnValue({
      data: {
        data: [
          base,
          { ...base, requestId: "no-ttft", latencyMs: 4_400 },
          {
            ...base,
            requestId: "zero-ttft",
            latencyMs: 3_800,
            firstTokenMs: 0,
          },
          {
            ...base,
            requestId: "duration",
            durationMs: 23_800,
            firstTokenMs: 9_500,
          },
          {
            ...base,
            requestId: "zero-duration",
            durationMs: 0,
            latencyMs: 5_500,
          },
          {
            ...base,
            requestId: "estimated-small-output",
            latencyMs: 4_000,
            dataSource: "codex_session",
          },
        ],
        total: 6,
      },
      isLoading: false,
    });

    render(
      <RequestLogTable range={{ preset: "today" }} refreshIntervalMs={0} />,
    );

    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0].children[6]).toHaveTextContent("—");
    expect(rows[0].children[4]).not.toHaveTextContent(/[RW]/);
    expect(rows[1].children[6]).toHaveTextContent("4.4s/—");
    expect(rows[2].children[6]).toHaveTextContent("3.8s/0.0s");
    expect(rows[3].children[6]).toHaveTextContent("23.8s/9.5s");
    expect(rows[4].children[6]).toHaveTextContent("5.5s/—");
    expect(rows[5].children[6]).toHaveTextContent("≈4.0s/—");
    expect(rows[5].lastElementChild).toHaveTextContent("—");
  });

  it("shows full provider names on hover and short app names in the app column", () => {
    useRequestLogsMock.mockReturnValue({
      data: {
        data: [
          {
            requestId: "r1",
            providerId: "p1",
            providerName: "Kimi For Coding Plan Provider",
            appType: "claude",
            model: "kimi-k2.6",
            costMultiplier: "1",
            inputTokens: 10,
            outputTokens: 10,
            cacheReadTokens: 0,
            cacheCreationTokens: 0,
            inputCostUsd: "0",
            outputCostUsd: "0",
            cacheReadCostUsd: "0",
            cacheCreationCostUsd: "0",
            totalCostUsd: "0",
            isStreaming: false,
            statusCode: 200,
            latencyMs: 0,
            createdAt: Math.floor(Date.now() / 1000),
          },
        ],
        total: 1,
        page: 0,
        pageSize: 20,
      },
      isLoading: false,
    });

    render(
      <RequestLogTable range={{ preset: "today" }} refreshIntervalMs={0} />,
    );

    expect(
      screen.getByTitle("Kimi For Coding Plan Provider"),
    ).toHaveTextContent("Kimi For Coding Plan Provider");
    // 应用列：短名 + 全名在悬停提示和读屏文字里
    const appCell = screen.getByTitle("Claude Code");
    expect(appCell).toHaveTextContent("Claude");
    expect(appShortName("claude-desktop")).toBe("Desktop");
    expect(appShortName("unknown-app")).toBe("unknown-app");
  });
});

describe("formatLogTime", () => {
  const at = (
    y: number,
    m: number,
    d: number,
    h: number,
    mi: number,
    s: number,
  ) => Math.floor(new Date(y, m - 1, d, h, mi, s).getTime() / 1000);

  it("shows only the clock (with seconds) for requests from today in local time", () => {
    const now = new Date(2026, 9, 2, 18, 0, 0);
    expect(formatLogTime(at(2026, 10, 2, 14, 32, 5), now)).toBe("14:32:05");
    expect(formatLogTime(at(2026, 10, 2, 0, 0, 1), now)).toBe("00:00:01");
  });

  it("keeps the date for requests from other days", () => {
    const now = new Date(2026, 9, 2, 0, 30, 0);
    expect(formatLogTime(at(2026, 10, 1, 23, 59, 59), now)).toBe("10-01 23:59");
    // 同月同日但不同年也不算今天
    expect(formatLogTime(at(2025, 10, 2, 9, 5, 0), now)).toBe("10-02 09:05");
  });
});
