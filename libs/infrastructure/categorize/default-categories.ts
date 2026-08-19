/**
 * The categories a fresh install starts with, seeded by `npm run db:migrate`.
 *
 * Seeding is additive: a category that already exists is left alone, so
 * renaming or recolouring one survives a re-run. The names matter — the
 * merchant catalogue files into categories *by name*
 * (`MERCHANT_KIND_CATEGORY`), which is what lets a shipped catalogue meet a
 * per-install table of categories with their own ids.
 */
export type DefaultCategory = { name: string; color: string; icon: string };

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { name: "Alimentation", color: "#16a34a", icon: "ShoppingCart" },
  { name: "Restaurants", color: "#f97316", icon: "UtensilsCrossed" },
  { name: "Transport", color: "#0ea5e9", icon: "Train" },
  { name: "Logement", color: "#a16207", icon: "Home" },
  { name: "Énergie", color: "#eab308", icon: "Zap" },
  { name: "Télécom", color: "#6366f1", icon: "Smartphone" },
  { name: "Loisirs", color: "#ec4899", icon: "Gamepad2" },
  { name: "Santé", color: "#dc2626", icon: "HeartPulse" },
  { name: "Shopping", color: "#8b5cf6", icon: "ShoppingBag" },
  { name: "Apports", color: "#10b981", icon: "TrendingUp" },
  { name: "Assurances", color: "#0891b2", icon: "ShieldCheck" },
  { name: "Banque", color: "#475569", icon: "Landmark" },
  { name: "Impôts", color: "#7c2d12", icon: "Receipt" },
  { name: "Épargne", color: "#0d9488", icon: "PiggyBank" },
  { name: "Travaux", color: "#b45309", icon: "Hammer" },
  { name: "Animaux & Jardin", color: "#65a30d", icon: "Leaf" },
  { name: "Retrait", color: "#9ca3af", icon: "Banknote" },
  // Fallback bucket for anything no rule catches.
  { name: "Autre", color: "#94a3b8", icon: "HelpCircle" },
];
