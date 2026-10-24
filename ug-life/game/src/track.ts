// Product analytics hook. In this build events stay in memory (and the dev
// console). When PostHog is switched on, send them from here; the data agent
// builds the Monday digest from these event names.
export type EventName =
  | "age_confirmed" | "onboarded" | "session_start" | "job_accepted" | "job_completed" | "kiosk_leased"
  | "kiosk_painted" | "upgrade_bought" | "pothole_reported" | "card_shared" | "ticket_saved";

const buffer: { name: string; props?: Record<string, unknown>; at: number }[] = [];

export function track(name: string, props?: Record<string, unknown>) {
  buffer.push({ name, props, at: Date.now() });
  if (buffer.length > 200) buffer.shift();
  if (import.meta.env.DEV) console.debug("[track]", name, props ?? "");
}

export function trackedEvents() {
  return buffer.slice();
}
