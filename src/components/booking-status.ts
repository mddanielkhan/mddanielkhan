export const STATUS_LABEL: Record<string, { label: string; tone: "neutral" | "brand" | "warn" | "danger" | "info" }> = {
  requested: { label: "Requested", tone: "info" },
  accepted: { label: "Confirmed", tone: "brand" },
  declined: { label: "Declined", tone: "neutral" },
  expired: { label: "Expired", tone: "neutral" },
  cancelled_by_mentee: { label: "Cancelled by student", tone: "neutral" },
  cancelled_by_mentor: { label: "Cancelled by mentor", tone: "warn" },
  completed: { label: "Completed", tone: "brand" },
  no_show_mentor: { label: "Mentor didn't show", tone: "danger" },
  no_show_mentee: { label: "Student didn't show", tone: "warn" },
  disputed: { label: "Under review", tone: "warn" },
};
