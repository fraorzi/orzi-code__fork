import { render, screen } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { setupI18n } from "@lingui/core";
import { describe, expect, it } from "vitest";
import { messages } from "@/renderer/locales/en/messages.po";
import type { AuxiliaryUsageSummary } from "@/shared/auxiliaryUsage";
import { AuxiliaryUsage } from "./AuxiliaryUsage";

function show(items: AuxiliaryUsageSummary[] | undefined) {
  const i18n = setupI18n({ locale: "en", messages: { en: messages } });
  render(
    <I18nProvider i18n={i18n}>
      <AuxiliaryUsage items={items} />
    </I18nProvider>,
  );
}

describe("AuxiliaryUsage report coverage", () => {
  it("shows measured zero separately from unavailable tokens and partial coverage", () => {
    show([
      {
        operation: "title",
        runs: 2,
        failedRuns: 1,
        runsWithTokenReports: 1,
        runsWithCostReports: 1,
        reportedTokens: 10,
        reportedCostUsd: 0.03,
      },
      {
        operation: "commit",
        runs: 1,
        failedRuns: 0,
        runsWithTokenReports: 1,
        runsWithCostReports: 1,
        reportedTokens: 0,
        reportedCostUsd: 0,
      },
      { operation: "pr", runs: 1, failedRuns: 0, runsWithTokenReports: 0, runsWithCostReports: 0 },
    ]);
    expect(screen.getAllByText("Runs: 1")).toHaveLength(2);
    expect(screen.getByText(/^10 reported tokens/)).toBeInTheDocument();
    expect(screen.getByText(/^0 reported tokens/)).toBeInTheDocument();
    expect(screen.getByText("Tokens not reported")).toBeInTheDocument();
    expect(screen.getByText(/Runs with reports: 1\/2/)).toBeInTheDocument();
    expect(screen.getByText(/Failed: 1/)).toBeInTheDocument();
    expect(screen.getByText(/^\$0.03 reported cost/)).toBeInTheDocument();
    expect(screen.getByText(/^\$0 reported cost/)).toBeInTheDocument();
    expect(screen.getByText("Cost not reported")).toBeInTheDocument();
    expect(screen.getByText(/Runs with cost reports: 1\/2/)).toBeInTheDocument();
  });

  it("handles a previous-version host response without the optional field", () => {
    show(undefined);
    expect(screen.getByText("Utility usage is unavailable from this host.")).toBeInTheDocument();
  });

  it("does not invent historical usage for an empty log", () => {
    show([]);
    expect(screen.getByText("No utility generations recorded yet.")).toBeInTheDocument();
  });
});
