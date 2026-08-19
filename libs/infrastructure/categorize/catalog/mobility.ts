import type { MerchantEntry } from "@domain/services/merchant-catalog";

/**
 * Getting about: trains, tickets, fuel, tolls and the garage.
 *
 * The tricky pair lives here. "UBER" is a ride and "UBER EATS" is dinner —
 * both are true, and the longer pattern wins by specificity rather than by a
 * priority someone has to remember to keep in step.
 */
export const MOBILITY: MerchantEntry[] = [
  // ── Train & car ────────────────────────────────────────────────────────
  { key: "sncf", name: "SNCF", kind: "rail", patterns: ["SNCF", "OUIGO", "TGV INOUI", "TRAINLINE", "THALYS", "EUROSTAR"] },
  { key: "flixbus", name: "FlixBus", kind: "rail", patterns: ["FLIXBUS"] },
  { key: "blablacar", name: "BlaBlaCar", kind: "rail", patterns: ["BLABLACAR"] },

  { key: "trenitalia", name: "Trenitalia", kind: "rail", patterns: ["TRENITALIA"] },
  { key: "eurotunnel", name: "Eurotunnel", kind: "rail", patterns: ["EUROTUNNEL", "LE SHUTTLE"] },
  { key: "ferry", name: "Ferries", kind: "rail", patterns: ["BRITTANY FERRIES", "CORSICA FERRIES", "DFDS"] },

  // ── Transports urbains ─────────────────────────────────────────────────
  { key: "ratp", name: "RATP", kind: "transit", patterns: ["RATP", "NAVIGO"] },
  { key: "idfm", name: "Île-de-France Mobilités", kind: "transit", patterns: ["IDF MOBILITES", "ILE DE FRANCE MOBILITES"] },
  { key: "keolis", name: "Keolis", kind: "transit", patterns: ["KEOLIS"] },
  { key: "transdev", name: "Transdev", kind: "transit", patterns: ["TRANSDEV"] },
  { key: "tcl-lyon", name: "TCL Lyon", kind: "transit", patterns: ["TCL LYON"] },
  { key: "tisseo", name: "Tisséo", kind: "transit", patterns: ["TISSEO"] },

  { key: "tan-nantes", name: "TAN Nantes", kind: "transit", patterns: ["TAN NANTES"] },
  { key: "tam-montpellier", name: "TaM Montpellier", kind: "transit", patterns: ["TAM MONTPELLIER"] },
  { key: "transit-generic", name: "Transports en commun (générique)", kind: "transit", patterns: ["TRANSPORT URBAIN", "TICKET BUS", "ABONNEMENT TRANSPORT"] },

  // ── VTC & taxi ─────────────────────────────────────────────────────────
  { key: "uber", name: "Uber", kind: "ride_hailing", patterns: ["UBER"] },
  { key: "bolt", name: "Bolt", kind: "ride_hailing", patterns: ["BOLT EU", "BOLT.EU"] },
  { key: "heetch", name: "Heetch", kind: "ride_hailing", patterns: ["HEETCH"] },
  { key: "freenow", name: "FREENOW", kind: "ride_hailing", patterns: ["FREENOW", "FREE NOW"] },
  { key: "taxi", name: "Taxi (générique)", kind: "ride_hailing", patterns: ["TAXI"] },

  // ── Carburant ──────────────────────────────────────────────────────────
  // Not bare "TOTAL": statements use the word for their own totals.
  { key: "totalenergies", name: "TotalEnergies", kind: "fuel", patterns: ["TOTALENERGIES", "TOTAL ENERGIES", "STATION TOTAL", "TOTAL ACCESS"] },
  { key: "shell", name: "Shell", kind: "fuel", patterns: ["SHELL"] },
  { key: "esso", name: "Esso", kind: "fuel", patterns: ["ESSO"] },
  { key: "avia", name: "Avia", kind: "fuel", patterns: ["STATION AVIA"] },
  { key: "bp", name: "BP", kind: "fuel", regex: "\\bBP\\b", patterns: [] },
  { key: "fuel-generic", name: "Carburant (générique)", kind: "fuel", patterns: ["ESSENCE", "CARBURANT", "STATION SERVICE"] },

  { key: "avia-bis", name: "Oil France", kind: "fuel", patterns: ["OIL FRANCE"] },

  // ── Péage & stationnement ──────────────────────────────────────────────
  { key: "vinci-autoroutes", name: "Vinci Autoroutes", kind: "toll_parking", patterns: ["VINCI"] },
  { key: "aprr", name: "APRR", kind: "toll_parking", patterns: ["APRR"] },
  { key: "sanef", name: "Sanef", kind: "toll_parking", patterns: ["SANEF"] },
  { key: "cofiroute", name: "Cofiroute", kind: "toll_parking", patterns: ["COFIROUTE"] },
  // ASF is three letters that turn up inside longer words; keep the boundary.
  { key: "asf", name: "ASF", kind: "toll_parking", regex: "\\bASF\\b", patterns: [] },
  { key: "ulys", name: "Ulys", kind: "toll_parking", patterns: ["ULYS", "TELEPEAGE"] },
  { key: "indigo", name: "Indigo", kind: "toll_parking", patterns: ["INDIGO PARK"] },
  { key: "effia", name: "Effia", kind: "toll_parking", patterns: ["EFFIA"] },
  { key: "parking-generic", name: "Parking & péage (générique)", kind: "toll_parking", patterns: ["PARKING", "AUTOROUTE", "PEAGE", "HORODATEUR"] },

  // ── Avion ──────────────────────────────────────────────────────────────
  { key: "air-france", name: "Air France", kind: "airline", patterns: ["AIR FRANCE"] },
  { key: "easyjet", name: "easyJet", kind: "airline", patterns: ["EASYJET"] },
  { key: "ryanair", name: "Ryanair", kind: "airline", patterns: ["RYANAIR"] },
  { key: "transavia", name: "Transavia", kind: "airline", patterns: ["TRANSAVIA"] },
  { key: "volotea", name: "Volotea", kind: "airline", patterns: ["VOLOTEA"] },

  { key: "air-caraibes", name: "Air Caraïbes", kind: "airline", patterns: ["AIR CARAIBES"] },
  { key: "corsair", name: "Corsair", kind: "airline", patterns: ["CORSAIR"] },
  { key: "vueling", name: "Vueling", kind: "airline", patterns: ["VUELING"] },
  { key: "lufthansa", name: "Lufthansa", kind: "airline", patterns: ["LUFTHANSA"] },
  { key: "klm", name: "KLM", kind: "airline", patterns: ["KLM"] },
  { key: "wizz-air", name: "Wizz Air", kind: "airline", patterns: ["WIZZ AIR"] },
  { key: "airport", name: "Aéroport (générique)", kind: "airline", patterns: ["AEROPORT", "AIRPORT"] },

  // ── Entretien auto ─────────────────────────────────────────────────────
  { key: "norauto", name: "Norauto", kind: "car_service", patterns: ["NORAUTO"] },
  { key: "feu-vert", name: "Feu Vert", kind: "car_service", patterns: ["FEU VERT"] },
  { key: "midas", name: "Midas", kind: "car_service", patterns: ["MIDAS"] },
  { key: "speedy", name: "Speedy", kind: "car_service", patterns: ["SPEEDY"] },
  { key: "roady", name: "Roady", kind: "car_service", patterns: ["ROADY"] },
  { key: "euromaster", name: "Euromaster", kind: "car_service", patterns: ["EUROMASTER"] },
  { key: "allopneus", name: "Allopneus", kind: "car_service", patterns: ["ALLOPNEUS"] },
  { key: "carglass", name: "Carglass", kind: "car_service", patterns: ["CARGLASS"] },
  { key: "vulco", name: "Vulco", kind: "car_service", patterns: ["VULCO"] },
  { key: "point-s", name: "Point S", kind: "car_service", patterns: ["POINT S"] },
  // Car hire files under the car too. "AVIS" is deliberately absent: French
  // statements are full of "AVIS D'ECHEANCE" and it would swallow them.
  { key: "europcar", name: "Europcar", kind: "car_service", patterns: ["EUROPCAR"] },
  { key: "hertz", name: "Hertz", kind: "car_service", patterns: ["HERTZ"] },
  { key: "sixt", name: "Sixt", kind: "car_service", patterns: ["SIXT"] },
  { key: "rent-a-car", name: "Rent A Car", kind: "car_service", patterns: ["RENT A CAR"] },
  { key: "getaround", name: "Getaround", kind: "car_service", patterns: ["GETAROUND"] },
  { key: "ada", name: "ADA", kind: "car_service", regex: "\\bADA\\b", patterns: [] },
  { key: "controle-technique", name: "Contrôle technique", kind: "car_service", patterns: ["CONTROLE TECHNIQUE", "DEKRA", "AUTOSUR", "AUTOVISION"] },
];
