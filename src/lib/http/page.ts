export type SearchParams = Promise<Record<string, string | string[] | undefined>>;
export type Params<T extends string> = Promise<Record<T, string>>;

export function sp(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" ? v : undefined;
}
