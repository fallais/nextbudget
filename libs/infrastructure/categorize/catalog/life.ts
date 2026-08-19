import type { MerchantEntry } from "@domain/services/merchant-catalog";

/** Health, and the ways an evening or a weekend gets spent. */
export const LIFE: MerchantEntry[] = [
  // ── Santé ──────────────────────────────────────────────────────────────
  { key: "pharmacie", name: "Pharmacie (générique)", kind: "pharmacy", patterns: ["PHARMACIE", "PHARMACY", "PARAPHARMACIE"] },
  { key: "doctolib", name: "Doctolib", kind: "health_care", patterns: ["DOCTOLIB"] },
  { key: "cpam", name: "CPAM / Assurance Maladie", kind: "health_care", patterns: ["CPAM", "ASSURANCE MALADIE", "AMELI"] },
  { key: "laboratoire", name: "Laboratoire d'analyses", kind: "health_care", patterns: ["BIOGROUP", "CERBALLIANCE", "LABORATOIRE ANALYS"] },
  { key: "health-generic", name: "Soins (générique)", kind: "health_care", patterns: ["MEDECIN", "DENTAIRE", "DENTISTE", "KINE", "INFIRMIER", "OSTEOPATHE", "RADIOLOGIE", "HOPITAL", "CLINIQUE"] },
  { key: "elsan", name: "Elsan", kind: "health_care", patterns: ["ELSAN"] },
  { key: "ramsay", name: "Ramsay Santé", kind: "health_care", patterns: ["RAMSAY SANTE"] },
  { key: "optic-2000", name: "Optic 2000", kind: "optics", patterns: ["OPTIC 2000"] },
  { key: "krys", name: "Krys", kind: "optics", patterns: ["KRYS"] },
  { key: "afflelou", name: "Alain Afflelou", kind: "optics", patterns: ["AFFLELOU"] },
  { key: "grand-optical", name: "GrandOptical", kind: "optics", patterns: ["GRANDOPTICAL", "GRAND OPTICAL"] },
  { key: "audika", name: "Audika", kind: "optics", patterns: ["AUDIKA"] },
  { key: "optics-generic", name: "Optique (générique)", kind: "optics", patterns: ["OPTICIEN", "AUDITION"] },

  // ── Streaming & abonnements ────────────────────────────────────────────
  { key: "netflix", name: "Netflix", kind: "streaming", patterns: ["NETFLIX"] },
  { key: "spotify", name: "Spotify", kind: "streaming", patterns: ["SPOTIFY"] },
  { key: "deezer", name: "Deezer", kind: "streaming", patterns: ["DEEZER"] },
  { key: "disney-plus", name: "Disney+", kind: "streaming", patterns: ["DISNEY"] },
  { key: "prime-video", name: "Prime Video", kind: "streaming", patterns: ["PRIME VIDEO", "AMAZON PRIME"] },
  { key: "canal-plus", name: "Canal+", kind: "streaming", patterns: ["CANAL+"] },
  { key: "apple-music", name: "Apple Music / TV+", kind: "streaming", patterns: ["APPLE MUSIC", "APPLE TV"] },
  { key: "youtube-premium", name: "YouTube Premium", kind: "streaming", patterns: ["YOUTUBE PREMIUM", "GOOGLE YOUTUBE"] },
  { key: "molotov", name: "Molotov", kind: "streaming", patterns: ["MOLOTOV"] },

  { key: "paramount-plus", name: "Paramount+", kind: "streaming", patterns: ["PARAMOUNT"] },
  { key: "crunchyroll", name: "Crunchyroll", kind: "streaming", patterns: ["CRUNCHYROLL"] },
  { key: "audible", name: "Audible", kind: "streaming", patterns: ["AUDIBLE"] },
  { key: "hbo-max", name: "HBO Max", kind: "streaming", patterns: ["HBO MAX"] },

  // ── Culture & sorties ──────────────────────────────────────────────────
  { key: "ugc", name: "UGC", kind: "culture", patterns: ["UGC"] },
  { key: "pathe", name: "Pathé Gaumont", kind: "culture", patterns: ["PATHE", "GAUMONT"] },
  { key: "cgr", name: "CGR Cinémas", kind: "culture", patterns: ["CGR CINEMA"] },
  { key: "kinepolis", name: "Kinepolis", kind: "culture", patterns: ["KINEPOLIS"] },
  { key: "cultura", name: "Cultura", kind: "culture", patterns: ["CULTURA"] },
  { key: "gibert", name: "Gibert", kind: "culture", patterns: ["GIBERT"] },
  { key: "ticketmaster", name: "Ticketmaster", kind: "culture", patterns: ["TICKETMASTER"] },
  { key: "billetreduc", name: "BilletRéduc", kind: "culture", patterns: ["BILLETREDUC"] },
  { key: "culture-generic", name: "Culture (générique)", kind: "culture", patterns: ["CINEMA", "THEATRE", "MUSEE", "LIBRAIRIE", "CONCERT", "BILLETTERIE"] },

  // ── Sport & loisirs ────────────────────────────────────────────────────
  { key: "decathlon", name: "Decathlon", kind: "sport_leisure", patterns: ["DECATHLON"] },
  { key: "intersport", name: "Intersport", kind: "sport_leisure", patterns: ["INTERSPORT"] },
  { key: "go-sport", name: "Go Sport", kind: "sport_leisure", patterns: ["GO SPORT"] },
  { key: "basic-fit", name: "Basic-Fit", kind: "sport_leisure", patterns: ["BASIC FIT", "BASIC-FIT"] },
  { key: "fitness-park", name: "Fitness Park", kind: "sport_leisure", patterns: ["FITNESS PARK"] },
  { key: "keepcool", name: "Keepcool", kind: "sport_leisure", patterns: ["KEEPCOOL"] },
  { key: "neoness", name: "Neoness", kind: "sport_leisure", patterns: ["NEONESS"] },
  { key: "orange-bleue", name: "L'Orange Bleue", kind: "sport_leisure", patterns: ["ORANGE BLEUE"] },
  { key: "gigafit", name: "Gigafit", kind: "sport_leisure", patterns: ["GIGAFIT"] },
  { key: "sport-generic", name: "Sport & bien-être (générique)", kind: "sport_leisure", patterns: ["SALLE DE SPORT", "PISCINE", "THERMES", "BOWLING", "PARC AQUATIQUE"] },

  // ── Hébergement & voyage ───────────────────────────────────────────────
  { key: "airbnb", name: "Airbnb", kind: "travel_stay", patterns: ["AIRBNB"] },
  { key: "booking", name: "Booking.com", kind: "travel_stay", patterns: ["BOOKING.COM", "BOOKING COM"] },
  { key: "abritel", name: "Abritel", kind: "travel_stay", patterns: ["ABRITEL"] },
  { key: "center-parcs", name: "Center Parcs", kind: "travel_stay", patterns: ["CENTER PARCS"] },
  { key: "pierre-vacances", name: "Pierre & Vacances", kind: "travel_stay", patterns: ["PIERRE & VACANCES", "PIERRE ET VACANCES"] },
  { key: "club-med", name: "Club Med", kind: "travel_stay", patterns: ["CLUB MED"] },
  { key: "campanile", name: "Campanile", kind: "travel_stay", patterns: ["CAMPANILE"] },
  { key: "kyriad", name: "Kyriad", kind: "travel_stay", patterns: ["KYRIAD"] },
  { key: "premiere-classe", name: "Première Classe", kind: "travel_stay", patterns: ["PREMIERE CLASSE"] },
  { key: "expedia", name: "Expedia", kind: "travel_stay", patterns: ["EXPEDIA"] },
  { key: "huttopia", name: "Huttopia", kind: "travel_stay", patterns: ["HUTTOPIA"] },
  { key: "hotel-generic", name: "Hôtel & camping (générique)", kind: "travel_stay", patterns: ["HOTEL", "CAMPING", "GITE", "IBIS", "MERCURE", "NOVOTEL", "B&B HOTEL"] },

  // ── Jeux vidéo ─────────────────────────────────────────────────────────
  { key: "steam", name: "Steam", kind: "gaming", patterns: ["STEAM"] },
  { key: "playstation", name: "PlayStation", kind: "gaming", patterns: ["PLAYSTATION", "SONY INTERACTIVE"] },
  { key: "xbox", name: "Xbox", kind: "gaming", patterns: ["XBOX"] },
  { key: "nintendo", name: "Nintendo", kind: "gaming", patterns: ["NINTENDO"] },
  { key: "epic-games", name: "Epic Games", kind: "gaming", patterns: ["EPIC GAMES"] },
  { key: "ubisoft", name: "Ubisoft", kind: "gaming", patterns: ["UBISOFT"] },
  { key: "micromania", name: "Micromania", kind: "gaming", patterns: ["MICROMANIA"] },
  { key: "instant-gaming", name: "Instant Gaming", kind: "gaming", patterns: ["INSTANT GAMING"] },
];
