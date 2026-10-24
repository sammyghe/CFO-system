// Fictional civic issue. The ward office, budget and contractor are invented
// for the game and do not represent any real institution.

export type IssueStatus = "open" | "reported" | "verified" | "assigned" | "in_progress" | "resolved";

export interface IssueEvent {
  status: IssueStatus;
  at: number;
  note: string;
}

export interface CivicIssue {
  id: string;
  title: string;
  status: IssueStatus;
  reporters: string[];
  timeline: IssueEvent[];
  /** Fictional budget in simulated UGX. */
  budget: number;
}

export const REPORTS_TO_VERIFY = 3;
export const OFFICE_NAME = "Ward 7 Works Office (fictional)";

/** Seconds between stages once verified. Short so a player sees the fix in one session. */
export const STAGE_DELAYS: Partial<Record<IssueStatus, number>> = {
  verified: 30,
  assigned: 60,
  in_progress: 180,
};

const NEXT: Partial<Record<IssueStatus, IssueStatus>> = {
  verified: "assigned",
  assigned: "in_progress",
  in_progress: "resolved",
};

const NOTES: Record<IssueStatus, string> = {
  open: "Pothole on the main road",
  reported: "Residents reported it",
  verified: "Enough reports. The ward office verified the damage",
  assigned: "Assigned to a road crew. Fictional budget: UGX 1,200,000",
  in_progress: "Crew on site. Cones are out",
  resolved: "Patched. Check the road and rate the work",
};

export function newPothole(): CivicIssue {
  return { id: "pothole-main-1", title: "Pothole outside the pharmacy", status: "open", reporters: [], timeline: [], budget: 1_200_000 };
}

export type ReportResult = { ok: true; issue: CivicIssue } | { ok: false; error: "already_reported" | "closed" };

export function report(issue: CivicIssue, reporterId: string, at: number): ReportResult {
  if (issue.status === "resolved") return { ok: false, error: "closed" };
  if (issue.reporters.includes(reporterId)) return { ok: false, error: "already_reported" };
  issue.reporters.push(reporterId);
  if (issue.status === "open") push(issue, "reported", at);
  if (issue.reporters.length >= REPORTS_TO_VERIFY && issue.status === "reported") push(issue, "verified", at);
  return { ok: true, issue };
}

/** Moves the issue forward based on elapsed time. Safe to call every frame. */
export function advance(issue: CivicIssue, now: number): boolean {
  let changed = false;
  for (;;) {
    const next = NEXT[issue.status];
    const delay = STAGE_DELAYS[issue.status];
    const last = issue.timeline[issue.timeline.length - 1];
    if (!next || delay === undefined || !last) break;
    const due = last.at + delay * 1000;
    if (now < due) break;
    push(issue, next, due);
    changed = true;
  }
  return changed;
}

export function secondsToNextStage(issue: CivicIssue, now: number): number | null {
  const delay = STAGE_DELAYS[issue.status];
  const last = issue.timeline[issue.timeline.length - 1];
  if (delay === undefined || !last) return null;
  return Math.max(0, Math.ceil((last.at + delay * 1000 - now) / 1000));
}

function push(issue: CivicIssue, status: IssueStatus, at: number) {
  issue.status = status;
  issue.timeline.push({ status, at, note: NOTES[status] });
}
