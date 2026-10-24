// Street Snaps: players photograph real Kampala streets, the phone turns them into
// street art, and approved snaps go up on the community board and the billboard.
// Areas with the most snaps are first in line to be built as new neighbourhoods.

import { post } from "./ledger";
import { kampalaDateKey } from "./time";
import { checkDisplayName } from "./moderation";
import { complete, type Result } from "./actions";
import type { PlayerState } from "./state";

export const SNAP_REWARD = 1_000;
export const SNAP_XP = 15;
export const SNAPS_PER_DAY = 5;

export const AREAS = [
  "Wandegeya", "Kikoni", "Makerere", "Kamwokya", "Nakasero", "Kampala Road", "Owino / St. Balikuddembe", "Kisenyi",
  "Ntinda", "Kansanga", "Kabalagala", "Bukoto", "Kololo", "Najjera", "Mukono", "Entebbe", "Nairobi", "Other",
] as const;

export interface SnapMeta {
  id: string;
  area: string;
  place: string;
  createdAt: number;
  width: number;
  height: number;
  /** local = only on this phone; queued = waiting to upload; pending/approved/rejected = online status */
  status: "local" | "queued" | "pending" | "approved" | "rejected";
  reason?: string;
}

export function checkSnapDetails(area: string, place: string): { ok: true; place: string } | { ok: false; reason: string } {
  if (!(AREAS as readonly string[]).includes(area)) return { ok: false, reason: "Pick the area from the list." };
  const p = checkDisplayName(place.length > 20 ? place.slice(0, 20) : place);
  if (!p.ok) return { ok: false, reason: place.trim().length < 2 ? "Name the place, e.g. Wandegeya market." : p.reason };
  return { ok: true, place: p.value };
}

/** Pays the once-a-day snap reward. */
export function rewardSnap(state: PlayerState, now: number): Result {
  complete(state, "snap");
  const r = post(state.ledger, `snap:${kampalaDateKey(now)}`, SNAP_REWARD, "Street snap", now);
  if (!r.ok) return { ok: true, message: "Snap saved. The daily snap reward is already paid today." };
  state.xp += SNAP_XP;
  return { ok: true, message: `Snap saved. +UGX ${SNAP_REWARD.toLocaleString()}` };
}
