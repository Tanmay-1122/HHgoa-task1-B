// Isomorphic — no DOM/canvas APIs here so this can be imported from both the
// client-side Generator component and server-side API routes (the finalize
// route uses ROLE_CATEGORIES to validate the incoming roleCategory field).

export const CANVAS_W = 1600;
export const CANVAS_H = 764; // matches the frame art's aspect ratio (1546:738)

// Verified against the actual frame asset — see project history / README.
// Photo slot: left portion of the cream field, clear of the palm tree & diya.
export const PHOTO_RECT = { x0: 0.115, y0: 0.17, x1: 0.37, y1: 0.8 };

// Text panel: right portion of the cream field, clear of the jhumar chain & scooter.
export const TEXT_X0 = 0.4;
export const TEXT_X1 = 0.86;
export const TEXT_Y0 = 0.32;
export const TEXT_Y1 = 0.84; // extended from 0.76 to make room for the QR block

// QR block — verified with a real, decode-tested QR against the frame art.
// Square, anchored to the text panel's bottom-right.
export const QR_RECT = { x0: 0.76, y0: 0.62, x1: 0.86, y1: 0.83 };

export const COLORS = {
  greenDark: "#0A2E1C",
  greenBrand: "#0B5D34",
  gold: "#F2C22E",
  pink: "#CC3769",
  cream: "#FAF4E8",
};

export type RarityKey = "common" | "rare" | "epic" | "legendary";

export const RARITIES: { key: RarityKey; label: string; weight: number }[] = [
  { key: "common", label: "COMMON", weight: 60 },
  { key: "rare", label: "RARE", weight: 30 },
  { key: "epic", label: "EPIC", weight: 9 },
  { key: "legendary", label: "LEGENDARY", weight: 1 },
];

const ADJECTIVES = [
  "Midnight", "Overclocked", "Feral", "Barefoot", "Recursive", "Async",
  "Caffeinated", "Sunburnt", "Unstoppable", "Serverless", "Analog",
  "Nocturnal", "Chaotic-Good", "Beachside", "Terminal-Bound",
  "Zero-Latency", "Salt-Crusted", "Off-Grid", "Hyperfocused", "Tideworn",
];

export type RoleCategory =
  | "ai" | "backend" | "frontend" | "product" | "crypto" | "data" | "other";

export const ROLE_CATEGORIES: { key: RoleCategory; label: string }[] = [
  { key: "ai", label: "AI" },
  { key: "backend", label: "Backend" },
  { key: "frontend", label: "Frontend" },
  { key: "product", label: "Product" },
  { key: "crypto", label: "Crypto" },
  { key: "data", label: "Data" },
  { key: "other", label: "Other" },
];

const ROLE_POOLS: { key: RoleCategory; keys: string[]; nouns: string[] }[] = [
  { key: "ai", keys: ["ai", "ml", "gpt", "llm", "model"], nouns: ["Prompt Whisperer", "Model Tamer", "Gradient Surfer", "Neural Nomad", "Embedding Alchemist", "Token Wrangler"] },
  { key: "backend", keys: ["backend", "infra", "server", "devops", "cloud"], nouns: ["Uptime Guardian", "Queue Wrangler", "Latency Slayer", "Ship-It Engineer", "Cache Whisperer", "Pipeline Captain"] },
  { key: "frontend", keys: ["frontend", "design", "ui", "ux"], nouns: ["Pixel Sculptor", "Interface Poet", "Component Whisperer", "Vibes Architect", "Layout Alchemist"] },
  { key: "product", keys: ["product", "founder", "pm", "growth"], nouns: ["Roadmap Rebel", "Zero-to-One Operator", "Stakeholder Whisperer", "Growth Gremlin", "Demo Day Menace"] },
  { key: "crypto", keys: ["crypto", "web3", "chain", "solidity", "token"], nouns: ["Onchain Operator", "Block Wrangler", "Gas Fee Gremlin", "Ledger Nomad", "Consensus Chaser"] },
  { key: "data", keys: ["data", "analytics"], nouns: ["Signal Hunter", "Dashboard Druid", "Metric Mercenary"] },
];
const DEFAULT_NOUNS = ["Full-Stack Nomad", "Ship Captain", "Code Alchemist", "Builder-in-Chief", "Sandbox Renegade", "Beach Ops Lead"];

export function hashStr(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function computeRoleCategory(role: string): RoleCategory {
  const roleLower = role.toLowerCase();
  const pool = ROLE_POOLS.find((p) => p.keys.some((k) => roleLower.includes(k)));
  return pool ? pool.key : "other";
}

export function isValidRoleCategory(value: string): value is RoleCategory {
  return ROLE_CATEGORIES.some((c) => c.key === value);
}

export function rollClassAndRarity(name: string, role: string, rerollSeed: number) {
  const seedBase = `${name}|${role}|${rerollSeed}`;
  const h1 = hashStr(seedBase);
  const h2 = hashStr(seedBase + "|noun");

  const adjective = ADJECTIVES[h1 % ADJECTIVES.length];
  const roleLower = role.toLowerCase();
  const pool = ROLE_POOLS.find((p) => p.keys.some((k) => roleLower.includes(k)));
  const nouns = pool ? pool.nouns : DEFAULT_NOUNS;
  const noun = nouns[h2 % nouns.length];
  const builderClass = `The ${adjective} ${noun}`;

  const seedRoll = hashStr(seedBase + "|rarity|" + Math.random());
  const roll = seedRoll % 100;
  let acc = 0;
  let rarity = RARITIES[0];
  for (const r of RARITIES) {
    acc += r.weight;
    if (roll < acc) { rarity = r; break; }
  }

  return { builderClass, rarity };
}

export function rarityFillColor(key: RarityKey): string {
  if (key === "epic") return COLORS.gold;
  if (key === "legendary") return COLORS.pink;
  if (key === "common") return "transparent";
  return COLORS.pink; // rare
}
export function rarityTextColor(key: RarityKey): string {
  if (key === "epic") return COLORS.greenDark;
  if (key === "common") return COLORS.greenBrand;
  return "#FFFFFF";
}

export type CardRow = {
  id: number;
  status: "pending" | "complete";
  name: string | null;
  role: string | null;
  role_category: RoleCategory | null;
  builder_class: string | null;
  rarity_key: RarityKey | null;
  image_url: string | null;
  created_at: string;
};

export function captionFor(rarityKey: RarityKey): string {
  const base = "Just generated my Builder ID for HH Goa 2026 \uD83C\uDF34";
  const byRarity: Record<RarityKey, string> = {
    common: `${base} #FrameInGoa`,
    rare: `${base} — pulled a RARE card \uD83D\uDCAB #FrameInGoa`,
    epic: `${base} — EPIC pull \uD83D\uDD25 #FrameInGoa`,
    legendary: `${base} — LEGENDARY pull \u26A1\uFE0F\uD83C\uDFC6 #FrameInGoa`,
  };
  return byRarity[rarityKey] || byRarity.common;
}
