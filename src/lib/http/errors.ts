/**
 * Known, user-presentable failures. Anything else is an unexpected error that is
 * logged with a reference id and shown to the user generically (OWASP A10:2025 —
 * never leak internals, never fail open).
 */
export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly status = 400,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "AppError";
  }
}

export const notFound = () => new AppError("not_found", 404);
export const forbidden = (code = "forbidden") => new AppError(code, 403);
export const conflict = (code: string) => new AppError(code, 409);
export const badRequest = (code: string) => new AppError(code, 400);
export const rateLimited = () => new AppError("rate_limited", 429);
