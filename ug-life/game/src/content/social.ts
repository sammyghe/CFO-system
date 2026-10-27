// Rules for friends, private messages and the weekly chairperson election.

export const DM_MAX = 200;
export const DMS_PER_DAY = 300;
export const FRIENDS_MAX = 100;
export const CANDIDATE_MIN_LEVEL = 3;
export const SLOGAN_MAX = 60;

/** Election week key on Kampala time, e.g. "2026-W44" (Monday to Sunday). */
export function weekKey(now: number): string {
  const d = new Date(now + 3 * 3600_000);
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  const thursday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day + 3));
  const firstThursday = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((thursday.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function lastWeekKey(now: number) {
  return weekKey(now - 7 * 86_400_000);
}

export interface Friend {
  id: string;
  name: string;
  /** friends = both accepted; incoming = they asked you; outgoing = you asked them. */
  status: "friends" | "incoming" | "outgoing";
  unread: number;
  online: boolean;
  area?: string;
}

export interface DirectMessage {
  id: string;
  from: string;
  to: string;
  body: string;
  at: number;
}

export interface Election {
  week: string;
  area: string;
  candidates: { id: string; name: string; slogan: string; votes: number }[];
  myVote: string | null;
  /** Last week's winner, the chairperson now. */
  chair: { id: string; name: string; votes: number } | null;
}
