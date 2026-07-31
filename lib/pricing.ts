export const CAURIS_PACKS = [
  { id: "starter", name: "Starter", credits: 250, priceXof: 350 },
  { id: "essential", name: "Essentiel", credits: 500, priceXof: 700 },
  { id: "standard", name: "Standard", credits: 1000, priceXof: 1400 },
  { id: "advanced", name: "Avancé", credits: 2500, priceXof: 3500 },
  { id: "production", name: "Production", credits: 5000, priceXof: 7000 },
] as const;

export type CaurisPack = (typeof CAURIS_PACKS)[number];
