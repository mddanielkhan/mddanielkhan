import { Form } from "./form";
import { TextField } from "./ui";

export function UserActionForm({ userId, back, reportId }: { userId: string; back: string; reportId?: string }) {
  return (
    <details className="inline-block">
      <summary className="btn btn-secondary cursor-pointer">Act on member…</summary>
      <div className="card mt-2 w-96 max-w-full p-3">
        <Form action="/api/mod/users/action" back={back}>
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="_back" value={back} />
          {reportId ? <input type="hidden" name="reportId" value={reportId} /> : null}
          <label className="mb-1 block text-sm font-medium" htmlFor={`act-${userId}-${reportId ?? ""}`}>
            Action
          </label>
          <select id={`act-${userId}-${reportId ?? ""}`} name="action" className="input mb-2">
            <option value="warn">Warn (no penalty)</option>
            <option value="strike">Strike (ladder: 7d restrict → 30d → 90d suspend → ban)</option>
            <option value="suspend">Suspend for N days</option>
            <option value="ban">Ban permanently</option>
            <option value="restore">Lift restrictions</option>
            <option value="unban">Unban</option>
          </select>
          <TextField label="Days (for suspend)" name="days" type="number" min={1} max={365} />
          <TextField label="Reason code" name="reasonCode" required maxLength={60} defaultValue="policy" />
          <TextField label="Message to the member (shown to them)" name="publicReason" required minLength={10} maxLength={500} />
          <TextField label="Internal note (staff only)" name="internalNote" maxLength={1000} />
          <label className="mb-3 flex items-center gap-2 text-sm">
            <input type="checkbox" name="fraud" /> Confirmed fraud (−50 reputation on ban)
          </label>
          <button className="btn btn-danger w-full" type="submit">
            Apply
          </button>
        </Form>
      </div>
    </details>
  );
}
