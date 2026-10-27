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
  "r-nabukeera": ["Moot court at two!", "Have you seen my law notes?", "Oli otya!"],
  "r-tendo": ["Printing, 100 shillings a page!", "Coursework due tomorrow? Come!"],
  "r-ochieng": ["Vote for better Wi-Fi!", "Guild meeting at four!"],
  "r-kisitu": ["Read chapter five before Thursday.", "Economics is everywhere, my friend."],
  "r-amani": ["Oli otya? Did I say it right?", "Webale nnyo!"],
  "r-kirabo": ["Choir practice tonight.", "Kabalagala on Friday?"],
  "r-musoke": ["Sugar, salt, soap! Wholesale!", "Kato, bring that sack!"],
  "r-sylvia": ["Shoes! Original, I promise!", "Reduce price for you!"],
  "r-kato-porter": ["Mind your back! Coming through!", "Need something carried?"],
  "r-nalwanga": ["Kitenge, every pattern!", "Your tailor by tomorrow!"],
  "r-wasswa": ["Cracked screen? Easy.", "I'll teach you to fix it."],
  "r-shiru": ["Club 256 tonight!", "This beat is fire!"],
  "r-bena": ["Cold sodas! Fresh juice!", "No drama at my bar."],
  "r-mzee": ["Pork and gonja, ready!", "Thirty years on this corner."],
  "r-lillian": ["Drink water, my dear.", "Long night at the hospital."],
  "r-joel": ["Twenty push-ups, now!", "Gym is open till ten."],
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
export const STREET_SHOUTS: { area: string; at: { x: number; y: number }; text: string; who: string }[] = [
  { area: "wandegeya", at: { x: 3, y: 11 }, text: "Wandegeya! Kikoni! Kalerwe! Tugende!", who: "Taxi conductor" },
  { area: "wandegeya", at: { x: 7, y: 12 }, text: "Rolex! Hot rolex! Two thousand!", who: "Musa" },
  { area: "wandegeya", at: { x: 15, y: 12 }, text: "Kasooli! Roasted maize!", who: "Auntie Sarah" },
  { area: "wandegeya", at: { x: 13, y: 14 }, text: "Fresh mangoes! Bananas!", who: "Kizza" },
  { area: "makerere", at: { x: 3, y: 11 }, text: "Wandegeya! Town! Tugende, students!", who: "Taxi conductor" },
  { area: "makerere", at: { x: 37, y: 12 }, text: "Chips and chicken! Three thousand!", who: "Auntie Grace" },
  { area: "makerere", at: { x: 14, y: 13 }, text: "Guild meeting at four! Everybody come!", who: "Ochieng" },
  { area: "owino", at: { x: 3, y: 11 }, text: "Nateete! Kalerwe! Ntinda! Old Taxi Park!", who: "Taxi conductor" },
  { area: "owino", at: { x: 12, y: 12 }, text: "Kanzu, shirts, two thousand! Londa, londa!", who: "Market trader" },
  { area: "owino", at: { x: 25, y: 12 }, text: "Muwogo! Hot muwogo, five hundred!", who: "Nakku" },
  { area: "owino", at: { x: 18, y: 14 }, text: "Shoes! Original! Reduce price for you!", who: "Shoe seller" },
  { area: "kabalagala", at: { x: 9, y: 12 }, text: "Muchomo! Hot muchomo!", who: "Ssebunya" },
  { area: "kabalagala", at: { x: 7, y: 4 }, text: "Club 256 tonight! DJ Shiru on the decks!", who: "Club promoter" },
  { area: "kabalagala", at: { x: 3, y: 11 }, text: "Ggaba! Kansanga! Town! Tugende!", who: "Taxi conductor" },
];

export const TALK_MAX = 80;
export const VOICE_MAX_MS = 4_000;

export function phraseById(id: string) {
  return PHRASES.find((p) => p.id === id);
}

export function emoteById(id: string) {
  return EMOTES.find((e) => e.id === id);
}
