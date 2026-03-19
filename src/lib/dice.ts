// Dice rolling utility for RPG dice notation
// Supports: d4, d6, d8, d10, d12, d20, d100
// Modifiers: +N, -N, advantage (kh1), disadvantage (kl1)

export interface DiceResult {
  notation: string;
  baseNotation?: string;
  rolls: number[];
  keptRolls?: number[];
  droppedRolls?: number[];
  rollSegments?: DiceRollSegment[];
  total: number;
  modifier: number;
  success: boolean | null;
  dc: number | null;
  advantage?: 'advantage' | 'disadvantage' | null;
  keptD20?: number | null;
  critical?: 'success' | 'failure' | null;
  successReason?: 'dc' | 'critical-success' | 'critical-failure' | null;
  appliedBonus?: number;
  bonusNotation?: string;
  bonusStage?: 'before' | 'after' | null;
  bonusItemId?: string;
  bonusItemName?: string;
}

export interface DiceRollSegmentDie {
  value: number;
  kept: boolean;
}

export interface DiceRollSegment {
  type: 'dice' | 'modifier';
  source: 'base' | 'bonus';
  sign: 1 | -1;
  notation?: string;
  rolls?: DiceRollSegmentDie[];
  value?: number;
}

export interface ParsedNotation {
  count: number;
  sides: number;
  modifier: number;
  keepHighest?: number;
  keepLowest?: number;
}

interface ParsedExpressionTerm extends Omit<ParsedNotation, 'modifier'> {
  sign: 1 | -1;
}

interface ParsedExpression {
  terms: ParsedExpressionTerm[];
  modifier: number;
}

const SINGLE_DICE_REGEX = /^(\d*)d(\d+)(kh(\d+)|kl(\d+))?([+-]\d+)?$/;
const DICE_TERM_REGEX = /^(\d*)d(\d+)(kh(\d+)|kl(\d+))?$/;

function validateDiceValues(count: number, sides: number): void {
  if (count < 1 || count > 100) {
    throw new Error('Dice count must be between 1 and 100');
  }

  if (![4, 6, 8, 10, 12, 20, 100].includes(sides)) {
    throw new Error('Dice sides must be d4, d6, d8, d10, d12, d20, or d100');
  }
}

function parseDiceTerm(notation: string): Omit<ParsedNotation, 'modifier'> {
  const match = notation.match(DICE_TERM_REGEX);
  if (!match) {
    throw new Error(`Invalid dice notation: ${notation}`);
  }

  const count = parseInt(match[1] || '1', 10);
  const sides = parseInt(match[2], 10);

  let keepHighest: number | undefined;
  let keepLowest: number | undefined;

  if (match[3]?.startsWith('kh')) {
    keepHighest = parseInt(match[4] || '1', 10);
  } else if (match[3]?.startsWith('kl')) {
    keepLowest = parseInt(match[5] || '1', 10);
  }

  validateDiceValues(count, sides);

  return {
    count,
    sides,
    keepHighest,
    keepLowest,
  };
}

function parseDiceExpression(notation: string): ParsedExpression {
  const clean = notation.toLowerCase().replace(/\s/g, '');
  if (!clean) {
    throw new Error('Dice notation is required');
  }

  const tokens = clean.match(/[+-]?[^+-]+/g);
  if (!tokens || tokens.join('') !== clean) {
    throw new Error(`Invalid dice notation: ${notation}`);
  }

  const terms: ParsedExpressionTerm[] = [];
  let modifier = 0;

  for (const token of tokens) {
    const sign: 1 | -1 = token.startsWith('-') ? -1 : 1;
    const unsignedToken = token.replace(/^[+-]/, '');

    if (!unsignedToken) {
      throw new Error(`Invalid dice notation: ${notation}`);
    }

    if (unsignedToken.includes('d')) {
      const parsed = parseDiceTerm(unsignedToken);
      terms.push({ ...parsed, sign });
      continue;
    }

    if (!/^\d+$/.test(unsignedToken)) {
      throw new Error(`Invalid dice notation: ${notation}`);
    }

    modifier += sign * parseInt(unsignedToken, 10);
  }

  if (terms.length === 0) {
    throw new Error(`Invalid dice notation: ${notation}`);
  }

  return { terms, modifier };
}

