import type { Look } from "../game/state";
import type { Platform } from "../game/moderation";
import { passersBy } from "./catalog";

// Fictional street residents. They are characters in the game, not real people,
// and the profile card says so.
export interface Resident {
  id: string;
  name: string;
  role: string;
  bio: string;
  level: number;
  look: Look;
  socials: { platform: Platform; handle: string }[];
  start: { x: number; y: number };
}

const NAMED: Resident[] = [
  { id: "r-nakato", name: "Nakato", role: "Runs Salon Nakato", bio: "Braids, cuts and the best street gossip. Wants a second chair by December.", level: 6, look: { skin: "#7a4a2f", shirt: "#7a2fa8", hair: "braids", pants: "#2b2f38" }, socials: [{ platform: "tiktok", handle: "salon.nakato" }], start: { x: 20, y: 4 } },
  { id: "r-okello", name: "Okello", role: "Boda rider at the stage", bio: "Knows every shortcut from Wandegeya to Kikoni. Ask him about the pothole.", level: 4, look: { skin: "#5c3a24", shirt: "#e07a1f", hair: "cap", pants: "#3a3f4a" }, socials: [], start: { x: 4, y: 11 } },
  { id: "r-achieng", name: "Achieng", role: "Student, designs posters", bio: "Second-year design student. Takes poster and logo jobs for kiosks on the street.", level: 3, look: { skin: "#6b4228", shirt: "#2f7a4b", hair: "bun", pants: "#1f4fd1" }, socials: [{ platform: "instagram", handle: "achieng.designs" }], start: { x: 24, y: 4 } },
  { id: "r-ssali", name: "Ssali", role: "Phone repair kiosk", bio: "Fixes screens in 20 minutes. Rents the middle kiosk across the road.", level: 7, look: { skin: "#4e3020", shirt: "#1f4fd1", hair: "short", pants: "#2b2f38" }, socials: [], start: { x: 19, y: 11 } },
  { id: "r-rose", name: "Mama Rose", role: "Chapati and rolex", bio: "Her rolex is famous on this street. Always needs someone to carry flour from the market.", level: 9, look: { skin: "#8d5a3b", shirt: "#e0457b", hair: "bun", pants: "#5a3b24" }, socials: [], start: { x: 5, y: 4 } },
  { id: "r-kato", name: "DJ Kato", role: "Producer at Studio 256", bio: "Records artists in the evenings. Hosts music night when the street event allows.", level: 8, look: { skin: "#5c3a24", shirt: "#13202b", hair: "cap", pants: "#3a3f4a" }, socials: [{ platform: "youtube", handle: "djkato256" }], start: { x: 17, y: 4 } },
  { id: "r-amina", name: "Amina", role: "Fresh Juice Bar", bio: "Passion, mango and pineapple. Opening a second juice spot is the goal.", level: 5, look: { skin: "#9a6544", shirt: "#f2d23c", hair: "braids", pants: "#2f7a4b" }, socials: [], start: { x: 28, y: 4 } },
  { id: "r-brian", name: "Brian", role: "Hardware shop assistant", bio: "Saving for a motorbike. Does deliveries on his lunch break.", level: 2, look: { skin: "#6b4228", shirt: "#b4442a", hair: "short", pants: "#2b2f38" }, socials: [], start: { x: 2, y: 4 } },
  { id: "r-faith", name: "Faith", role: "Student, Campus View Hostel", bio: "Sells roasted maize on Fridays. Organising a clean-up of the drains.", level: 3, look: { skin: "#7a4a2f", shirt: "#f4efe4", hair: "bun", pants: "#13202b" }, socials: [], start: { x: 26, y: 12 } },
];

/** Named residents plus everyday passers-by spread along both pavements. */
export const RESIDENTS: Resident[] = [
  ...NAMED,
  ...passersBy(14).map((p, i) => ({
    id: p.id,
    name: p.name,
    role: p.role,
    bio: `${p.role}. Lives around Wandegeya and Kikoni.`,
    level: 1 + (i % 4),
    look: p.look,
    socials: [],
    start: { x: (3 + i * 2.7) % 38 | 0, y: i % 2 ? 4 : 11 },
  })),
];
