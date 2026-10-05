/** Recompute every audit hash. Exit code 2 if the chain is broken (wire into monitoring and the restore drill). */
import { verifyAuditChain } from "@/lib/audit/audit";
import { closeDb } from "@/lib/db/client";

verifyAuditChain()
  .then((r) => {
    if (r.ok) console.log(`audit chain intact: ${r.checked} entries`);
    else {
      console.error(`AUDIT CHAIN BROKEN at #${r.brokenAtId}: ${r.reason} (checked ${r.checked})`);
      process.exitCode = 2;
    }
  })
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
