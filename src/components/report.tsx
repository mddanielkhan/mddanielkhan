import { Form } from "./form";
import { REASON_LABELS } from "@/lib/reports/service";

/** Native <details> disclosure: no JavaScript needed to report something. */
export function ReportControl({ targetType, targetId, back }: { targetType: "post" | "answer" | "user" | "booking" | "feedback" | "booking_message"; targetId: string; back: string }) {
  return (
    <details className="inline-block text-sm">
      <summary className="muted cursor-pointer select-none">Report</summary>
      <div className="card mt-2 w-72 p-3">
        <Form action="/api/reports" back={back}>
          <input type="hidden" name="targetType" value={targetType} />
          <input type="hidden" name="targetId" value={targetId} />
          <input type="hidden" name="_back" value={back} />
          <label className="mb-1 block text-sm font-medium" htmlFor={`reason-${targetId}`}>
            What&apos;s wrong?
          </label>
          <select id={`reason-${targetId}`} name="reason" className="input mb-2" required>
            {Object.entries(REASON_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <textarea name="details" className="input mb-2" rows={3} maxLength={1000} placeholder="Optional details (what happened?)" />
          <button type="submit" className="btn btn-danger w-full">
            Send report
          </button>
          <p className="muted mt-2 text-xs">Scam and safety reports are reviewed first. False reports are a guideline violation.</p>
        </Form>
      </div>
    </details>
  );
}
