import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { profiles } from "@/lib/db/schema";
import { requireActor } from "@/lib/auth/current";
import { Form } from "@/components/form";
import { Checkbox, Flash, FormSection, PageHeader, SelectField, TextArea, TextField } from "@/components/ui";
import type { SearchParams } from "@/lib/http/page";

export const metadata = { title: "Settings", robots: { index: false } };

export default async function SettingsPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requireActor("/settings");
  const [p] = await db().select().from(profiles).where(eq(profiles.userId, actor.user.id));
  return (
    <>
      <PageHeader title="Profile" subtitle="What other members see. Keep it helpful — and never include contact or payment details." />
      <Flash searchParams={await searchParams} />
      <div className="card overflow-hidden px-5 sm:px-7">
        <Form action="/api/account/profile" back="/settings">
          <FormSection title="Public profile" description="Shown on your profile, posts and answers.">
            <TextField label="Display name" name="displayName" required minLength={2} maxLength={60} defaultValue={actor.user.displayName} />
            <TextField label="Headline" name="headline" maxLength={120} defaultValue={p?.headline} placeholder="CSE student at RUET · aiming for an MSc in Germany" optional />
            <TextArea label="About you" name="bio" maxLength={1500} rows={4} defaultValue={p?.bio} optional hint="No phone numbers, emails or payment details — bios with contact details are rejected to protect you from scammers." />
          </FormSection>
          <FormSection title="Background" description="Helps people give you advice that fits. All optional.">
            <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
              <TextField label="Institution" name="institution" maxLength={120} defaultValue={p?.institution} optional />
              <TextField label="Field of study" name="fieldOfStudy" maxLength={120} defaultValue={p?.fieldOfStudy} optional />
              <TextField label="City or district" name="location" maxLength={80} defaultValue={p?.location} optional hint="Keep it general — never your address." />
              <TextField label="Languages" name="languages" maxLength={120} defaultValue={p?.languages.join(", ")} placeholder="Bangla, English" optional />
              <TextField label="LinkedIn" name="linkedinUrl" type="url" maxLength={500} defaultValue={p?.linkedinUrl ?? ""} optional />
              <TextField label="Website" name="websiteUrl" type="url" maxLength={500} defaultValue={p?.websiteUrl ?? ""} optional />
            </div>
          </FormSection>
          <FormSection title="Privacy choices" description="Everything here is off unless you turn it on.">
            <SelectField
              label="Gender"
              name="gender"
              defaultValue={p?.gender ?? ""}
              optional
              options={[
                { value: "", label: "Prefer not to say" },
                { value: "woman", label: "Woman" },
                { value: "man", label: "Man" },
                { value: "non_binary", label: "Non-binary" },
                { value: "prefer_not", label: "Prefer not to say (explicitly)" },
              ]}
              hint="Only used if you choose to show it — for example, so students can find women mentors."
            />
            <Checkbox name="showGender" defaultChecked={p?.showGender} label="Show my gender on my profile" />
            <Checkbox name="allowSearchIndexing" defaultChecked={p?.allowSearchIndexing} label="Allow search engines to show my profile" description="Off by default. Your posts are public either way." />
          </FormSection>
          <FormSection title="Notifications & language" last>
            <Checkbox name="emailNotifications" defaultChecked={p?.emailNotifications ?? true} label="Email me about session requests, answers and moderation decisions" />
            <SelectField label="Language" name="locale" defaultValue={actor.user.locale} options={[{ value: "en", label: "English" }, { value: "bn", label: "বাংলা" }]} fieldClassName="mt-4 max-w-xs" />
          </FormSection>
          <div className="-mx-5 flex justify-end border-t border-line bg-subtle px-5 py-4 sm:-mx-7 sm:px-7">
            <button className="btn btn-primary" type="submit">
              Save profile
            </button>
          </div>
        </Form>
      </div>
    </>
  );
}