function formatDiceTerm(term: Omit<ParsedNotation, 'modifier'>): string {
  let keepPart = '';

  if (term.keepHighest !== undefined) {
    keepPart = `kh${term.keepHighest}`;
  } else if (term.keepLowest !== undefined) {
    keepPart = `kl${term.keepLowest}`;
  }

  return `${term.count}d${term.sides}${keepPart}`;
}

function formatDiceExpression(expression: ParsedExpression): string {
  const parts: string[] = [];

  expression.terms.forEach((term, index) => {
    const formatted = formatDiceTerm(term);
    if (index === 0) {
      parts.push(term.sign === -1 ? `-${formatted}` : formatted);
      return;
    }

    parts.push(`${term.sign === -1 ? '-' : '+'}${formatted}`);
  });

  if (expression.modifier !== 0) {
    const absModifier = Math.abs(expression.modifier);
    parts.push(`${expression.modifier > 0 ? '+' : '-'}${absModifier}`);
  }

  return parts.join('');
}

function parseNumericBonusValue(value: string): number | null {
  return /^[-+]?\d+$/.test(value.trim()) ? Number.parseInt(value.trim(), 10) : null;
}

function extendDiceNotation(notation: string, bonus: string | number): string {
  const rawBonus = typeof bonus === 'number' ? String(bonus) : bonus.trim();
  if (!rawBonus) {
    return notation;
  }

  const numericBonus = typeof bonus === 'number' ? bonus : parseNumericBonusValue(rawBonus);
  if (numericBonus !== null) {
    return addModifier(notation, numericBonus);
  }

  return `${notation} + ${rawBonus}`;
}

interface ResolvedBonusApplication {
  amount: number;
  notation?: string;
  rolls?: number[];
  keptRolls?: number[];
  droppedRolls?: number[];
  rollSegments?: DiceRollSegment[];
  modifier: number;
}

function resolveBonusApplication(bonus: string | number): ResolvedBonusApplication {
  if (typeof bonus === 'number') {
    return {
      amount: bonus,
      modifier: bonus,
    };
  }

  const trimmedBonus = bonus.trim();
  const numericBonus = parseNumericBonusValue(trimmedBonus);
  if (numericBonus !== null) {
    return {
      amount: numericBonus,
      modifier: numericBonus,
    };
  }

  const bonusRoll = rollDice(trimmedBonus);
  return {
    amount: bonusRoll.total,
    notation: trimmedBonus,
    rolls: bonusRoll.rolls,
    keptRolls: bonusRoll.keptRolls,
    droppedRolls: bonusRoll.droppedRolls,
    rollSegments: bonusRoll.rollSegments,
    modifier: bonusRoll.modifier,
  };
}

export function parseDiceNotation(notation: string): ParsedNotation {
  const clean = notation.toLowerCase().replace(/\s/g, '');

  const advMatch = clean.match(SINGLE_DICE_REGEX);
  if (!advMatch) {
    throw new Error(`Invalid dice notation: ${notation}`);
  }

  const parsedTerm = parseDiceTerm(`${advMatch[1] || ''}d${advMatch[2]}${advMatch[3] || ''}`);
  const modifier = advMatch[6] ? parseInt(advMatch[6], 10) : 0;

  return {
    count: parsedTerm.count,
    sides: parsedTerm.sides,
    modifier,
    keepHighest: parsedTerm.keepHighest,
    keepLowest: parsedTerm.keepLowest,
  };
}

