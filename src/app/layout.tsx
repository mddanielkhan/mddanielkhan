import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource-variable/noto-sans-bengali";
import "./globals.css";
import { getActor } from "@/lib/auth/current";
import { currentLocale } from "@/lib/i18n/locale";
import { unreadCount } from "@/lib/notify/notifications";
import { mentorStatusOf } from "@/lib/content/stats";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { BRAND } from "@/lib/config/brand";
import { t } from "@/lib/i18n/messages";
import { Form } from "@/components/form";
import { Icon, MailCheck } from "@/components/icons";

export const metadata: Metadata = {
  title: { default: `${BRAND.name} — verified student mentoring & community`, template: `%s · ${BRAND.name}` },
  description: BRAND.tagline,
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#111a16" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActor();
  const locale = await currentLocale(actor);
  const [unread, mentorStatus] = actor ? await Promise.all([unreadCount(actor.user.id), mentorStatusOf(actor.user.id)]) : [0, null];
  return (
    <html lang={locale}>
      <body className="flex min-h-screen flex-col overflow-x-clip">
        <Header actor={actor} locale={locale} unread={unread} mentorStatus={mentorStatus} />
        {actor && !actor.user.emailVerifiedAt ? (
          <div className="border-b border-[var(--color-warn-line)] bg-[var(--color-warn-bg)] text-[var(--color-warn-ink)]">
            <div className="container-app flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-sm">
              <span className="flex items-center gap-2 font-medium">
                <Icon icon={MailCheck} className="h-4 w-4" />
                {t(locale, "verify_banner")}
              </span>
              <Form action="/api/auth/resend-verification" className="inline">
                <button type="submit" className="btn btn-link text-sm text-[var(--color-warn-ink)] underline">
                  {t(locale, "resend")}
                </button>
              </Form>
              <Link href="/verify-email" className="font-semibold text-[var(--color-warn-ink)]">
                Help
              </Link>
            </div>
          </div>
        ) : null}
        <main id="main" className="container-app flex-1 py-8 sm:py-10">
          {children}
        </main>
        <Footer locale={locale} />
      </body>
    </html>
  );
}
