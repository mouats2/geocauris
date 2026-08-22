export const CAURIS_PACKS = [
  { id: "starter", name: "Starter", credits: 250, priceXof: 350 },
  { id: "essential", name: "Essentiel", credits: 500, priceXof: 700 },
  { id: "standard", name: "Standard", credits: 1000, priceXof: 1400 },
  { id: "advanced", name: "Avancé", credits: 2500, priceXof: 3500 },
  { id: "production", name: "Production", credits: 5000, priceXof: 7000 },
] as const;

export type CaurisPack = (typeof CAURIS_PACKS)[number];

const MODEL_COSTS: Record<string, Record<string, number>> = {
  "gpt-5.6-luna": { low: 2, medium: 5, high: 10 },
  "gpt-5.6-terra": { low: 5, medium: 10, high: 25 },
  "gpt-5.6-sol": { low: 10, medium: 20, high: 50 },
  "glm-5.2": { low: 1, medium: 2, high: 5 },
  "nemotron-3-120b-a12b": { low: 0.5, medium: 1, high: 2 },
};

export function estimateCaurisCost(model: string, effort: string) {
  const costs = MODEL_COSTS[model.toLowerCase()] ?? MODEL_COSTS["gpt-5.6-luna"];
  return costs[effort.toLowerCase()] ?? costs.medium;
}
