// Real Kampala landmarks. The skyline ones sit on the hills behind the street; the
// Makerere gate stands at the top of the side road. Facts are kept short and general.
// Add one by adding an entry here (see CONTENT.md); skyline position is in screen
// units along the hills (0 = left edge of a 1000-wide panorama).

export interface Landmark {
  id: string;
  name: string;
  where: string;
  facts: string;
  /** "skyline" = drawn on the hills; "street" = a tile on the map. */
  place: { kind: "skyline"; at: number; hill: 0 | 1 } | { kind: "street"; x: number; y: number };
  draw: "makerere" | "mosque" | "namirembe" | "rubaga" | "bahai" | "towers" | "gate" | "hospital";
}

export const LANDMARK_REWARD = 300;
export const LANDMARKS_FOR_GOAL = 5;

export const LANDMARKS: Landmark[] = [
  {
    id: "makerere-gate", name: "Makerere University gate", where: "Top of the side road, Wandegeya",
    facts: "Makerere is Uganda's oldest university. It started in 1922 as a technical school and grew into one of the best-known universities in Africa. Wandegeya and Kikoni grew up around it, full of hostels, kiosks and bodas waiting for students.",
    place: { kind: "street", x: 14, y: 0 }, draw: "gate",
  },
  {
    id: "makerere-main", name: "Makerere Main Building", where: "Makerere Hill",
    facts: "The white Main Building with its clock tower is the symbol of Makerere University and one of the most photographed buildings in Kampala.",
    place: { kind: "skyline", at: 330, hill: 1 }, draw: "makerere",
  },
  {
    id: "national-mosque", name: "Uganda National Mosque", where: "Old Kampala Hill",
    facts: "Often called the Gaddafi Mosque. Opened in 2007 on Old Kampala Hill, it is one of the largest mosques in East Africa. Visitors climb its minaret for one of the best views over the city.",
    place: { kind: "skyline", at: 640, hill: 0 }, draw: "mosque",
  },
  {
    id: "namirembe", name: "Namirembe Cathedral", where: "Namirembe Hill",
    facts: "St. Paul's Cathedral on Namirembe Hill is Uganda's oldest Anglican cathedral. The brick building with its central dome was completed in 1919.",
    place: { kind: "skyline", at: 110, hill: 0 }, draw: "namirembe",
  },
  {
    id: "rubaga", name: "Rubaga Cathedral", where: "Lubaga Hill",
    facts: "St. Mary's Cathedral on Lubaga Hill is the seat of the Catholic Archdiocese of Kampala. Its twin towers were completed in 1925 and can be seen from across the city.",
    place: { kind: "skyline", at: 860, hill: 0 }, draw: "rubaga",
  },
  {
    id: "bahai", name: "Bahá'í House of Worship", where: "Kikaya Hill",
    facts: "Finished in 1961 on Kikaya Hill, the green-domed temple is the only Bahá'í House of Worship in Africa. Its quiet gardens are open to everyone.",
    place: { kind: "skyline", at: 520, hill: 1 }, draw: "bahai",
  },
  {
    id: "city-centre", name: "Kampala city centre", where: "Nakasero Hill",
    facts: "The towers of Nakasero and Kampala Road mark the city centre, a short boda ride down the hill. Kampala began as a city of seven hills and has spread across many more.",
    place: { kind: "skyline", at: 760, hill: 1 }, draw: "towers",
  },
  {
    id: "mulago", name: "Mulago Hospital", where: "Mulago Hill, next to Wandegeya",
    facts: "Mulago National Referral Hospital sits on the hill right next to Wandegeya. It is Uganda's main national referral hospital and a teaching hospital for Makerere's medical school.",
    place: { kind: "skyline", at: 190, hill: 1 }, draw: "hospital",
  },
];
