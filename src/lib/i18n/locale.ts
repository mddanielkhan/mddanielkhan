import "server-only";
import { cookies } from "next/headers";
import type { Actor } from "@/lib/policy/policy";
import { LOCALE_COOKIE } from "@/lib/account/account-service";
import type { Locale } from "./messages";

export async function currentLocale(actor: Actor): Promise<Locale> {
  if (actor?.user.locale === "bn" || actor?.user.locale === "en") return actor.user.locale;
  const c = (await cookies()).get(LOCALE_COOKIE)?.value;
  return c === "bn" ? "bn" : "en";
}
