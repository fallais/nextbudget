import type { MerchantEntry } from "@domain/services/merchant-catalog";

/**
 * Food: what you buy to cook, and what you buy already cooked.
 *
 * Patterns are matched against the normalised description — upper case, no
 * accents, punctuation flattened — so write the distinctive root and let
 * specificity sort the rest out. "CARREFOUR" already covers CARREFOUR MARKET,
 * CITY and CONTACT; a second pattern only earns its place when the label on
 * the statement is genuinely different.
 */
export const FOOD: MerchantEntry[] = [
  // ── Supermarchés ───────────────────────────────────────────────────────
  { key: "carrefour", name: "Carrefour", kind: "grocery", patterns: ["CARREFOUR", "CRF MARKET"] },
  { key: "leclerc", name: "E.Leclerc", kind: "grocery", patterns: ["LECLERC"] },
  { key: "intermarche", name: "Intermarché", kind: "grocery", patterns: ["INTERMARCHE"] },
  { key: "auchan", name: "Auchan", kind: "grocery", patterns: ["AUCHAN"] },
  { key: "super-u", name: "Système U", kind: "grocery", patterns: ["SUPER U", "HYPER U", "U EXPRESS", "MAGASIN U", "STATION U"] },
  { key: "monoprix", name: "Monoprix", kind: "grocery", patterns: ["MONOP"] },
  { key: "franprix", name: "Franprix", kind: "grocery", patterns: ["FRANPRIX"] },
  { key: "casino", name: "Casino", kind: "grocery", patterns: ["GEANT CASINO", "CASINO SUPERMARCHE", "PETIT CASINO", "CASINO SHOP"] },
  { key: "lidl", name: "Lidl", kind: "grocery", patterns: ["LIDL"] },
  { key: "aldi", name: "Aldi", kind: "grocery", patterns: ["ALDI"] },
  { key: "netto", name: "Netto", kind: "grocery", patterns: ["NETTO"] },
  { key: "leader-price", name: "Leader Price", kind: "grocery", patterns: ["LEADER PRICE"] },
  // CORA collides with the SNCF's CORAIL trains, so it needs a boundary.
  { key: "cora", name: "Cora", kind: "grocery", regex: "\\bCORA\\b", patterns: [] },
  { key: "match", name: "Supermarché Match", kind: "grocery", patterns: ["SUPERMARCHE MATCH"] },
  { key: "grand-frais", name: "Grand Frais", kind: "grocery", patterns: ["GRAND FRAIS"] },
  { key: "picard", name: "Picard", kind: "grocery", patterns: ["PICARD"] },
  { key: "thiriet", name: "Thiriet", kind: "grocery", patterns: ["THIRIET"] },
  { key: "biocoop", name: "Biocoop", kind: "grocery", patterns: ["BIOCOOP"] },
  { key: "naturalia", name: "Naturalia", kind: "grocery", patterns: ["NATURALIA"] },
  { key: "la-vie-claire", name: "La Vie Claire", kind: "grocery", patterns: ["VIE CLAIRE"] },
  { key: "colruyt", name: "Colruyt", kind: "grocery", patterns: ["COLRUYT"] },
  { key: "delhaize", name: "Delhaize", kind: "grocery", patterns: ["DELHAIZE"] },
  { key: "spar", name: "Spar", kind: "grocery", patterns: ["SPAR SUPERMARCHE", "MAGASIN SPAR"] },
  { key: "proxi", name: "Proxi / Vival / Utile", kind: "grocery", patterns: ["PROXI SUPER", "VIVAL", "MAGASIN UTILE"] },
  { key: "coccinelle", name: "Coccinelle", kind: "grocery", patterns: ["COCCINELLE SUPER", "COCCIMARKET"] },
  { key: "g20", name: "G20", kind: "grocery", patterns: ["G20 SUPERMARCHE"] },
  { key: "metro", name: "Metro", kind: "grocery", patterns: ["METRO CASH", "METRO FRANCE"] },
  { key: "costco", name: "Costco", kind: "grocery", patterns: ["COSTCO"] },
  { key: "la-fourche", name: "La Fourche", kind: "grocery", patterns: ["LA FOURCHE"] },
  { key: "grand-marche", name: "Marché & primeurs", kind: "grocery", patterns: ["PRIMEUR", "MARAICHER", "FROMAGERIE", "POISSONNERIE", "BOUCHERIE"] },

  // ── Boulangeries ───────────────────────────────────────────────────────
  { key: "boulangerie", name: "Boulangerie (générique)", kind: "bakery", patterns: ["BOULANGERIE", "PATISSERIE", "PANETIERE", "BISCUITERIE"] },
  { key: "marie-blachere", name: "Marie Blachère", kind: "bakery", patterns: ["MARIE BLACHERE"] },
  { key: "la-mie-caline", name: "La Mie Câline", kind: "bakery", patterns: ["MIE CALINE"] },
  { key: "brioche-doree", name: "Brioche Dorée", kind: "bakery", patterns: ["BRIOCHE DOREE"] },
  { key: "ange", name: "Boulangerie Ange", kind: "bakery", patterns: ["BOULANGERIE ANGE"] },

  { key: "banette", name: "Banette", kind: "bakery", patterns: ["BANETTE"] },
  { key: "feuillette", name: "Feuillette", kind: "bakery", patterns: ["FEUILLETTE"] },
  { key: "boulangerie-louise", name: "Boulangerie Louise", kind: "bakery", patterns: ["BOULANGERIE LOUISE"] },

  // ── Restauration rapide ────────────────────────────────────────────────
  { key: "mcdonalds", name: "McDonald's", kind: "fast_food", patterns: ["MCDONALD", "MC DONALD"] },
  { key: "burger-king", name: "Burger King", kind: "fast_food", patterns: ["BURGER KING"] },
  { key: "kfc", name: "KFC", kind: "fast_food", patterns: ["KFC"] },
  { key: "quick", name: "Quick", kind: "fast_food", patterns: ["QUICK BURGER"] },
  { key: "subway", name: "Subway", kind: "fast_food", patterns: ["SUBWAY"] },
  { key: "five-guys", name: "Five Guys", kind: "fast_food", patterns: ["FIVE GUYS"] },
  { key: "o-tacos", name: "O'Tacos", kind: "fast_food", patterns: ["O TACOS", "OTACOS"] },
  { key: "dominos", name: "Domino's Pizza", kind: "fast_food", patterns: ["DOMINO S PIZZA", "DOMINOS PIZZA"] },
  { key: "pizza-hut", name: "Pizza Hut", kind: "fast_food", patterns: ["PIZZA HUT"] },
  { key: "sushi-shop", name: "Sushi Shop", kind: "fast_food", patterns: ["SUSHI SHOP"] },
  { key: "planet-sushi", name: "Planet Sushi", kind: "fast_food", patterns: ["PLANET SUSHI"] },
  { key: "la-croissanterie", name: "La Croissanterie", kind: "fast_food", patterns: ["CROISSANTERIE"] },
  { key: "pomme-de-pain", name: "Pomme de Pain", kind: "fast_food", patterns: ["POMME DE PAIN"] },
  { key: "big-fernand", name: "Big Fernand", kind: "fast_food", patterns: ["BIG FERNAND"] },
  { key: "waffle-factory", name: "Waffle Factory", kind: "fast_food", patterns: ["WAFFLE FACTORY"] },
  { key: "bagelstein", name: "Bagelstein", kind: "fast_food", patterns: ["BAGELSTEIN"] },
  { key: "class-croute", name: "Class'croute", kind: "fast_food", patterns: ["CLASS CROUTE"] },
  { key: "fast-food-generic", name: "Restauration rapide (générique)", kind: "fast_food", patterns: ["KEBAB", "TACOS", "SANDWICHERIE", "FRITERIE", "SNACK"] },

  // ── Restaurants ────────────────────────────────────────────────────────
  { key: "buffalo-grill", name: "Buffalo Grill", kind: "restaurant", patterns: ["BUFFALO GRILL"] },
  { key: "hippopotamus", name: "Hippopotamus", kind: "restaurant", patterns: ["HIPPOPOTAMUS"] },
  { key: "courtepaille", name: "Courtepaille", kind: "restaurant", patterns: ["COURTEPAILLE"] },
  { key: "flunch", name: "Flunch", kind: "restaurant", patterns: ["FLUNCH"] },
  { key: "leon", name: "Léon", kind: "restaurant", patterns: ["LEON DE BRUXELLES"] },
  { key: "del-arte", name: "Del Arte", kind: "restaurant", patterns: ["DEL ARTE"] },
  { key: "la-pataterie", name: "La Pataterie", kind: "restaurant", patterns: ["PATATERIE"] },
  { key: "au-bureau", name: "Au Bureau", kind: "restaurant", patterns: ["AU BUREAU"] },
  { key: "poivre-rouge", name: "Poivre Rouge", kind: "restaurant", patterns: ["POIVRE ROUGE"] },
  { key: "la-boucherie", name: "La Boucherie", kind: "restaurant", patterns: ["RESTAURANT LA BOUCHERIE"] },
  { key: "les-3-brasseurs", name: "Les 3 Brasseurs", kind: "restaurant", patterns: ["3 BRASSEURS", "TROIS BRASSEURS"] },
  { key: "vapiano", name: "Vapiano", kind: "restaurant", patterns: ["VAPIANO"] },
  { key: "el-rancho", name: "El Rancho", kind: "restaurant", patterns: ["EL RANCHO"] },
  { key: "cote-sushi", name: "Côté Sushi", kind: "restaurant", patterns: ["COTE SUSHI"] },
  { key: "sushi-generic", name: "Sushi & wok (générique)", kind: "restaurant", patterns: ["SUSHI"], regex: "\\bWOK\\b" },
  { key: "restaurant-generic", name: "Restaurant (générique)", kind: "restaurant", patterns: ["RESTAURANT", "BRASSERI", "PIZZERIA", "CREPERIE", "TRAITEUR", "BISTRO", "TAVERNE"] },

  // ── Livraison ──────────────────────────────────────────────────────────
  { key: "uber-eats", name: "Uber Eats", kind: "food_delivery", patterns: ["UBER EATS", "UBEREATS"] },
  { key: "deliveroo", name: "Deliveroo", kind: "food_delivery", patterns: ["DELIVEROO"] },
  { key: "just-eat", name: "Just Eat", kind: "food_delivery", patterns: ["JUST EAT"] },
  { key: "foodora", name: "Foodora", kind: "food_delivery", patterns: ["FOODORA"] },

  { key: "frichti", name: "Frichti", kind: "food_delivery", patterns: ["FRICHTI"] },

  // ── Cafés ──────────────────────────────────────────────────────────────
  { key: "starbucks", name: "Starbucks", kind: "coffee", patterns: ["STARBUCKS"] },
  { key: "columbus-cafe", name: "Columbus Café", kind: "coffee", patterns: ["COLUMBUS CAFE"] },
  { key: "pret-a-manger", name: "Pret A Manger", kind: "coffee", patterns: ["PRET A MANGER"] },
  { key: "costa-coffee", name: "Costa Coffee", kind: "coffee", patterns: ["COSTA COFFEE"] },
  { key: "coffee-generic", name: "Café & salon de thé (générique)", kind: "coffee", patterns: ["SALON DE THE", "COFFEE SHOP"] },
];
