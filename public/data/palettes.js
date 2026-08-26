// Kuratierte Paletten. Reihenfolge = Verlauf von "wichtig" nach "unwichtig",
// damit die Farbzuordnung "nach Score" ohne Zusatzlogik funktioniert.
export const PALETTES = [
  { id: 'aurora',    name: 'Aurora',        dark: true,  colors: ['#7c6cff', '#8f7bff', '#34e0a1', '#4fd1c5', '#63b3ff', '#a78bfa'] },
  { id: 'ember',     name: 'Ember',         dark: true,  colors: ['#ff6b6b', '#ff8e53', '#ffb347', '#ffd166', '#f4978e', '#e06c75'] },
  { id: 'ocean',     name: 'Ocean',         dark: true,  colors: ['#0ea5e9', '#38bdf8', '#22d3ee', '#2dd4bf', '#60a5fa', '#818cf8'] },
  { id: 'forest',    name: 'Forest',        dark: true,  colors: ['#34d399', '#6ee7b7', '#a3e635', '#84cc16', '#4ade80', '#22c55e'] },
  { id: 'corporate', name: 'Corporate',     dark: false, colors: ['#1e3a5f', '#2b5a8c', '#3f7cb0', '#5b9bd5', '#8ab6e0', '#b4d2ee'] },
  { id: 'pastel',    name: 'Pastel',       dark: false, colors: ['#f4a3b8', '#f7c59f', '#f7ea9f', '#b8e0c2', '#a3c4f3', '#c9b6e4'] },
  { id: 'contrast',  name: 'Contrast',      dark: false, colors: ['#111111', '#333333', '#555555', '#777777', '#999999', '#bbbbbb'] },
  { id: 'heat',      name: 'Heatmap',       dark: true,  colors: ['#fef08a', '#fbbf24', '#f97316', '#ef4444', '#b91c1c', '#7f1d1d'] },
  { id: 'mono-blue', name: 'Mono Blue',dark: true,  colors: ['#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af'] },
];

export function paletteById(id) {
  return PALETTES.find((p) => p.id === id) || PALETTES[0];
}
