import type { MerchantEntry } from "@domain/services/merchant-catalog";

/** The roof and what runs under it: rent, energy, water, telecom, insurance. */
export const HOME: MerchantEntry[] = [
  // ── Logement ───────────────────────────────────────────────────────────
  { key: "foncia", name: "Foncia", kind: "housing", patterns: ["FONCIA"] },
  { key: "citya", name: "Citya", kind: "housing", patterns: ["CITYA"] },
  { key: "nexity", name: "Nexity", kind: "housing", patterns: ["NEXITY"] },
  { key: "square-habitat", name: "Square Habitat", kind: "housing", patterns: ["SQUARE HABITAT"] },
  { key: "orpi", name: "Orpi", kind: "housing", patterns: ["ORPI"] },
  { key: "laforet", name: "Laforêt", kind: "housing", patterns: ["LAFORET"] },
  { key: "century-21", name: "Century 21", kind: "housing", patterns: ["CENTURY 21"] },
  { key: "guy-hoquet", name: "Guy Hoquet", kind: "housing", patterns: ["GUY HOQUET"] },
  { key: "action-logement", name: "Action Logement", kind: "housing", patterns: ["ACTION LOGEMENT"] },
  { key: "housing-generic", name: "Loyer & syndic (générique)", kind: "housing", patterns: ["LOYER", "BAILLEUR", "SYNDIC", "CHARGES COPRO", "ECH PRET", "PRET HABITAT"] },

  // ── Énergie ────────────────────────────────────────────────────────────
  { key: "edf", name: "EDF", kind: "energy", patterns: ["EDF"] },
  { key: "engie", name: "Engie", kind: "energy", patterns: ["ENGIE"] },
  { key: "totalenergies-elec", name: "TotalEnergies Électricité", kind: "energy", patterns: ["TOTALENERGIES ELEC", "TOTAL ENERGIES ELEC"] },
  // ENI is short enough to turn up inside other words; keep the boundary.
  { key: "eni", name: "Eni", kind: "energy", regex: "\\bENI\\b", patterns: [] },
  { key: "ekwateur", name: "ekWateur", kind: "energy", patterns: ["EKWATEUR"] },
  { key: "ilek", name: "ilek", kind: "energy", patterns: ["ILEK"] },
  { key: "octopus-energy", name: "Octopus Energy", kind: "energy", patterns: ["OCTOPUS ENERGY"] },
  { key: "mint-energie", name: "Mint Énergie", kind: "energy", patterns: ["MINT ENERGIE"] },
  { key: "vattenfall", name: "Vattenfall", kind: "energy", patterns: ["VATTENFALL"] },
  { key: "happ-e", name: "happ-e", kind: "energy", patterns: ["HAPP E", "HAPP-E"] },
  { key: "alterna", name: "Alterna", kind: "energy", patterns: ["ALTERNA ENERGIE"] },
  { key: "sowee", name: "Sowee", kind: "energy", patterns: ["SOWEE"] },
  { key: "primagaz", name: "Primagaz & propane", kind: "energy", patterns: ["PRIMAGAZ", "BUTAGAZ", "ANTARGAZ"] },

  // ── Eau ────────────────────────────────────────────────────────────────
  { key: "veolia", name: "Veolia", kind: "water", patterns: ["VEOLIA"] },
  { key: "suez", name: "Suez", kind: "water", patterns: ["SUEZ"] },
  { key: "saur", name: "Saur", kind: "water", patterns: ["SAUR"] },
  { key: "eau-de-paris", name: "Eau de Paris", kind: "water", patterns: ["EAU DE PARIS"] },
  { key: "water-generic", name: "Eau (générique)", kind: "water", patterns: ["SERVICE DES EAUX", "SYNDICAT DES EAUX"] },

  // ── Télécom ────────────────────────────────────────────────────────────
  { key: "free", name: "Free", kind: "telecom", patterns: ["FREE MOBILE", "FREE TELECOM", "FREE HAUT DEBIT"] },
  { key: "orange", name: "Orange", kind: "telecom", patterns: ["ORANGE"] },
  { key: "sosh", name: "Sosh", kind: "telecom", patterns: ["SOSH"] },
  { key: "sfr", name: "SFR", kind: "telecom", patterns: ["SFR"] },
  { key: "red-by-sfr", name: "RED by SFR", kind: "telecom", patterns: ["RED BY SFR"] },
  { key: "bouygues", name: "Bouygues Telecom", kind: "telecom", patterns: ["BOUYGUES TELECOM", "B&YOU"] },
  { key: "prixtel", name: "Prixtel", kind: "telecom", patterns: ["PRIXTEL"] },
  { key: "la-poste-mobile", name: "La Poste Mobile", kind: "telecom", patterns: ["LA POSTE MOBILE"] },
  { key: "nrj-mobile", name: "NRJ Mobile", kind: "telecom", patterns: ["NRJ MOBILE"] },

  { key: "coriolis", name: "Coriolis", kind: "telecom", patterns: ["CORIOLIS TELECOM"] },
  { key: "starlink", name: "Starlink", kind: "telecom", patterns: ["STARLINK"] },

  // ── Assurances ─────────────────────────────────────────────────────────
  { key: "maif", name: "MAIF", kind: "insurance", patterns: ["MAIF"] },
  { key: "macif", name: "MACIF", kind: "insurance", patterns: ["MACIF"] },
  { key: "matmut", name: "Matmut", kind: "insurance", patterns: ["MATMUT"] },
  { key: "maaf", name: "MAAF", kind: "insurance", patterns: ["MAAF"] },
  { key: "mma", name: "MMA", kind: "insurance", patterns: ["MMA"] },
  { key: "groupama", name: "Groupama", kind: "insurance", patterns: ["GROUPAMA"] },
  { key: "axa", name: "AXA", kind: "insurance", patterns: ["AXA"] },
  { key: "allianz", name: "Allianz", kind: "insurance", patterns: ["ALLIANZ"] },
  { key: "generali", name: "Generali", kind: "insurance", patterns: ["GENERALI"] },
  { key: "gmf", name: "GMF", kind: "insurance", patterns: ["GMF"] },
  { key: "direct-assurance", name: "Direct Assurance", kind: "insurance", patterns: ["DIRECT ASSURANCE"] },
  { key: "agipi", name: "AGIPI", kind: "insurance", patterns: ["AGIPI"] },
  { key: "adis", name: "ADIS", kind: "insurance", patterns: ["ADIS"] },
  { key: "swisslife", name: "SwissLife", kind: "insurance", patterns: ["SWISSLIFE", "SWISS LIFE"] },
  { key: "april", name: "April", kind: "insurance", patterns: ["APRIL ASSURANCE"] },
  { key: "harmonie-mutuelle", name: "Harmonie Mutuelle", kind: "insurance", patterns: ["HARMONIE MUTUELLE"] },
  { key: "mgen", name: "MGEN", kind: "insurance", patterns: ["MGEN"] },
  { key: "malakoff-humanis", name: "Malakoff Humanis", kind: "insurance", patterns: ["MALAKOFF"] },
  { key: "aesio", name: "Aésio", kind: "insurance", patterns: ["AESIO"] },
  { key: "luko", name: "Luko", kind: "insurance", patterns: ["LUKO"] },
  { key: "insurance-generic", name: "Assurance (générique)", kind: "insurance", patterns: ["ASSURANCE", "MUTUELLE"] },
];
