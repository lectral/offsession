import type { DiceResult as HistoryDiceResult } from '@/lib/dice';
import { evaluateCondition, type InventoryItemDefinition as HistoryInventoryItemDefinition } from '@/lib/adventure-utils';

export interface GameStateSnapshot {
  currentSceneId: string;
  counters: Record<string, number | boolean>;
  inventory: Record<string, number>;
  usedExits: string[];
  completed: boolean;
}

export interface GameHistoryItemRecord {
  id: string;
  name: string;
  type: HistoryInventoryItemDefinition['type'];
  value?: string;
  bonusTiming?: HistoryInventoryItemDefinition['bonus_timing'];
}

export type GameHistoryEventType = 'system' | 'roll' | 'transition' | 'item' | 'resolution';

export interface GameHistoryEntry {
  timestamp: string;
  action: string;
  sceneId: string;
  details?: string;
  type?: GameHistoryEventType;
  roll?: HistoryDiceResult;
  item?: GameHistoryItemRecord;
  snapshot?: GameStateSnapshot;
}

export interface GameState {
  id: string;
  adventureId: string;
  currentSceneId: string;
  counters: Record<string, number | boolean>;
  inventory: Record<string, number>;
  usedExits: string[];
  history: GameHistoryEntry[];
  completed: boolean;
}

export function createGameStateSnapshot(state: GameState, completed: boolean): GameStateSnapshot {
  return {
    currentSceneId: state.currentSceneId,
    counters: { ...state.counters },
    inventory: { ...state.inventory },
    usedExits: [...state.usedExits],
    completed,
  };
}

export function normalizeHistoryEntry(entry: unknown): GameHistoryEntry {
  if (!entry || typeof entry !== 'object') {
    return {
      timestamp: new Date(0).toISOString(),
      action: 'Unknown event',
      sceneId: 'unknown',
      details: 'History entry could not be parsed.',
      type: 'system',
    };
  }

  const record = entry as Partial<GameHistoryEntry>;
  return {
    timestamp: typeof record.timestamp === 'string' ? record.timestamp : new Date(0).toISOString(),
    action: typeof record.action === 'string' ? record.action : 'Unknown event',
    sceneId: typeof record.sceneId === 'string' ? record.sceneId : 'unknown',
    details: typeof record.details === 'string' ? record.details : undefined,
    type: record.type,
    roll: record.roll,
    item: record.item,
    snapshot: record.snapshot,
  };
}import { db } from '@/lib/db';
import { 
  ParsedAdventure, 
  SceneDefinition, 
  ExitDefinition,
  InventoryItemDefinition 
} from './adventure-utils';
import { DiceResult, rollDice, rollWithBonus } from './dice';

export interface GameState {
  id: string;
  adventureId: string;
  currentSceneId: string;
  counters: Record<string, number | boolean>;
  inventory: Record<string, number>;
  usedExits: string[];
  history: GameHistoryEntry[];
  completed: boolean;
}

export interface HistoryEntry {
  timestamp: string;
  action: string;
  sceneId: string;
  details?: string;
}

export interface ExitCheckResult {
  canUse: boolean;
  reason?: string;
}

export interface ExitUseResult {
  success: boolean;
  newState: GameState;
  newScene: SceneDefinition;
  diceResult?: DiceResult;
  consumedItems?: string[];
}

// Initialize a new game state
export function createInitialState(
  sessionId: string,
  adventureId: string,
  adventure: ParsedAdventure
): GameState {
  const counters: Record<string, number | boolean> = {};
  for (const [key, def] of Object.entries(adventure.counters)) {
    counters[key] = def.default;
  }

  const inventory: Record<string, number> = {};
  for (const [key, def] of Object.entries(adventure.inventory)) {
    if (def.default !== undefined) {
      inventory[key] = def.default;
    } else if (def.type === 'currency') {
      inventory[key] = 0;
    }
  }

  return {
    id: sessionId,
    adventureId,
    currentSceneId: 'start',
    counters,
    inventory,
    usedExits: [],
    history: [{
      timestamp: new Date().toISOString(),
      action: 'Adventure Started',
      sceneId: 'start',
    }],
    completed: false,
  };
}

// Check if an exit can be used
export function checkExit(
  exit: ExitDefinition,
  state: GameState,
  adventure: ParsedAdventure
): ExitCheckResult {
  // Check one_time
  const exitKey = `${state.currentSceneId}:${exit.text}`;
  if (exit.one_time && state.usedExits.includes(exitKey)) {
    return { canUse: false, reason: 'This path is no longer available.' };
  }

  // Check requires_item
  if (exit.requires_item) {
    const itemId = exit.requires_item.id;
    const required = exit.requires_item.amount || 1;
    const has = state.inventory[itemId] || 0;
    
    if (has < required) {
      const item = adventure.inventory[itemId];
      return { 
        canUse: false, 
        reason: `You need ${required} ${item?.name || itemId}.` 
      };
    }
  }

  // Check visible_if
  if (exit.visible_if) {
    if (!evaluateCondition(exit.visible_if, state)) {
      return { canUse: false, reason: 'Condition not met.' };
    }
  }

  return { canUse: true };
}

// Check if exit is visible
export function isExitVisible(
  exit: ExitDefinition,
  state: GameState,
  adventure: ParsedAdventure
): boolean {
  if (exit.visible_if) {
    return evaluateCondition(exit.visible_if, state);
  }
  return true;
}

