/**
 * Small, dependency-free terminal formatting for setup and diagnostics.
 * Respects NO_COLOR (https://no-color.org) and plain output when not a TTY.
 */
const useColor = !process.env.NO_COLOR && process.stdout.isTTY && process.env.TERM !== "dumb";
const paint = (code: string) => (s: string) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);

export const c = {
  bold: paint("1"),
  dim: paint("2"),
  green: paint("32"),
  yellow: paint("33"),
  red: paint("31"),
  cyan: paint("36"),
  brand: paint("38;5;29"),
};

export type Status = "ok" | "warn" | "fail" | "info" | "skip";
const MARK: Record<Status, string> = { ok: c.green("✓"), warn: c.yellow("!"), fail: c.red("✗"), info: c.cyan("•"), skip: c.dim("–") };

export function line(status: Status, label: string, detail?: string) {
  console.log(`  ${MARK[status]} ${label}${detail ? c.dim(` — ${detail}`) : ""}`);
}

export function heading(text: string) {
  console.log(`\n${c.bold(text)}`);
}

export function banner(title: string, subtitle?: string) {
  const width = Math.max(title.length, subtitle?.length ?? 0) + 4;
  const bar = "─".repeat(width);
  console.log(c.brand(`┌${bar}┐`));
  console.log(c.brand("│") + "  " + c.bold(title.padEnd(width - 2)) + c.brand("│"));
  if (subtitle) console.log(c.brand("│") + "  " + c.dim(subtitle.padEnd(width - 2)) + c.brand("│"));
  console.log(c.brand(`└${bar}┘`));
}

/** Render rows as an aligned two-or-more-column table. */
export function table(rows: string[][], indent = 4) {
  const widths = rows[0]!.map((_, i) => Math.max(...rows.map((r) => (r[i] ?? "").length)));
  for (const [i, r] of rows.entries()) {
    const text = r.map((cell, j) => (j === r.length - 1 ? cell : cell.padEnd(widths[j]! + 2))).join("");
    console.log(" ".repeat(indent) + (i === 0 ? c.dim(text) : text));
  }
}

export function fatal(message: string, hint?: string): never {
  console.error(`\n  ${c.red("✗")} ${c.bold(message)}`);
  if (hint) console.error(`    ${hint.split("\n").join("\n    ")}`);
  console.error("");
  process.exit(1);
}
