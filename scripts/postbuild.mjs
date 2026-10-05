// Assemble the standalone server: Next.js standalone output does not include static assets or /public.
import { cpSync, existsSync } from "node:fs";

const out = ".next/standalone";
if (!existsSync(out)) throw new Error("standalone output missing — is output: 'standalone' set?");
cpSync("public", `${out}/public`, { recursive: true });
cpSync(".next/static", `${out}/.next/static`, { recursive: true });
console.log("standalone assets copied");
