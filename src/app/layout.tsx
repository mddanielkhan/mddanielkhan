import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { getActor } from "@/lib/auth/current";
import { currentLocale } from "@/lib/i18n/locale";
import { unreadCount } from "@/lib/notify/notifications";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { BRAND } from "@/lib/config/brand";
import { t } from "@/lib/i18n/messages";
import { ActionButton } from "@/components/form";

export const metadata: Metadata = {
  title: { default: `${BRAND.name} — verified student mentoring & community`, template: `%s · ${BRAND.name}` },
  description: BRAND.tagline,
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#157a46" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActor();
  const locale = await currentLocale(actor);
  const unread = actor ? await unreadCount(actor.user.id) : 0;
  return (
    <html lang={locale}>
      <body className="min-h-screen">
        <Header actor={actor} locale={locale} unread={unread} />
        {actor && !actor.user.emailVerifiedAt ? (
          <div className="bg-[var(--color-warn-bg)] text-[var(--color-warn-ink)]">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-2 text-sm">
              <span>{t(locale, "verify_banner")}</span>
              <ActionButton action="/api/auth/resend-verification" variant="link">
                {t(locale, "resend")}
              </ActionButton>
              <Link href="/verify-email">Help</Link>
            </div>
          </div>
        ) : null}
        <main id="main" className="mx-auto max-w-6xl px-4 py-8">
          {children}
        </main>
        <Footer locale={locale} />
      </body>
    </html>
  );
}
