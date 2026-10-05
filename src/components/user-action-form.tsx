import { Form } from "./form";
import { TextField } from "./ui";
import { Gavel, Icon } from "./icons";

export function UserActionForm({ userId, back, reportId }: { userId: string; back: string; reportId?: string }) {
  const sel = `act-${userId}-${reportId ?? "x"}`;
  return (
    <details className="relative inline-block">
      <summary className="btn btn-secondary btn-sm">
        <Icon icon={Gavel} />
        Act on member…
      </summary>
      <div className="popover right-0 w-[min(26rem,calc(100vw-2rem))] sm:left-0 sm:right-auto">
        <p className="mb-3 text-sm font-bold text-ink">Act on this member</p>
        <Form action="/api/mod/users/action" back={back}>
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="_back" value={back} />
          {reportId ? <input type="hidden" name="reportId" value={reportId} /> : null}
          <label className="label text-sm" htmlFor={sel}>
            Action
          </label>
          <select id={sel} name="action" className="input mb-4">
            <option value="warn">Warn (no penalty)</option>
            <option value="strike">Strike (ladder: 7d restrict → 30d → 90d suspend → ban)</option>
            <option value="suspend">Suspend for N days</option>
            <option value="ban">Ban permanently</option>
            <option value="restore">Lift restrictions</option>
            <option value="unban">Unban</option>
          </select>
          <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
            <TextField id={`${sel}-days`} label="Days (for suspend)" name="days" type="number" min={1} max={365} />
            <TextField id={`${sel}-code`} label="Reason code" name="reasonCode" required maxLength={60} defaultValue="policy" />
          </div>
          <TextField id={`${sel}-public`} label="Message to the member" name="publicReason" required minLength={10} maxLength={500} hint="Shown to them, and the basis of any appeal." />
          <TextField id={`${sel}-note`} label="Internal note" name="internalNote" maxLength={1000} optional hint="Staff only." />
          <label className="choice mb-4 text-sm">
            <input type="checkbox" name="fraud" />
            <span>Confirmed fraud (−50 reputation on ban)</span>
          </label>
          <button className="btn btn-danger w-full" type="submit">
            Apply action
          </button>
        </Form>
      </div>
    </details>
  );
}
