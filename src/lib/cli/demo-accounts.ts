/**
 * Demo accounts created by `npm run db:seed` for local development. One source
 * for the seed script and `npm run setup`, so the logins they print never drift.
 * The seed refuses to run in production.
 */
export const DEMO_PASSWORD = "demo passphrase for local dev";

export const DEMO_EMAIL = {
  admin: "admin@peerlink.local",
  mentor: "mentor@peerlink.local",
  student: "student@peerlink.local",
} as const;

/** The demo student every walkthrough follows. */
export const DEMO_STUDENT = { username: "raima_ruet", displayName: "Raima Ahmed" } as const;
