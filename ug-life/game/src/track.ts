// Product analytics: event names only, counted per day on our own server
// (/api/track). No personal data, no third-party tracker. The data agent builds
// the Monday digest from these counts.
export type EventName =
  | "age_confirmed" | "onboarded" | "session_start" | "job_accepted" | "job_completed" | "kiosk_leased"
  | "kiosk_painted" | "upgrade_bought" | "pothole_reported" | "card_shared" | "ticket_saved" | "snap_made" | "snap_uploaded" | "visitor_viewed"
  | "boda_taken" | "ride_done" | "rolex_bought" | "food_bought" | "yard_built" | "goal_claimed" | "landmark_found";

const buffer: { name: string; props?: Record<string, unknown>; at: number }[] = [];

export function track(name: string, props?: Record<string, unknown>) {
  buffer.push({ name, props, at: Date.now() });
  if (buffer.length > 200) {
    buffer.shift();
    sent = Math.max(0, sent - 1);
  }
  if (import.meta.env.DEV) console.debug("[track]", name, props ?? "");
}

export function trackedEvents() {
  return buffer.slice();
}

let sent = 0;
/** Event names not yet sent to the server's daily counters. */
export function drainEventNames(): string[] {
  const out = buffer.slice(sent).map((e) => e.name);
  sent = buffer.length;
  return out;
}
