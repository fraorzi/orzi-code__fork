import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppProvider } from "@/renderer/components/ui/provider";
import { MarkdownPreview } from "@/renderer/views/FileEditorOverlay/parts/MarkdownPreview";
import ItemMarkdownInner from "./ItemMarkdownInner";

const surfaces = [
  { name: "chat", content: (text: string) => <ItemMarkdownInner text={text} /> },
  { name: "file preview", content: (text: string) => <MarkdownPreview content={text} /> },
];

describe.each(surfaces)("$name math rendering", ({ content }) => {
  function renderMarkdown(text: string) {
    return render(<AppProvider>{content(text)}</AppProvider>);
  }

  it("typesets dollar inline and display math", () => {
    const { container } = renderMarkdown(
      "Your forward operation is $Z=XW$ for image $i$.\n\n$$\n\\frac{\\partial L}{\\partial W}\n$$\n",
    );
    expect(container.querySelectorAll(".katex").length).toBeGreaterThanOrEqual(3);
    expect(container.querySelector(".katex-display")).not.toBeNull();
    expect(container.textContent).not.toContain("$Z=XW$");
  });

  it("keeps dollar amounts from swallowing prose, emphasis, and links", () => {
    const { container } = renderMarkdown(
      "Nie wiem, czy poszło z kredytu 300$, czy z karty. Wejdź na konto testowe, potem **Billing** i **Credits** ([konsola](https://console.cloud.google.com/billing)), i sprawdź pozostałe 300$.",
    );
    expect(container.querySelector(".katex")).toBeNull();
    expect(container.textContent).toContain("300$, czy z karty. Wejdź na konto testowe");
    expect(
      [...container.querySelectorAll('[data-streamdown="strong"]')].map((node) => node.textContent),
    ).toEqual(["Billing", "Credits"]);
    expect(
      container.querySelector('a[href="https://console.cloud.google.com/billing"]'),
    ).not.toBeNull();
  });

  it.each([
    "Credit $300, then pay $20 per month.",
    "Prices range from $10-$20.",
    "Credit 300 $, then pay 20 $.",
    "Spend $5/month and keep $10.",
  ])("leaves currency in ordinary Markdown: %s", (text) => {
    const { container } = renderMarkdown(text);
    expect(container.querySelector(".katex")).toBeNull();
    expect(container.textContent).toContain(text);
  });

  it("renders equations alongside currency without matching dollars across them", () => {
    const { container } = renderMarkdown(
      "Credit $300, compute $2 + 2 = 4$ and $x^2$, then pay 20$.",
    );
    expect(container.querySelectorAll(".katex")).toHaveLength(2);
    expect(container.textContent).toContain("Credit $300, compute");
    expect(container.textContent).toContain("then pay 20$.");
  });

  it("keeps currency readable while its paragraph streams", () => {
    const text = "Credit 300$, open **Billing** and check the remaining 20$.";
    const { container, rerender } = renderMarkdown("");
    for (let length = 1; length <= text.length; length++) {
      rerender(<AppProvider>{content(text.slice(0, length))}</AppProvider>);
      expect(container.querySelector(".katex"), `prefix length ${length}`).toBeNull();
    }
    expect(container.querySelector('[data-streamdown="strong"]')?.textContent).toBe("Billing");
    expect(container.textContent).toContain("300$, open");
  });

  it("typesets LaTeX inline and display delimiters", () => {
    const { container } = renderMarkdown(
      "Weight \\(W_{dj}\\) changes \\(Z_{ij}\\).\n\n\\[\n\\frac{\\partial L}{\\partial W_{dj}}\n\\]\n",
    );
    expect(container.querySelectorAll(".katex-html").length).toBeGreaterThanOrEqual(3);
    expect(container.querySelector(".katex-display .katex-html")).not.toBeNull();
  });

  it("leaves an unclosed display opener as text", () => {
    const { container } = renderMarkdown(
      "Before \\[ \\frac{1}{2} still open\n\nAfter the formula.",
    );
    expect(container.querySelector(".katex")).toBeNull();
    expect(container.textContent).toContain("After the formula.");
    expect(container.textContent).toContain("still open");
  });

  it("does not typeset math inside fenced or inline code", () => {
    const { container } = renderMarkdown(
      "```text\n$Z=XW$\n\\[ \\frac{1}{2} \\]\n```\n\nOutside $i$ and `$not math$`.\n",
    );
    const code = container.querySelector("pre");
    expect(code?.textContent).toContain("$Z=XW$");
    expect(code?.textContent).toContain("\\frac{1}{2}");
    expect(code?.querySelector(".katex")).toBeNull();
    expect(container.textContent).toContain("$not math$");
    expect(container.querySelectorAll(".katex")).toHaveLength(1);
  });

  it("typesets a math fence as display math", () => {
    const { container } = renderMarkdown("```math\n\\frac{\\partial L}{\\partial W}\n```\n");
    expect(container.querySelector(".katex-display")).not.toBeNull();
    expect(container.querySelector("pre")).toBeNull();
  });

  it("keeps an escaped bracket escape as text", () => {
    const { container } = renderMarkdown("See \\\\[1\\\\] for the note.");
    expect(container.querySelector(".katex")).toBeNull();
    expect(container.textContent).toContain("\\[1\\]");
  });

  it("typesets one reply that mixes both delimiter dialects", () => {
    const { container } = renderMarkdown(
      [
        "Your forward operation is $Z=XW$. For image \\(i\\) and class \\(j\\):",
        "",
        "$$",
        "Z_{ij}=\\sum_d X_{id}W_{dj}.",
        "$$",
        "",
        "Changing weight \\(W_{dj}\\) changes $Z_{ij}$ at rate $X_{id}$.",
        "",
        "\\[",
        "\\frac{\\partial L}{\\partial W_{dj}}=\\sum_i X_{id}\\frac{\\partial L}{\\partial Z_{ij}}.",
        "\\]",
      ].join("\n"),
    );
    expect(container.querySelectorAll(".katex-display")).toHaveLength(2);
    expect(container.querySelectorAll(".katex")).toHaveLength(8);
    expect(container.textContent).not.toContain("$Z=XW$");
  });

  it("keeps malformed math from hiding the rest of the message", () => {
    const { container } = renderMarkdown(
      "Before $\\frac{1}{$.\n\nAfter the formula, valid math $x^2$ still renders.",
    );
    expect(container.querySelector(".katex-error")).not.toBeNull();
    expect(container.textContent).toContain("After the formula");
    expect(container.querySelectorAll(".katex")).toHaveLength(1);
  });

  it("keeps raw HTML sanitized and untrusted math commands disabled", () => {
    const { container } = renderMarkdown(
      '<img src="x" onerror="alert(1)"><script>alert(1)</script>\n\n$\\href{javascript:alert(1)}{click}$ and $x^2$.',
    );
    expect(container.querySelector("script, [onerror], a[href^='javascript:']")).toBeNull();
    expect(container.querySelectorAll(".katex")).toHaveLength(2);
  });

  it.each([
    ["dollar", "$$\n\\frac{1}{2}", "\n$$"],
    ["LaTeX", "\\[\n\\frac{1}{2}", "\n\\]"],
  ])("typesets %s display math when the closing delimiter arrives", (_, opening, closing) => {
    const prefix = `An inline equation $x^2$.\n\n${opening}`;
    const { container, rerender } = renderMarkdown(prefix);
    expect(container.textContent).toContain("An inline equation");

    rerender(<AppProvider>{content(`${prefix}${closing}\n\nAfter the formula.`)}</AppProvider>);

    expect(container.querySelectorAll(".katex-display")).toHaveLength(1);
    expect(container.querySelectorAll(".katex")).toHaveLength(2);
    expect(container.textContent).toContain("After the formula.");
  });
});
