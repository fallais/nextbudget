/**
 * What a merchant *is* — the vocabulary the catalogue is written in.
 *
 * This is domain language, not vendor data: "a bakery files into Alimentation"
 * is a rule about money, true wherever the app runs. Who Auchan is belongs
 * outside, in `@infrastructure/categorize/catalog` — swap that file for a
 * German one and nothing here changes.
 *
 * An `as const` array rather than a TS `enum`, per this folder's README: the
 * union is derived, the values are the strings that go in the database, and
 * there is no parallel runtime object to keep in step.
 */
export const MERCHANT_KINDS = [
  "grocery",
  "bakery",
  "restaurant",
  "fast_food",
  "food_delivery",
  "coffee",
  "rail",
  "transit",
  "ride_hailing",
  "fuel",
  "toll_parking",
  "airline",
  "car_service",
  "housing",
  "energy",
  "water",
  "telecom",
  "streaming",
  "culture",
  "sport_leisure",
  "travel_stay",
  "gaming",
  "pharmacy",
  "health_care",
  "optics",
  "marketplace",
  "fashion",
  "electronics",
  "general_retail",
  "furniture",
  "home_improvement",
  "garden_pets",
  "insurance",
  "bank_fee",
  "tax",
  "savings",
  "income",
  "cash",
] as const;

export type MerchantKind = (typeof MERCHANT_KINDS)[number];

/** What each kind is called in the interface. */
export const MERCHANT_KIND_LABELS: Record<MerchantKind, string> = {
  grocery: "Supermarché",
  bakery: "Boulangerie",
  restaurant: "Restaurant",
  fast_food: "Restauration rapide",
  food_delivery: "Livraison de repas",
  coffee: "Café",
  rail: "Train",
  transit: "Transports en commun",
  ride_hailing: "VTC & taxi",
  fuel: "Carburant",
  toll_parking: "Péage & stationnement",
  airline: "Avion",
  car_service: "Entretien auto",
  housing: "Logement",
  energy: "Énergie",
  water: "Eau",
  telecom: "Télécom",
  streaming: "Streaming",
  culture: "Culture",
  sport_leisure: "Sport & loisirs",
  travel_stay: "Hébergement",
  gaming: "Jeux vidéo",
  pharmacy: "Pharmacie",
  health_care: "Santé",
  optics: "Optique & audition",
  marketplace: "Marketplace",
  fashion: "Mode",
  electronics: "Électronique",
  general_retail: "Bazar & discount",
  furniture: "Meuble & déco",
  home_improvement: "Bricolage & matériaux",
  garden_pets: "Jardin & animaux",
  insurance: "Assurance",
  bank_fee: "Frais bancaires",
  tax: "Impôts",
  savings: "Épargne",
  income: "Revenus",
  cash: "Retrait",
};

/**
 * The category a kind files into, by **name**.
 *
 * By name rather than by id because ids are per-install: the catalogue is
 * shipped, the categories table is yours. Every name here is seeded at
 * `db:migrate`, and a kind whose category has been deleted simply stops
 * matching rather than filing into the wrong one.
 */
export const MERCHANT_KIND_CATEGORY: Record<MerchantKind, string> = {
  grocery: "Alimentation",
  bakery: "Alimentation",
  restaurant: "Restaurants",
  fast_food: "Restaurants",
  food_delivery: "Restaurants",
  coffee: "Restaurants",
  rail: "Transport",
  transit: "Transport",
  ride_hailing: "Transport",
  fuel: "Transport",
  toll_parking: "Transport",
  airline: "Transport",
  car_service: "Transport",
  housing: "Logement",
  energy: "Énergie",
  water: "Énergie",
  telecom: "Télécom",
  streaming: "Loisirs",
  culture: "Loisirs",
  sport_leisure: "Loisirs",
  travel_stay: "Loisirs",
  gaming: "Loisirs",
  pharmacy: "Santé",
  health_care: "Santé",
  optics: "Santé",
  marketplace: "Shopping",
  fashion: "Shopping",
  electronics: "Shopping",
  general_retail: "Shopping",
  furniture: "Shopping",
  home_improvement: "Travaux",
  garden_pets: "Animaux & Jardin",
  insurance: "Assurances",
  bank_fee: "Banque",
  tax: "Impôts",
  savings: "Épargne",
  income: "Apports",
  cash: "Retrait",
};
