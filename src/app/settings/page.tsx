import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { profiles } from "@/lib/db/schema";
import { requireActor } from "@/lib/auth/current";
import { Form } from "@/components/form";
import { SettingsNav } from "@/components/settings-nav";
import { Card, Checkbox, Flash, PageHeader, SelectField, TextArea, TextField } from "@/components/ui";
import type { SearchParams } from "@/lib/http/page";

export const metadata = { title: "Settings", robots: { index: false } };

export default async function SettingsPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requireActor("/settings");
  const [p] = await db().select().from(profiles).where(eq(profiles.userId, actor.user.id));
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Settings" />
      <SettingsNav current="profile" />
      <Flash searchParams={await searchParams} />
      <Card>
        <Form action="/api/account/profile" back="/settings">
          <TextField label="Display name" name="displayName" required minLength={2} maxLength={60} defaultValue={actor.user.displayName} />
          <TextField label="Headline" name="headline" maxLength={120} defaultValue={p?.headline} placeholder="CSE student at RUET · aiming for an MSc in Germany" />
          <TextArea label="About you" name="bio" maxLength={1500} rows={4} defaultValue={p?.bio} hint="No phone numbers, emails or payment details — bios with contact details are rejected to protect you from scammers." />
          <div className="grid gap-x-4 sm:grid-cols-2">
            <TextField label="Institution" name="institution" maxLength={120} defaultValue={p?.institution} />
            <TextField label="Field of study" name="fieldOfStudy" maxLength={120} defaultValue={p?.fieldOfStudy} />
            <TextField label="City / district (optional)" name="location" maxLength={80} defaultValue={p?.location} hint="Keep it general — never your address." />
            <TextField label="Languages" name="languages" maxLength={120} defaultValue={p?.languages.join(", ")} placeholder="Bangla, English" />
            <TextField label="LinkedIn (optional)" name="linkedinUrl" type="url" maxLength={500} defaultValue={p?.linkedinUrl ?? ""} />
            <TextField label="Website (optional)" name="websiteUrl" type="url" maxLength={500} defaultValue={p?.websiteUrl ?? ""} />
          </div>
          <SelectField
            label="Gender (optional)"
            name="gender"
            defaultValue={p?.gender ?? ""}
            options={[
              { value: "", label: "Prefer not to say" },
              { value: "woman", label: "Woman" },
              { value: "man", label: "Man" },
              { value: "non_binary", label: "Non-binary" },
              { value: "prefer_not", label: "Prefer not to say (explicitly)" },
            ]}
            hint="Only used if you choose to show it — e.g. so students can find women mentors."
          />
          <Checkbox name="showGender" defaultChecked={p?.showGender} label="Show my gender on my profile" />
          <Checkbox name="allowSearchIndexing" defaultChecked={p?.allowSearchIndexing} label="Allow search engines to show my profile (off by default)" />
          <Checkbox name="emailNotifications" defaultChecked={p?.emailNotifications ?? true} label="Email me about session requests, answers and moderation decisions" />
          <SelectField label="Language" name="locale" defaultValue={actor.user.locale} options={[{ value: "en", label: "English" }, { value: "bn", label: "বাংলা" }]} />
          <button className="btn btn-primary" type="submit">
            Save profile
          </button>
        </Form>
      </Card>
    </div>
  );
}
