export interface SectorDefinition {
  slug: string;
  title: string;
  categories: string[];
  titleKeywords: string[];
}

export const SECTORS: SectorDefinition[] = [
  {
    slug: "crypto",
    title: "Crypto",
    categories: ["crypto"],
    titleKeywords: [
      "bitcoin",
      "btc",
      "ethereum",
      "eth",
      "solana",
      "sol",
      "xrp",
    ],
  },
  {
    slug: "fed",
    title: "Fed / Macro",
    categories: ["economics", "financial_markets"],
    titleKeywords: [
      "federal reserve",
      "federal funds",
      "interest rate",
      "cpi",
      "inflation",
      "recession",
      "bank of canada",
      "ecb",
    ],
  },
  {
    slug: "elections",
    title: "Elections / Politics",
    categories: ["politics"],
    titleKeywords: [
      "election",
      "president",
      "senate",
      "house",
      "governor",
      "trump",
      "biden",
    ],
  },
  {
    slug: "ai",
    title: "AI / Tech",
    categories: ["technology", "tech"],
    titleKeywords: [
      "ai",
      "openai",
      "nvidia",
      "google",
      "microsoft",
      "meta",
      "anthropic",
    ],
  },
];

export function getSector(slug: string): SectorDefinition {
  const match = SECTORS.find((sector) => sector.slug === slug);
  if (!match) {
    throw new Error(`Unknown sector: ${slug}`);
  }

  return match;
}
