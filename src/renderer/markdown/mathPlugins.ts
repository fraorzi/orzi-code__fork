import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math-extended";
import type { Pluggable, PluggableList, Plugin } from "unified";

/**
 * Both dialects models emit. Single `$` is on because replies use `$Z=XW$`.
 * `backslashDelimiters` accepts `\(...\)` and `\[…\]`. An opening `\[` without
 * a closer stays ordinary Markdown instead of swallowing the rest of the message.
 */
const chatMathOptions = {
  singleDollarTextMath: true,
  backslashDelimiters: true,
} as const;

/**
 * Reject currency before Markdown consumes it as math, so emphasis and links
 * between amounts still parse normally. Single-dollar delimiters must touch
 * their content; an opener after a digit or a closer before one is currency.
 * Double-dollar and backslash math retain the upstream tokenizer unchanged.
 */
export const chatRemarkMath: Plugin = function () {
  remarkMath.call(this, chatMathOptions);
  const dollar = this.data().micromarkExtensions?.at(-1)?.text?.[36];
  for (const construct of Array.isArray(dollar) ? dollar : dollar ? [dollar] : []) {
    const tokenize = construct.tokenize;
    construct.tokenize = function (effects, ok, nok) {
      const previous = this.previous;
      return tokenize.call(
        this,
        effects,
        (code) => {
          const token = this.events.at(-1)?.[1];
          const source = token ? this.sliceSerialize(token) : "";
          if (
            !source.startsWith("$$") &&
            ((previous !== null && previous >= 48 && previous <= 57) ||
              (code !== null && code >= 48 && code <= 57) ||
              /^\$\s|\s\$$/u.test(source))
          ) {
            return nok(code);
          }
          return ok(code);
        },
        nok,
      );
    };
  }
};

/** After sanitize, so KaTeX's generated markup is not stripped. */
const chatRehypeKatex: Pluggable = rehypeKatex;

export function withChatMathRehype(plugins: PluggableList): PluggableList {
  if (plugins.includes(chatRehypeKatex)) return plugins;
  return [...plugins, chatRehypeKatex];
}
