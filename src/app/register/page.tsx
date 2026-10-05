import Link from "next/link";
import Script from "next/script";
import { redirect } from "next/navigation";
import { Form } from "@/components/form";
import { Card, Checkbox, Flash, Notice, TextField } from "@/components/ui";
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
    <div className="mx-auto max-w-lg">
      <h1 className="mb-2 text-2xl font-bold">Join {BRAND.name}</h1>
      <p className="muted mb-6">Free, forever, for students. Ask questions, find verified opportunities and book free sessions with verified mentors.</p>
      <Flash searchParams={params} />
      {paused ? (
        <Notice tone="warn">New registrations are paused for a short while. Please check back soon.</Notice>
      ) : (
        <Card>
          <Form action="/api/auth/register" back="/register">
            <TextField label="Email" name="email" type="email" autoComplete="email" required maxLength={254} />
            <TextField label="Username" name="username" required minLength={3} maxLength={24} pattern="[a-z0-9_]{3,24}" autoComplete="username" hint="Lowercase letters, numbers and _ only. Shown publicly." />
            <TextField label="Display name" name="displayName" required minLength={2} maxLength={60} hint="You can use a nickname — your legal name is never required to take part." />
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
            <Checkbox name="adult" required label={<>I am {MIN_AGE} or older.</>} />
            <p className="muted -mt-2 mb-3 ml-6 text-sm">
              During this first phase the platform is for adults only. Bangladesh&apos;s Personal Data Protection Act 2026 requires verifiable guardian consent for anyone under 18; we are building that properly before opening to younger students.
            </p>
            <Checkbox
              name="accept"
              required
              label={
                <>
                  I accept the <Link href="/terms">Terms</Link>, <Link href="/privacy">Privacy Policy</Link> and <Link href="/guidelines">Community Guidelines</Link>.
                </>
              }
            />
            {siteKey ? (
              <>
                <div className="cf-turnstile mb-4" data-sitekey={siteKey} />
                <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" nonce={nonce} />
              </>
            ) : null}
            <button className="btn btn-primary w-full" type="submit">
              Create account
            </button>
          </Form>
          <p className="mt-4 text-sm">
            Already have an account? <Link href="/login">Log in</Link>
          </p>
        </Card>
      )}
    </div>
  );
}
