/**
 * Unit tests for offsession
 * Tests the core game logic functions
 */

import { describe, it, expect } from 'bun:test';
import { 
  applyBonusToDiceResult,
  parseDiceNotation, 
  rollDice, 
  rollWithBonus,
  applyAdvantage,
  applyDisadvantage,
  addModifier
} from '../lib/dice';
import { evaluateCondition, parseAdventureYaml } from '../lib/adventure-utils';

function withMockRandom<T>(values: number[], callback: () => T): T {
  const originalRandom = Math.random;
  let index = 0;
  Math.random = () => {
    const value = values[Math.min(index, values.length - 1)] ?? 0;
    index += 1;
    return value;
  };

  try {
    return callback();
  } finally {
    Math.random = originalRandom;
  }
}

// ============================================
// DICE MODULE TESTS
// ============================================

describe('Dice Module', () => {
  describe('parseDiceNotation', () => {
    it('should parse basic notation', () => {
      const result = parseDiceNotation('1d20');
      expect(result.count).toBe(1);
      expect(result.sides).toBe(20);
      expect(result.modifier).toBe(0);
    });

    it('should parse notation with modifier', () => {
      const result = parseDiceNotation('2d6+3');
      expect(result.count).toBe(2);
      expect(result.sides).toBe(6);
      expect(result.modifier).toBe(3);
    });

    it('should parse notation with negative modifier', () => {
      const result = parseDiceNotation('1d20-5');
      expect(result.count).toBe(1);
      expect(result.sides).toBe(20);
      expect(result.modifier).toBe(-5);
    });

    it('should parse shorthand notation (d20)', () => {
      const result = parseDiceNotation('d20');
      expect(result.count).toBe(1);
      expect(result.sides).toBe(20);
    });

    it('should parse advantage notation (2d20kh1)', () => {
      const result = parseDiceNotation('2d20kh1');
      expect(result.count).toBe(2);
      expect(result.sides).toBe(20);
      expect(result.keepHighest).toBe(1);
    });

    it('should parse disadvantage notation (2d20kl1)', () => {
      const result = parseDiceNotation('2d20kl1');
      expect(result.count).toBe(2);
      expect(result.sides).toBe(20);
      expect(result.keepLowest).toBe(1);
    });

    it('should throw on invalid notation', () => {
      expect(() => parseDiceNotation('invalid')).toThrow();
      expect(() => parseDiceNotation('1d3')).toThrow(); // Invalid die size
    });
  });

  describe('rollDice', () => {
    it('should return a valid dice result', () => {
      const result = rollDice('1d20', 10);
      
      expect(result.notation).toBe('1d20');
      expect(result.rolls).toHaveLength(1);
      expect(result.rolls[0]).toBeGreaterThanOrEqual(1);
      expect(result.rolls[0]).toBeLessThanOrEqual(20);
      expect(result.success).toBe(result.total >= 10);
      expect(result.dc).toBe(10);
    });

    it('should correctly calculate total with modifier', () => {
      const result = rollDice('1d20+5', 15);
      
      expect(result.total).toBe(result.rolls[0] + 5);
      expect(result.modifier).toBe(5);
    });

    it('should roll multiple dice', () => {
      const result = rollDice('3d6');
      
      expect(result.rolls).toHaveLength(3);
      result.rolls.forEach(roll => {
        expect(roll).toBeGreaterThanOrEqual(1);
        expect(roll).toBeLessThanOrEqual(6);
      });
    });

    it('should handle advantage rolls', () => {
      const result = rollDice('2d20kh1', 10);
      
      expect(result.rolls).toHaveLength(2);
      expect(result.keptRolls).toBeDefined();
      expect(result.droppedRolls).toBeDefined();
      expect(result.rollSegments?.[0].type).toBe('dice');
      expect(result.rollSegments?.[0].rolls?.map((roll) => roll.kept)).toContain(false);
      expect(result.keptRolls!.length).toBe(1);
      expect(result.advantage).toBe('advantage');
    });

    it('should handle disadvantage rolls', () => {
      const result = rollDice('2d20kl1', 10);
      
      expect(result.rolls).toHaveLength(2);
      expect(result.keptRolls).toBeDefined();
      expect(result.droppedRolls).toBeDefined();
      expect(result.keptRolls!.length).toBe(1);
      expect(result.advantage).toBe('disadvantage');
    });

    it('should roll composite expressions with flat modifiers', () => {
      const result = rollDice('3d12 + 2d20kh1 + 15');

      expect(result.rolls).toHaveLength(5);
      expect(result.modifier).toBe(15);
      expect(result.total).toBeGreaterThanOrEqual(19);
      expect(result.total).toBeLessThanOrEqual(71);
      expect(result.keptRolls).toBeDefined();
      expect(result.droppedRolls).toBeDefined();
      expect(result.droppedRolls!.length).toBe(1);
    });

    it('treats a natural 20 on the kept d20 as an automatic success', () => {
      const result = withMockRandom([0.9999], () => rollDice('1d20', 30));

      expect(result.total).toBe(20);
      expect(result.success).toBe(true);
      expect(result.critical).toBe('success');
      expect(result.successReason).toBe('critical-success');
    });

    it('treats a natural 1 on the kept d20 as an automatic failure', () => {
      const result = withMockRandom([0], () => rollDice('1d20+10', 5));

      expect(result.total).toBe(11);
      expect(result.success).toBe(false);
      expect(result.critical).toBe('failure');
      expect(result.successReason).toBe('critical-failure');
    });

    it('uses the kept d20 for advantage and disadvantage critical checks', () => {
      const advantageResult = withMockRandom([0, 0.9999], () => rollDice('2d20kh1', 40));
      const disadvantageResult = withMockRandom([0, 0.9999], () => rollDice('2d20kl1', 2));

      expect(advantageResult.keptD20).toBe(20);
      expect(advantageResult.critical).toBe('success');
      expect(advantageResult.success).toBe(true);

      expect(disadvantageResult.keptD20).toBe(1);
      expect(disadvantageResult.critical).toBe('failure');
      expect(disadvantageResult.success).toBe(false);
    });
  });

  describe('rollWithBonus', () => {
    it('should add bonus to roll', () => {
      const result = rollWithBonus('1d20', 15, 5);
      
      expect(result.total).toBe(result.rolls[0] + 5);
      expect(result.modifier).toBe(5);
    });

    it('supports dice-notation bonuses without collapsing them to a flat modifier', () => {
      const result = withMockRandom([0.4, 0.5], () => rollWithBonus('1d20', 15, '1d4'));

      expect(result.total).toBe(9 + 3);
      expect(result.rolls).toEqual([9, 3]);
      expect(result.modifier).toBe(0);
      expect(result.bonusNotation).toBe('1d4');
      expect(result.notation).toBe('1d20 + 1d4');
      expect(result.rollSegments?.map((segment) => segment.source)).toEqual(['base', 'bonus']);
    });

    it('applies a post-roll bonus without changing the underlying dice', () => {
      const base = withMockRandom([0.4], () => rollDice('1d20', 15));
      const updated = applyBonusToDiceResult(base, 6, { itemId: 'blessing', itemName: 'Blessing', stage: 'after' });

      expect(updated.rolls).toEqual(base.rolls);
      expect(updated.total).toBe(base.total + 6);
      expect(updated.modifier).toBe(base.modifier + 6);
      expect(updated.success).toBe(true);
      expect(updated.bonusItemId).toBe('blessing');
      expect(updated.bonusStage).toBe('after');
      expect(updated.rollSegments?.at(-1)).toMatchObject({
        type: 'modifier',
        source: 'bonus',
        value: 6,
      });
    });

    it('applies a dice-notation post-roll bonus using the rolled bonus amount', () => {
      const base = withMockRandom([0.4], () => rollDice('1d20', 15));
      const updated = withMockRandom([0.75], () => applyBonusToDiceResult(base, '1d4', { itemId: 'blessing', itemName: 'Blessing', stage: 'after' }));

      expect(updated.rolls).toEqual([9, 4]);
      expect(updated.total).toBe(13);
      expect(updated.modifier).toBe(base.modifier);
      expect(updated.bonusNotation).toBe('1d4');
      expect(updated.notation).toBe('1d20 + 1d4');
      expect(updated.success).toBe(false);
    });
  });

  describe('applyAdvantage', () => {
    it('should convert d20 to advantage notation', () => {
      expect(applyAdvantage('1d20')).toBe('2d20kh1');
      expect(applyAdvantage('d20+3')).toBe('2d20kh1+3');
    });

    it('should not modify non-d20 rolls', () => {
      expect(applyAdvantage('2d6')).toBe('2d6');
    });
  });

  describe('applyDisadvantage', () => {
    it('should convert d20 to disadvantage notation', () => {
      expect(applyDisadvantage('1d20')).toBe('2d20kl1');
      expect(applyDisadvantage('d20-2')).toBe('2d20kl1-2');
    });

    it('should not modify non-d20 rolls', () => {
      expect(applyDisadvantage('2d6')).toBe('2d6');
    });
  });

  describe('addModifier', () => {
    it('should add positive modifier', () => {
      expect(addModifier('1d20', 5)).toBe('1d20+5');
      expect(addModifier('1d20+3', 2)).toBe('1d20+5');
    });

    it('should add negative modifier', () => {
      expect(addModifier('1d20', -3)).toBe('1d20-3');
      expect(addModifier('1d20+2', -5)).toBe('1d20-3');
    });

    it('should handle advantage notation', () => {
      expect(addModifier('2d20kh1', 3)).toBe('2d20kh1+3');
    });

    it('should add modifiers to composite notation', () => {
      expect(addModifier('3d12 + 2d20kh1 + 15', 2)).toBe('3d12+2d20kh1+17');
      expect(addModifier('3d12+2d20kh1+15', -20)).toBe('3d12+2d20kh1-5');
    });
  });
});

