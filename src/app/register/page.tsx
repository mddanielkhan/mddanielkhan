import Link from "next/link";
import Script from "next/script";
import { redirect } from "next/navigation";
import { Form } from "@/components/form";
import { AuthShell } from "@/components/auth-shell";
import { Checkbox, Flash, Notice, TextField } from "@/components/ui";
import { cspNonce, getActor } from "@/lib/auth/current";
import { env } from "@/lib/env";
import { isPaused } from "@/lib/settings";
import { BRAND, MIN_AGE } from "@/lib/config/brand";
import type { SearchParams } from "@/lib/http/page";

export const metadata = { title: "Join" };

export default async function RegisterPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  if (await getActor()) redirect("/feed");
  const paused = await isPaused("registrations_paused");
  const siteKey = env().TURNSTILE_SITE_KEY;
  const nonce = await cspNonce();
  return (
    <AuthShell
      title={`Join ${BRAND.name}`}
      subtitle="Free, forever, for students. No phone number, no NID — just an email address."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-semibold">
            Log in
          </Link>
        </>
      }
    >
      <Flash searchParams={params} />
      {paused ? (
        <Notice tone="warn" title="Registrations are paused">
          New sign-ups are paused for a short while. Please check back soon.
        </Notice>
      ) : (
        <Form action="/api/auth/register" back="/register">
          <TextField label="Email" name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com" />
          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            <TextField label="Username" name="username" required minLength={3} maxLength={24} pattern="[a-z0-9_]{3,24}" autoComplete="username" placeholder="raima_ruet" hint="Lowercase letters, numbers and _. Shown publicly." />
            <TextField label="Display name" name="displayName" required minLength={2} maxLength={60} placeholder="Raima" hint="A nickname is fine — your legal name is never required." />
          </div>
          <TextField
            label="Password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={15}
            maxLength={128}
            hint="At least 15 characters. Easiest strong option: 3–4 random words, e.g. “mango river lantern cloud”."
          />
          <div className="mb-5 space-y-1 rounded-xl border border-line bg-subtle p-4">
            <Checkbox
              name="adult"
              required
              label={<>I am {MIN_AGE} or older.</>}
              description={<>For now the platform is adults-only: Bangladesh&apos;s Personal Data Protection Act 2026 requires verifiable guardian consent for anyone under 18, and we&apos;re building that properly first.</>}
            />
            <Checkbox
              name="accept"
              required
              label={
                <>
                  I accept the <Link href="/terms">Terms</Link>, <Link href="/privacy">Privacy Policy</Link> and <Link href="/guidelines">Community Guidelines</Link>.
                </>
              }
            />
          </div>
          {siteKey ? (
            <>
              <div className="cf-turnstile mb-4" data-sitekey={siteKey} />
              <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" nonce={nonce} />
            </>
          ) : null}
          <button className="btn btn-primary btn-lg w-full" type="submit">
            Create account
          </button>
        </Form>
      )}
    </AuthShell>
  );
}