// Execute an exit and update state
export async function executeExit(
  exit: ExitDefinition,
  state: GameState,
  adventure: ParsedAdventure,
  diceNotation?: string,
  bonusValue?: number
): Promise<ExitUseResult> {
  const newState = JSON.parse(JSON.stringify(state)) as GameState;
  const consumedItems: string[] = [];

  // Handle gated exit
  if (exit.gate) {
    if (!diceNotation) {
      throw new Error('Dice notation required for gated exit');
    }

    let diceResult: DiceResult;
    if (bonusValue !== undefined) {
      diceResult = rollWithBonus(diceNotation, exit.gate.dc, bonusValue);
    } else {
      diceResult = rollDice(diceNotation, exit.gate.dc);
    }

    const targetScene = diceResult.success ? exit.target : exit.gate.failure_target;
    if (!targetScene) {
      throw new Error(`Exit "${exit.text}" is missing a target scene`);
    }
    
    // Add to history
    newState.history.push({
      timestamp: new Date().toISOString(),
      action: `Rolled ${diceNotation} for "${exit.text}"`,
      sceneId: state.currentSceneId,
      details: `Result: ${diceResult.total} (${diceResult.success ? 'Success' : 'Failure'})`,
    });

    // Mark one-time exit as used
    if (exit.one_time) {
      const exitKey = `${state.currentSceneId}:${exit.text}`;
      newState.usedExits.push(exitKey);
    }

    newState.currentSceneId = targetScene;

    return {
      success: diceResult.success || false,
      newState,
      newScene: adventure.sceneMap[targetScene],
      diceResult,
      consumedItems,
    };
  }

  // Handle item requirements
  if (exit.requires_item) {
    const itemId = exit.requires_item.id;
    const amount = exit.requires_item.amount || 1;
    const item = adventure.inventory[itemId];

    if (item) {
      if (item.type === 'currency') {
        newState.inventory[itemId] = (newState.inventory[itemId] || 0) - amount;
      } else {
        // Remove item (consumed by default)
        delete newState.inventory[itemId];
        consumedItems.push(itemId);
      }
    }
  }

  // Apply effects
  if (exit.effects) {
    if (exit.effects.set_counter) {
      for (const [key, value] of Object.entries(exit.effects.set_counter)) {
        newState.counters[key] = value;
      }
    }
    if (exit.effects.add_item) {
      newState.inventory[exit.effects.add_item] = 1;
    }
    if (exit.effects.remove_item) {
      delete newState.inventory[exit.effects.remove_item];
    }
    if (exit.effects.add_currency) {
      for (const [key, value] of Object.entries(exit.effects.add_currency)) {
        newState.inventory[key] = (newState.inventory[key] || 0) + value;
      }
    }
  }

  // Mark one-time exit
  if (exit.one_time) {
    const exitKey = `${state.currentSceneId}:${exit.text}`;
    newState.usedExits.push(exitKey);
  }

  // Add to history
  if (!exit.target) {
    throw new Error(`Exit "${exit.text}" is missing a target scene`);
  }

  newState.history.push({
    timestamp: new Date().toISOString(),
    action: `Chose "${exit.text}"`,
    sceneId: exit.target,
  });

  newState.currentSceneId = exit.target;

  // Check if this scene has no exits (ending)
  const targetScene = adventure.sceneMap[exit.target];
  if (targetScene.exits.length === 0) {
    newState.completed = true;
  }

  return {
    success: true,
    newState,
    newScene: targetScene,
    consumedItems,
  };
}

// Consume an item (reroll or bonus)
export function consumeItem(
  itemId: string,
  state: GameState,
  adventure: ParsedAdventure
): { newState: GameState; item: InventoryItemDefinition } | null {
  const item = adventure.inventory[itemId];
  if (!item || !state.inventory[itemId]) {
    return null;
  }

  const newState = JSON.parse(JSON.stringify(state)) as GameState;
  
  // Handle usage count
  if (item.usage_count && item.usage_count > 1) {
    // Decrease usage count (stored in state)
    const usageKey = `_usage_${itemId}`;
    const currentUsage = (newState.inventory[usageKey] as number) ?? item.usage_count;
    if (currentUsage <= 1) {
      delete newState.inventory[itemId];
      delete newState.inventory[usageKey];
    } else {
      newState.inventory[usageKey] = currentUsage - 1;
    }
  } else {
    // Consume item
    delete newState.inventory[itemId];
  }

  return { newState, item };
}

// Save game state to database
export async function saveGameState(state: GameState): Promise<void> {
  await db.gameState.upsert({
    where: { id: state.id },
    create: {
      id: state.id,
      adventureId: state.adventureId,
      currentSceneId: state.currentSceneId,
      counters: JSON.stringify(state.counters),
      inventory: JSON.stringify(state.inventory),
      usedExits: JSON.stringify(state.usedExits),
      history: JSON.stringify(state.history),
    },
    update: {
      currentSceneId: state.currentSceneId,
      counters: JSON.stringify(state.counters),
      inventory: JSON.stringify(state.inventory),
      usedExits: JSON.stringify(state.usedExits),
      history: JSON.stringify(state.history),
    },
  });
}

// Load game state from database
export async function loadGameState(sessionId: string): Promise<GameState | null> {
  const record = await db.gameState.findUnique({
    where: { id: sessionId },
  });

  if (!record) {
    return null;
  }

  return {
    id: record.id,
    adventureId: record.adventureId,
    currentSceneId: record.currentSceneId,
    counters: JSON.parse(record.counters),
    inventory: JSON.parse(record.inventory),
    usedExits: JSON.parse(record.usedExits),
    history: JSON.parse(record.history),
    completed: false, // Will be determined by scene
  };
}
