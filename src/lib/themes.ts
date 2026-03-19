export interface Theme {
  id: string;
  name: string;
  description: string;
  colors: {
    base: string;
    baseLight: string;
    accent: string;
    highlight: string;
    text: string;
    textMuted: string;
    border: string;
    background: string;
    card: string;
  };
  font: string;
  borderStyle: string;
  effects: string[];
}

export const themes: Record<string, Theme> = {
  'neon-mana-circuit': {
    id: 'neon-mana-circuit',
    name: 'Neon Mana Circuit',
    description: 'Retro-futuristic magic with glowing borders',
    colors: {
      base: '#083D56',
      baseLight: '#0a4d6a',
      accent: '#00F0FF',
      highlight: '#FF00AA',
      text: '#AAFFCC',
      textMuted: '#6a9980',
      border: '#00F0FF',
      background: '#021824',
      card: '#083D56',
    },
    font: 'Pixeloid Sans, monospace',
    borderStyle: 'solid 2px var(--accent)',
    effects: ['glow', 'scanlines'],
  },
  'sol-arcana-ledger': {
    id: 'sol-arcana-ledger',
    name: 'Sol-Arcana Ledger',
    description: 'Warm, maximalist JRPG with beveled stone borders',
    colors: {
      base: '#5D1F1A',
      baseLight: '#7a2a23',
      accent: '#FFD700',
      highlight: '#FF6B35',
      text: '#FFF5E1',
      textMuted: '#c9b99a',
      border: '#8B4513',
      background: '#2D0F0D',
      card: '#5D1F1A',
    },
    font: 'ThaleahFat, serif',
    borderStyle: 'ridge 4px var(--border)',
    effects: ['beveled', 'parchment'],
  },
  'prism-spark-sanctuary': {
    id: 'prism-spark-sanctuary',
    name: 'Prism Spark Sanctuary',
    description: 'Ethereal, crystalline with dithered gradients',
    colors: {
      base: '#311B92',
      baseLight: '#4527a0',
      accent: '#FFFF00',
      highlight: '#E040FB',
      text: '#E1F5FE',
      textMuted: '#90caf9',
      border: '#7C4DFF',
      background: '#0D0044',
      card: '#311B92',
    },
    font: 'm5x7, monospace',
    borderStyle: 'solid 2px var(--border)',
    effects: ['dither', 'crystal'],
  },
  'mana-punk': {
    id: 'mana-punk',
    name: 'Mana-Punk',
    description: 'Tech-fantasy with neon borders and flicker animation',
    colors: {
      base: '#0A0A0B',
      baseLight: '#1a1a1b',
      accent: '#00F5D4',
      highlight: '#FF006E',
      text: '#FFFFFF',
      textMuted: '#888888',
      border: '#00F5D4',
      background: '#000000',
      card: '#0A0A0B',
    },
    font: 'Silkscreen, monospace',
    borderStyle: 'solid 2px var(--accent)',
    effects: ['flicker', 'glitch'],
  },
  'gilded-relic': {
    id: 'gilded-relic',
    name: 'Gilded Relic',
    description: 'Ancient artifact with ornamental borders',
    colors: {
      base: '#1D1135',
      baseLight: '#2d1a4d',
      accent: '#FFD700',
      highlight: '#3A86FF',
      text: '#F8F4E3',
      textMuted: '#a89f8a',
      border: '#B8860B',
      background: '#0D0818',
      card: '#1D1135',
    },
    font: 'Alagard, serif',
    borderStyle: 'outset 3px var(--border)',
    effects: ['ornamental', 'aged'],
  },
};

export function getTheme(themeId: string): Theme {
  return themes[themeId] || themes['neon-mana-circuit'];
}

export function getThemeList(): Theme[] {
  return Object.values(themes);
}