export function rollDice(notation: string, dc?: number): DiceResult {
  const parsed = parseDiceExpression(notation);
  const rolls: number[] = [];
  const keptRolls: number[] = [];
  const droppedRolls: number[] = [];
  const rollSegments: DiceRollSegment[] = [];
  const rollModes = new Set<'advantage' | 'disadvantage'>();
  let total = parsed.modifier;
  let keptD20: number | null = null;

  for (const term of parsed.terms) {
    const termRolls: number[] = [];

    for (let i = 0; i < term.count; i++) {
      termRolls.push(Math.floor(Math.random() * term.sides) + 1);
    }

    rolls.push(...termRolls);

    let termKeptRolls = [...termRolls];
    let termDroppedRolls: number[] = [];
    let keptRollIndexes = new Set(termRolls.map((_, index) => index));

    if (term.keepHighest !== undefined) {
      const sorted = termRolls
        .map((value, index) => ({ value, index }))
        .sort((a, b) => b.value - a.value || a.index - b.index);
      const kept = sorted.slice(0, term.keepHighest);
      const dropped = sorted.slice(term.keepHighest);
      keptRollIndexes = new Set(kept.map((entry) => entry.index));
      termKeptRolls = kept.map((entry) => entry.value);
      termDroppedRolls = dropped.map((entry) => entry.value);
      rollModes.add('advantage');
    } else if (term.keepLowest !== undefined) {
      const sorted = termRolls
        .map((value, index) => ({ value, index }))
        .sort((a, b) => a.value - b.value || a.index - b.index);
      const kept = sorted.slice(0, term.keepLowest);
      const dropped = sorted.slice(term.keepLowest);
      keptRollIndexes = new Set(kept.map((entry) => entry.index));
      termKeptRolls = kept.map((entry) => entry.value);
      termDroppedRolls = dropped.map((entry) => entry.value);
      rollModes.add('disadvantage');
    }

    rollSegments.push({
      type: 'dice',
      source: 'base',
      sign: term.sign,
      notation: formatDiceTerm(term),
      rolls: termRolls.map((value, index) => ({
        value,
        kept: keptRollIndexes.has(index),
      })),
    });

    if (termDroppedRolls.length > 0) {
      keptRolls.push(...termKeptRolls);
      droppedRolls.push(...termDroppedRolls);
    }

    if (keptD20 === null && term.sign === 1 && term.sides === 20 && termKeptRolls.length === 1) {
      keptD20 = termKeptRolls[0];
    }

    total += term.sign * termKeptRolls.reduce((sum, roll) => sum + roll, 0);
  }

  const advantage = rollModes.size === 1 && parsed.terms.length === 1
    ? Array.from(rollModes)[0]
    : null;

  const critical = keptD20 === 20 ? 'success' : keptD20 === 1 ? 'failure' : null;
  const success = dc === undefined
    ? null
    : critical === 'success'
      ? true
      : critical === 'failure'
        ? false
        : total >= dc;
  const successReason = dc === undefined
    ? null
    : critical === 'success'
      ? 'critical-success'
      : critical === 'failure'
        ? 'critical-failure'
        : 'dc';

  if (parsed.modifier !== 0) {
    rollSegments.push({
      type: 'modifier',
      source: 'base',
      sign: parsed.modifier >= 0 ? 1 : -1,
      value: Math.abs(parsed.modifier),
    });
  }
  
  return {
    notation,
    rolls,
    keptRolls: droppedRolls.length > 0 ? keptRolls : undefined,
    droppedRolls: droppedRolls.length > 0 ? droppedRolls : undefined,
    rollSegments,
    total,
    modifier: parsed.modifier,
    success,
    dc: dc ?? null,
    advantage,
    keptD20,
    critical,
    successReason,
  };
}

