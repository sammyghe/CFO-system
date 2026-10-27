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
  /** Which area they live in (world/areas.ts). Missing = Wandegeya. */
  area?: string;
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

const L = (skin: string, shirt: string, hair: "short" | "bun" | "braids" | "cap", pants: string) => ({ skin, shirt, hair, pants });

/** People in the other areas. Fictional characters, like everyone else. */
const OTHERS: Resident[] = [
  // Makerere University
  { area: "makerere", id: "r-nabukeera", name: "Nabukeera", role: "Law student, third year", bio: "Moots, debates and the best notes in the class. Wants to be a judge one day.", level: 5, look: L("#7a4a2f", "#7a2b2b", "braids", "#13202b"), socials: [], start: { x: 10, y: 4 } },
  { area: "makerere", id: "r-tendo", name: "Tendo", role: "Runs the print and photocopy stall", bio: "Engineering student who prints everyone's coursework at 100/= a page.", level: 4, look: L("#5c3a24", "#3b5d8a", "short", "#3a3f4a"), socials: [], start: { x: 28, y: 11 } },
  { area: "makerere", id: "r-ochieng", name: "Ochieng", role: "Guild representative", bio: "Campaigning for better Wi-Fi in the halls. Always has a flyer for you.", level: 6, look: L("#4e3020", "#2f7a4b", "cap", "#13202b"), socials: [], start: { x: 38, y: 4 } },
  { area: "makerere", id: "r-kisitu", name: "Dr. Kisitu", role: "Lecturer in economics", bio: "Gives tough tests and good advice. Buys a rolex at the stage every evening.", level: 9, look: L("#6b4228", "#f4efe4", "short", "#2b2f38"), socials: [], start: { x: 16, y: 4 } },
  { area: "makerere", id: "r-amani", name: "Amani", role: "Exchange student from Kisumu", bio: "Learning Luganda one greeting at a time. Say Oli otya and help her practise.", level: 3, look: L("#8d5a3b", "#e0457b", "bun", "#1f4fd1"), socials: [], start: { x: 14, y: 13 } },
  { area: "makerere", id: "r-kirabo", name: "Kirabo", role: "Mary Stuart Hall resident", bio: "Studies medicine, sings in the choir, never misses a Kabalagala Friday.", level: 4, look: L("#9a6544", "#f2d23c", "braids", "#7a2fa8"), socials: [], start: { x: 27, y: 4 } },
  // Owino Market
  { area: "owino", id: "r-musoke", name: "Hajji Musoke", role: "Wholesaler in Kikuubo", bio: "Sugar, soap and salt by the sack. Pays porters fairly and expects speed.", level: 9, look: L("#6b4228", "#f4efe4", "cap", "#5a3b24"), socials: [], start: { x: 3, y: 4 } },
  { area: "owino", id: "r-sylvia", name: "Maama Sylvia", role: "Shoe seller", bio: "Second-hand shoes that look new. Bargain hard, she likes it.", level: 7, look: L("#7a4a2f", "#b4442a", "bun", "#2b2f38"), socials: [], start: { x: 38, y: 11 } },
  { area: "owino", id: "r-kato-porter", name: "Kato", role: "Porter (kalaani)", bio: "Carries 100 kilos on his head through the market. Saving for a boda.", level: 3, look: L("#4e3020", "#e07a1f", "short", "#3a3f4a"), socials: [], start: { x: 15, y: 11 } },
  { area: "owino", id: "r-nalwanga", name: "Nalwanga", role: "Kitenge fabric seller", bio: "Every pattern in Kampala, and she knows a tailor who sews by tomorrow.", level: 6, look: L("#8d5a3b", "#2f7a4b", "braids", "#f2d23c"), socials: [], start: { x: 13, y: 4 } },
  { area: "owino", id: "r-wasswa", name: "Wasswa", role: "Phone repair technician", bio: "Fixes what others say can't be fixed. Teaches anyone who wants to learn.", level: 5, look: L("#5c3a24", "#13202b", "cap", "#1f4fd1"), socials: [], start: { x: 18, y: 4 } },
  // Kabalagala
  { area: "kabalagala", id: "r-shiru", name: "DJ Shiru", role: "Resident DJ at Club 256", bio: "Afrobeats, dancehall and kadongo kamu remixes. Needs a stand-in some nights.", level: 8, look: L("#5c3a24", "#e0457b", "cap", "#13202b"), socials: [], start: { x: 7, y: 4 } },
  { area: "kabalagala", id: "r-bena", name: "Bena", role: "Runs a juice and soda bar", bio: "Fresh juice, cold sodas and good music. No drama at her bar.", level: 6, look: L("#9a6544", "#7a2fa8", "braids", "#2b2f38"), socials: [], start: { x: 34, y: 11 } },
  { area: "kabalagala", id: "r-mzee", name: "Mzee Lubega", role: "Owner of the pork joint", bio: "Thirty years of roast pork and gonja. Remembers everyone's order.", level: 9, look: L("#4e3020", "#f4efe4", "short", "#5a3b24"), socials: [], start: { x: 2, y: 4 } },
  { area: "kabalagala", id: "r-lillian", name: "Lillian", role: "Nurse, night shift", bio: "Grabs muchomo on the way home at 2am. Always tells you to drink water.", level: 5, look: L("#7a4a2f", "#3b8ea5", "bun", "#13202b"), socials: [], start: { x: 17, y: 12 } },
  { area: "kabalagala", id: "r-joel", name: "Joel", role: "Gym trainer at Tank Hill", bio: "Free advice on push-ups, paid advice on everything else.", level: 6, look: L("#6b4228", "#13202b", "short", "#3a3f4a"), socials: [], start: { x: 38, y: 4 } },
];

const PASSER_AREAS: { area: string; count: number; bio: string }[] = [
  { area: "makerere", count: 10, bio: "On campus between lectures." },
  { area: "owino", count: 12, bio: "Buying and selling at Owino." },
  { area: "kabalagala", count: 10, bio: "Out on the Kabalagala strip." },
];

/** Named residents plus everyday passers-by spread along both pavements. */
export const RESIDENTS: Resident[] = [
  ...NAMED,
  ...OTHERS,
  ...PASSER_AREAS.flatMap((pa, ai) => passersBy(pa.count, 20 + ai * 20).map((p, i) => ({
    area: pa.area,
    id: `${pa.area}-${p.id}`,
    name: p.name,
    role: p.role,
    bio: pa.bio,
    level: 1 + (i % 5),
    look: p.look,
    socials: [],
    start: { x: (2 + i * 3.3) % 38 | 0, y: i % 2 ? 4 : 11 },
  }))),
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
