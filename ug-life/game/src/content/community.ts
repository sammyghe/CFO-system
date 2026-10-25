// Community rules shared by the game and the server.

export const PROPOSAL_TITLE = 60;
export const PROPOSAL_BODY = 200;
export const PROPOSALS_PER_DAY = 3;
/** Reports from this many different players hide a proposal. */
export const PROPOSAL_HIDE_REPORTS = 3;
/** Most an event can pay each player who comes. */
export const EVENT_MAX_REWARD = 5_000;

export interface Proposal {
  id: string;
  playerId: string;
  name: string;
  title: string;
  body: string;
  votes: number;
  status: "open" | "done" | "hidden";
  note: string;
  at: number;
  /** You've voted for it. */
  mine?: boolean;
}

export interface NewsPost {
  id: string;
  title: string;
  body: string;
  at: number;
}

export interface LiveEvent {
  id: string;
  title: string;
  body: string;
  /** A place id from world/map.ts PLACES (where to go). */
  place: string;
  startsAt: number;
  endsAt: number;
  reward: number;
  attended?: boolean;
}