// Apply advantage to a d20 notation
export function applyAdvantage(notation: string): string {
  const parsed = parseDiceExpression(notation);
  if (parsed.terms.length !== 1 || parsed.terms[0].sides !== 20 || parsed.terms[0].sign === -1) {
    return notation;
  }

  const [term] = parsed.terms;
  return formatDiceExpression({
    terms: [{
      ...term,
      count: 2,
      keepHighest: 1,
      keepLowest: undefined,
    }],
    modifier: parsed.modifier,
  });
}

// Apply disadvantage to a d20 notation
export function applyDisadvantage(notation: string): string {
  const parsed = parseDiceExpression(notation);
  if (parsed.terms.length !== 1 || parsed.terms[0].sides !== 20 || parsed.terms[0].sign === -1) {
    return notation;
  }

  const [term] = parsed.terms;
  return formatDiceExpression({
    terms: [{
      ...term,
      count: 2,
      keepHighest: undefined,
      keepLowest: 1,
    }],
    modifier: parsed.modifier,
  });
}

// Add modifier to notation
export function addModifier(notation: string, amount: number): string {
  const parsed = parseDiceExpression(notation);
  return formatDiceExpression({
    ...parsed,
    modifier: parsed.modifier + amount,
  });
}

export function applyBonusToDiceResult(
  result: DiceResult,
  bonus: string | number,
  options?: { itemId?: string; itemName?: string; stage?: 'before' | 'after' }
): DiceResult {
  const resolvedBonus = resolveBonusApplication(bonus);
  const appliedBonus = (result.appliedBonus ?? 0) + resolvedBonus.amount;
  const total = result.total + resolvedBonus.amount;
  const modifier = result.modifier + resolvedBonus.modifier;

  const success = result.dc === null
    ? null
    : result.critical === 'success'
      ? true
      : result.critical === 'failure'
        ? false
        : total >= result.dc;
  const bonusSegments = resolvedBonus.rollSegments?.map((segment) => ({
    ...segment,
    source: 'bonus' as const,
  })) ?? (resolvedBonus.amount !== 0
      ? [{
          type: 'modifier' as const,
          source: 'bonus' as const,
          sign: resolvedBonus.amount >= 0 ? 1 : -1,
          value: Math.abs(resolvedBonus.amount),
        }]
      : []);

  return {
    ...result,
    notation: extendDiceNotation(result.notation, bonus),
    baseNotation: result.baseNotation ?? result.notation,
    rolls: resolvedBonus.rolls ? [...result.rolls, ...resolvedBonus.rolls] : result.rolls,
    keptRolls: resolvedBonus.keptRolls
      ? [...(result.keptRolls ?? []), ...resolvedBonus.keptRolls]
      : result.keptRolls,
    droppedRolls: resolvedBonus.droppedRolls
      ? [...(result.droppedRolls ?? []), ...resolvedBonus.droppedRolls]
      : result.droppedRolls,
    rollSegments: [...(result.rollSegments ?? []), ...bonusSegments],
    total,
    modifier,
    success,
    successReason: result.dc === null
      ? null
      : result.critical === 'success'
        ? 'critical-success'
        : result.critical === 'failure'
          ? 'critical-failure'
          : 'dc',
    appliedBonus,
    bonusNotation: resolvedBonus.notation ?? result.bonusNotation,
    bonusStage: options?.stage ?? result.bonusStage ?? null,
    bonusItemId: options?.itemId ?? result.bonusItemId,
    bonusItemName: options?.itemName ?? result.bonusItemName,
  };
}

// Roll with bonus applied (for items like "Flash of Genius")
  export function rollWithBonus(notation: string, dc: number, bonus: string | number): DiceResult {
    return applyBonusToDiceResult(rollDice(notation, dc), bonus);
}

// Common dice notations for quick reference
export const COMMON_NOTATIONS = {
  d4: '1d4',
  d6: '1d6',
  d8: '1d8',
  d10: '1d10',
  d12: '1d12',
  d20: '1d20',
  d100: '1d100',
} as const;

// Generate random dice notation for animation
export function generateRandomDiceFace(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}
