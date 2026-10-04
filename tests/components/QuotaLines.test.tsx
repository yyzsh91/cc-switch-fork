import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QuotaLines } from "@/components/quota/QuotaLines";
import type { QuotaLine } from "@/components/quota/quotaRules";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const lines: QuotaLine[] = [
  {
    key: "weekly",
    text: "Weekly 58% left",
    detail: "Weekly 58% left · resets in 6d16h",
    tone: "normal",
    left: 58,
  },
];

describe("QuotaLines text refresh", () => {
  it("refreshes when the remaining quota text is clicked without bubbling to the card", () => {
    const onRefresh = vi.fn();
    const onCardClick = vi.fn();
    render(
      <div onClick={onCardClick}>
        <QuotaLines lines={lines} onRefresh={onRefresh} />
      </div>,
    );

    const button = screen.getByRole("button", { name: "Weekly 58% left" });
    expect(button.querySelector("svg")).not.toBeInTheDocument();
    expect(button.getAttribute("title")).toContain(lines[0].detail);
    fireEvent.click(screen.getByText("Weekly 58% left"));
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onCardClick).not.toHaveBeenCalled();
  });

  it("disables text refresh while the query is running", () => {
    const onRefresh = vi.fn();
    const { rerender } = render(
      <QuotaLines lines={lines} loading onRefresh={onRefresh} />,
    );
    const button = screen.getByRole("button", { name: "Weekly 58% left" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    fireEvent.click(button);
    fireEvent.click(button);
    expect(onRefresh).not.toHaveBeenCalled();

    rerender(<QuotaLines lines={lines} onRefresh={onRefresh} />);
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("keeps read-only quota and empty states free of buttons", () => {
    const { rerender } = render(<QuotaLines lines={lines} />);
    expect(screen.getByText("Weekly 58% left")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();

    rerender(<QuotaLines lines={[]} onRefresh={vi.fn()} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