// ============================================
// ADVENTURE UTILS TESTS
// ============================================

describe('Adventure Utils', () => {
  describe('evaluateCondition', () => {
    it('supports numeric and boolean counter comparisons', () => {
      const state = {
        counters: {
          suspicion: 3,
          gate_open: true,
        },
        inventory: {},
      };

      expect(evaluateCondition({ counter: 'suspicion', greater_or_equal: 3 }, state)).toBe(true);
      expect(evaluateCondition({ counter: 'suspicion', less_than: 3 }, state)).toBe(false);
      expect(evaluateCondition({ counter: 'gate_open', equals: true }, state)).toBe(true);
      expect(evaluateCondition({ counter: 'gate_open', not_equals: false }, state)).toBe(true);
    });
  });

  describe('parseAdventureYaml', () => {
    it('should parse valid YAML', () => {
      const yaml = `
meta:
  title: "Test Adventure"
  theme: "neon-mana-circuit"
scenes:
  - id: start
    title: "Start"
    description: "Test"
    exits:
      - text: "Go"
        target: end
  - id: end
    title: "End"
    description: "Done"
    exits: []
`;
      const result = parseAdventureYaml(yaml);
      
      expect(result.meta.title).toBe('Test Adventure');
      expect(result.meta.theme).toBe('neon-mana-circuit');
      expect(result.scenes).toHaveLength(2);
      expect(result.sceneMap['start']).toBeDefined();
    });

    it('should default one_shot to true', () => {
      const yaml = `
meta:
  title: "Test"
  theme: "neon-mana-circuit"
scenes:
  - id: start
    title: "Start"
    description: "Test"
    exits: []
`;
      const result = parseAdventureYaml(yaml);
      expect(result.meta.one_shot).toBe(true);
    });

    it('should parse one_shot when set to false', () => {
      const yaml = `
meta:
  title: "Test"
  theme: "neon-mana-circuit"
  one_shot: false
scenes:
  - id: start
    title: "Start"
    description: "Test"
    exits: []
`;
      const result = parseAdventureYaml(yaml);
      expect(result.meta.one_shot).toBe(false);
    });

    it('should parse inventory items', () => {
      const yaml = `
meta:
  title: "Test"
  theme: "neon-mana-circuit"
inventory:
  gold_coin:
    name: "Gold"
    description: "Money"
    type: "currency"
    default: 10
  lucky_charm:
    name: "Lucky Charm"
    description: "Reroll"
    type: "reroll"
    icon: "sword"
    color: "purple"
scenes:
  - id: start
    title: "Start"
    description: "Test"
    icon: "castle-emblem"
    exits: []
`;
      const result = parseAdventureYaml(yaml);
      
      expect(result.inventory['gold_coin']).toBeDefined();
      expect(result.inventory['gold_coin'].type).toBe('currency');
      expect(result.inventory['gold_coin'].default).toBe(10);
      expect(result.inventory['lucky_charm'].type).toBe('reroll');
      expect(result.inventory['lucky_charm'].icon).toBe('sword');
      expect(result.inventory['lucky_charm'].color).toBe('purple');
      expect(result.scenes[0].icon).toBe('castle-emblem');
    });

    it('defaults bonus timing to both and preserves explicit timing values', () => {
      const yaml = `
meta:
  title: "Test"
  theme: "neon-mana-circuit"
inventory:
  open_bonus:
    name: "Open Bonus"
    description: "Works anytime"
    type: "bonus"
    value: "2"
  before_bonus:
    name: "Before Bonus"
    description: "Must be committed before the roll"
    type: "bonus"
    value: "4"
    bonus_timing: "before"
scenes:
  - id: start
    title: "Start"
    description: "Test"
    exits: []
`;
      const result = parseAdventureYaml(yaml);

      expect(result.inventory['open_bonus'].bonus_timing).toBe('both');
      expect(result.inventory['before_bonus'].bonus_timing).toBe('before');
    });
  });
});
