// What people say on the street: quick phrases (Luganda and street English),
// emotes, and the lines residents shout or answer with. Quick phrases need no
// typing, work in any language and can't carry scams, so they are the main way
// to talk. Add a phrase by adding an entry; the server accepts any id listed here.

export interface Phrase {
  id: string;
  /** What shows in the bubble. */
  text: string;
  /** English meaning, shown under Luganda phrases. */
  meaning?: string;
  /** Resident replies when you say this near them. */
  replies?: string[];
}

export const PHRASES: Phrase[] = [
  { id: "otya", text: "Oli otya?", meaning: "How are you?", replies: ["Gyendi! Ate ggwe?", "Bulungi, webale!", "Gyendi nnyo!"] },
  { id: "gyebale", text: "Gyebale ko!", meaning: "Well done at work!", replies: ["Kale, webale!", "Kale, gyebale ko nawe!"] },
  { id: "wasuze", text: "Wasuze otya?", meaning: "Good morning", replies: ["Bulungi, wasuze otya?", "Bulungi nnyo!"] },
  { id: "osiibye", text: "Osiibye otya?", meaning: "Good afternoon", replies: ["Bulungi! Osiibye otya?"] },
  { id: "webale", text: "Webale nnyo!", meaning: "Thank you very much", replies: ["Kale!", "Tewali kye!"] },
  { id: "kale", text: "Kale!", meaning: "OK!" },
  { id: "sawa", text: "Sawa sawa", meaning: "All good" },
  { id: "mpola", text: "Mpola mpola", meaning: "Slowly slowly", replies: ["Mpola mpola, ate tutuuka!"] },
  { id: "tugende", text: "Tugende!", meaning: "Let's go!", replies: ["Tugende!"] },
  { id: "nsonyiwa", text: "Nsonyiwa", meaning: "Sorry / excuse me", replies: ["Tewali buzibu."] },
  { id: "weraba", text: "Weraba!", meaning: "Goodbye", replies: ["Weraba! Tunaalabagana."] },
  { id: "sula", text: "Sula bulungi", meaning: "Good night", replies: ["Naawe sula bulungi!"] },
  { id: "boda", text: "Boda! Boda!", replies: ["Tugende! Where to?"] },
  { id: "rolex", text: "Rolex time!", replies: ["Musa's rolex is the best on this street!"] },
  { id: "kiosk", text: "Come to my kiosk!", replies: ["I'm coming! What are you selling?"] },
  { id: "sign", text: "Nice sign!", replies: ["Webale! I painted it myself."] },
  { id: "ride", text: "Ride with me?" },
  { id: "pothole", text: "Let's report the pothole!", replies: ["Eh, that pothole! Tugende!"] },
  { id: "haha", text: "Haha 😂" },
  { id: "eh", text: "Eh! 😮" },
  { id: "welcome", text: "Welcome to the street!", replies: ["Webale nnyo!"] },
  { id: "follow", text: "Follow me!" },
];

export interface Emote {
  id: string;
  label: string;
  icon: string;
}

export const EMOTES: Emote[] = [
  { id: "wave", label: "Wave", icon: "👋" },
  { id: "dance", label: "Dance", icon: "💃" },
  { id: "laugh", label: "Laugh", icon: "😂" },
  { id: "clap", label: "Clap", icon: "👏" },
  { id: "love", label: "Love it", icon: "❤️" },
  { id: "think", label: "Hmm", icon: "🤔" },
];

/** Things residents say on their own while you're near. */
export const RESIDENT_LINES: Record<string, string[]> = {
  "r-okello": ["Boda! Boda!", "Wandegeya, Kikoni, tugende!", "Mpola mpola on that pothole!"],
  "r-rose": ["Chapati ready!", "Hot chapati, come!", "Gyebale ko!"],
  "r-nakato": ["Braids today?", "Nnyabo, your hair!", "Come, I have one chair free."],
  "r-kato": ["Music night tonight!", "Studio 256, tugende!", "Eh, this beat!"],
  "r-amina": ["Fresh passion juice!", "Mango juice, cold cold!"],
  "r-ssali": ["Screens fixed in 20 minutes!", "Cracked phone? Come!"],
  "r-brian": ["Gyebale ko!", "Saving for my own boda."],
  "r-faith": ["Clean-up on Saturday!", "Oli otya?"],
  "r-achieng": ["Need a poster for your kiosk?", "Nice colours on that sign!"],
};

export const PASSER_LINES = ["Oli otya?", "Mpola mpola", "Eh! The traffic!", "Sawa sawa", "Gyebale ko!", "Tugende!", "Haha!", "Kale!"];

/** Shouted from the street now and then (spoken aloud when street voices are on). */
export const STREET_SHOUTS: { at: { x: number; y: number }; text: string; who: string }[] = [
  { at: { x: 3, y: 11 }, text: "Wandegeya! Kikoni! Kalerwe! Tugende!", who: "Taxi conductor" },
  { at: { x: 7, y: 12 }, text: "Rolex! Hot rolex! Two thousand!", who: "Musa" },
  { at: { x: 15, y: 12 }, text: "Kasooli! Roasted maize!", who: "Auntie Sarah" },
  { at: { x: 13, y: 14 }, text: "Fresh mangoes! Bananas!", who: "Kizza" },
];

export const TALK_MAX = 80;
export const VOICE_MAX_MS = 4_000;

export function phraseById(id: string) {
  return PHRASES.find((p) => p.id === id);
}

export function emoteById(id: string) {
  return EMOTES.find((e) => e.id === id);
}
