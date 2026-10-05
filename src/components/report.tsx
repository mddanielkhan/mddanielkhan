import { Form } from "./form";
import { REASON_LABELS } from "@/lib/reports/service";
import { Flag, Icon } from "./icons";

/** Native <details> disclosure: no JavaScript needed to report something. */
export function ReportControl({
  targetType,
  targetId,
  back,
  align = "left",
}: {
  targetType: "post" | "answer" | "user" | "booking" | "feedback" | "booking_message";
  targetId: string;
  back: string;
  align?: "left" | "right";
}) {
  return (
    <details className="relative inline-block text-sm">
      <summary className="btn btn-ghost btn-sm text-muted">
        <Icon icon={Flag} />
        Report
      </summary>
      <div className={`popover ${align === "right" ? "right-0" : "left-0"}`}>
        <p className="mb-1 text-sm font-bold text-ink">Report this {targetType === "booking_message" ? "message" : targetType === "user" ? "member" : targetType}</p>
        <p className="mb-3 text-xs leading-relaxed text-muted">Scam and safety reports are reviewed first. Reports are confidential — the member is not told who reported them.</p>
        <Form action="/api/reports" back={back}>
          <input type="hidden" name="targetType" value={targetType} />
          <input type="hidden" name="targetId" value={targetId} />
          <input type="hidden" name="_back" value={back} />
          <label className="label text-sm" htmlFor={`reason-${targetId}`}>
            What&apos;s wrong?
          </label>
          <select id={`reason-${targetId}`} name="reason" className="input mb-3" required>
            {Object.entries(REASON_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <label className="label text-sm" htmlFor={`details-${targetId}`}>
            Details <span className="label-optional">Optional</span>
          </label>
          <textarea id={`details-${targetId}`} name="details" className="input mb-3" rows={3} maxLength={1000} placeholder="What happened? Include what you were asked to do." />
          <button type="submit" className="btn btn-danger w-full">
            Send report
          </button>
          <p className="mt-2 text-xs text-muted">False or malicious reports are a guideline violation.</p>
        </Form>
      </div>
    </details>
  );
}
