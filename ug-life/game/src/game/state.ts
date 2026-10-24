import { emptyLedger, type Ledger } from "./ledger";
import { newPothole, type CivicIssue } from "./civic";
import type { Platform } from "./moderation";

export const SAVE_VERSION = 1;

export interface Social {
  platform: Platform;
  handle: string;
  /** Becomes true only after signing in to that platform (needs the online backend). */
  verified: boolean;
}

export interface Look {
  skin: string;
  shirt: string;
  hair: "short" | "bun" | "braids" | "cap";
  pants: string;
}

export interface Job {
  id: string;
  fromId: string;
  toId: string;
  item: string;
  pay: number;
  stage: "pickup" | "dropoff";
  acceptedAt: number;
}

export interface Kiosk {
  plotId: string;
  name: string;
  color: string;
  product: string;
  leasedAt: number;
  leasedUntil: number;
  upgrades: string[];
  /** Kampala date key of the last day income was collected for. */
  collectedThrough: string | null;
}

export interface Ticket {
  id: string;
  category: "how-to" | "bug" | "account" | "safety" | "other";
  text: string;
  at: number;
  /** saved = only on this phone; sent = delivered to support */
  status: "saved" | "sent";
}

export type GoalId = "walk" | "delivery" | "earn25" | "kiosk" | "paint" | "share" | "pothole" | "profile" | "snap" | "boda" | "rider" | "rolex" | "build" | "landmarks";

/** A passenger you're carrying as a boda rider. */
export interface Ride {
  id: string;
  passengerId: string;
  passenger: string;
  fromId: string;
  toId: string;
  pay: number;
  stage: "pickup" | "dropoff";
  acceptedAt: number;
}

export interface PlayerState {
  version: number;
  id: string;
  createdAt: number;
  ageConfirmed: boolean;
  onboarded: boolean;
  tag: { name: string; status: string; socials: Social[]; ghost: boolean };
  look: Look;
  pos: { x: number; y: number };
  ledger: Ledger;
  xp: number;
  jobsToday: { date: string; count: number };
  job: Job | null;
  offers: { date: string; seq: number };
  kiosk: Kiosk | null;
  civic: CivicIssue;
  blocked: string[];
  tickets: Ticket[];
  stats: { deliveries: number; earned: number; daysVisited: number };
  goals: GoalId[];
  lastVisitDate: string | null;
  settings: { liveTime: boolean; reducedMotion: boolean };
  /** Kampala date the player rented a boda for, or null. */
  bodaRent: string | null;
  ride: Ride | null;
  ridesOffers: { date: string; seq: number };
  /** Pay boost from street food. */
  boost: { until: number; pct: number; label: string } | null;
  /** Items built in the kiosk yard, one per slot. */
  yard: (string | null)[];
  /** Landmarks the player has discovered. */
  landmarks: string[];
}

export function newPlayer(now: number, id: string): PlayerState {
  return {
    version: SAVE_VERSION,
    id,
    createdAt: now,
    ageConfirmed: false,
    onboarded: false,
    tag: { name: "", status: "", socials: [], ghost: false },
    look: { skin: "#8d5a3b", shirt: "#1f4fd1", hair: "short", pants: "#2b2f38" },
    pos: { x: 3.5, y: 11.5 },
    ledger: emptyLedger(),
    xp: 0,
    jobsToday: { date: "", count: 0 },
    job: null,
    offers: { date: "", seq: 0 },
    kiosk: null,
    civic: newPothole(),
    blocked: [],
    tickets: [],
    stats: { deliveries: 0, earned: 0, daysVisited: 0 },
    goals: [],
    lastVisitDate: null,
    settings: { liveTime: true, reducedMotion: false },
    bodaRent: null,
    ride: null,
    ridesOffers: { date: "", seq: 0 },
    boost: null,
    yard: [null, null, null, null, null],
    landmarks: [],
  };
}

export const GOALS: { id: GoalId; label: string }[] = [
  { id: "walk", label: "Walk down the street" },
  { id: "delivery", label: "Finish your first delivery" },
  { id: "pothole", label: "Report the pothole" },
  { id: "earn25", label: "Save UGX 25,000" },
  { id: "kiosk", label: "Lease a kiosk" },
  { id: "paint", label: "Paint your kiosk sign" },
  { id: "profile", label: "Add a social to your Ug Tag" },
  { id: "boda", label: "Take a boda somewhere" },
  { id: "rolex", label: "Buy a rolex from Musa" },
  { id: "rider", label: "Carry a passenger on a boda" },
  { id: "build", label: "Build something in your kiosk yard" },
  { id: "landmarks", label: "Discover 5 Kampala landmarks" },
  { id: "snap", label: "Snap a real Kampala street" },
  { id: "share", label: "Share your card" },
];
