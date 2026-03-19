import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { evaluateCondition, parseAdventureYaml, ParsedAdventure, SceneDefinition, verifyPassword } from '@/lib/adventure-utils';
import { applyAdvantage, applyDisadvantage, addModifier, DiceResult, rollDice } from '@/lib/dice';
import { createGameStateSnapshot, GameHistoryEntry, GameState, normalizeHistoryEntry } from '@/lib/game-state';
import { nanoid } from 'nanoid';
import { sendAdventureNotification } from '@/lib/discord-webhook';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

interface ExitForClient {
  exitIndex: number;
  text: string;
  target?: string;
  hasGate: boolean;
  gateText?: string;
  gateShortText?: string;
  showShort?: boolean;
  dc?: number;
  requiresItem?: { id: string; amount?: number; itemName?: string } | null;
  isOneTime: boolean;
  isUsed: boolean;
  canUse: boolean;
  reason?: string;
}

// Helper: Check if exit is visible
function isExitVisible(exit: SceneDefinition['exits'][0], state: GameState): boolean {
  if (exit.visible_if) {
    return evaluateCondition(exit.visible_if, state);
  }
  return true;
}

// Helper: Check if exit can be used
function checkExit(exit: SceneDefinition['exits'][0], state: GameState): { canUse: boolean; reason?: string } {
  const exitKey = `${state.currentSceneId}:${exit.text}`;
  
  // Check one-time
  if (exit.one_time && state.usedExits.includes(exitKey)) {
    return { canUse: false, reason: 'This path is no longer available.' };
  }

  // Check item requirements
  if (exit.requires_item) {
    const has = state.inventory[exit.requires_item.id] || 0;
    const needed = exit.requires_item.amount || 1;
    if (has < needed) {
      return { canUse: false, reason: `You need ${needed} of the required item.` };
    }
  }

  return { canUse: true };
}

// Helper: Format exits for client
function formatExits(scene: SceneDefinition, state: GameState, parsed: ParsedAdventure): ExitForClient[] {
  return scene.exits
    .map((exit, exitIndex) => ({ exit, exitIndex }))
    .filter(({ exit }) => isExitVisible(exit, state))
    .map(({ exit, exitIndex }) => {
      const check = checkExit(exit, state);
      return {
        exitIndex,
        text: exit.text,
        target: exit.target,
        hasGate: !!exit.gate,
        gateText: exit.gate?.text,
        gateShortText: exit.gate?.short_text,
        showShort: exit.gate?.show_short,
        dc: exit.gate?.dc,
        requiresItem: exit.requires_item ? {
          id: exit.requires_item.id,
          amount: exit.requires_item.amount,
          itemName: parsed.inventory[exit.requires_item.id]?.name,
        } : null,
        isOneTime: exit.one_time || false,
        isUsed: exit.one_time ? state.usedExits.includes(`${state.currentSceneId}:${exit.text}`) : false,
        canUse: check.canUse,
        reason: check.reason,
      };
    });
}

// Helper: Create initial game state
function createInitialState(sessionId: string, adventureId: string, parsed: ParsedAdventure): GameState {
  const counters: Record<string, number | boolean> = {};
  for (const [key, def] of Object.entries(parsed.counters)) {
    counters[key] = def.default;
  }

  const inventory: Record<string, number> = {};
  for (const [key, def] of Object.entries(parsed.inventory)) {
    if (def.default !== undefined) {
      inventory[key] = def.default;
    } else if (def.type === 'currency') {
      inventory[key] = 0;
    }
  }

  const state: GameState = {
    id: sessionId,
    adventureId,
    currentSceneId: 'start',
    counters,
    inventory,
    usedExits: [],
    history: [],
    completed: false,
  };

  const initialEntry: GameHistoryEntry = {
      timestamp: new Date().toISOString(),
      action: 'Adventure Started',
      sceneId: 'start',
      type: 'system',
      snapshot: createGameStateSnapshot(state, false),
    };

  state.history.push(initialEntry);

  return state;
}

// Helper: Save game state to database
async function saveGameState(state: GameState): Promise<void> {
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

// Helper: Load game state from database
async function loadGameState(sessionId: string): Promise<GameState | null> {
  const record = await db.gameState.findUnique({
    where: { id: sessionId },
  });

  if (!record) return null;

  return {
    id: record.id,
    adventureId: record.adventureId,
    currentSceneId: record.currentSceneId,
    counters: JSON.parse(record.counters),
    inventory: JSON.parse(record.inventory),
    usedExits: JSON.parse(record.usedExits),
    history: JSON.parse(record.history).map((entry: unknown) => normalizeHistoryEntry(entry)),
    completed: false,
  };
}

// POST - Start a new game session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { adventureId, playerPassword } = body;

    if (!adventureId) {
      return NextResponse.json({ error: 'Adventure ID required' }, { status: 400 });
    }

    // Get adventure
    const adventure = await db.adventure.findUnique({
      where: { id: adventureId },
    });

    if (!adventure) {
      return NextResponse.json({ error: 'Adventure not found' }, { status: 404 });
    }

    if (adventure.playerPasswordHash) {
      if (typeof playerPassword !== 'string' || playerPassword.length === 0) {
        return NextResponse.json({ error: 'Player password required' }, { status: 401 });
      }

      const isValidPassword = await verifyPassword(playerPassword, adventure.playerPasswordHash);
      if (!isValidPassword) {
        return NextResponse.json({ error: 'Invalid player password' }, { status: 401 });
      }
    }

    // Parse YAML
    const parsed = parseAdventureYaml(adventure.yamlContent);

    // Check one_shot - only allow one session
    if (parsed.meta.one_shot) {
      const existingSession = await db.gameState.findFirst({
        where: { adventureId },
      });
      
      if (existingSession) {
        const state = await loadGameState(existingSession.id);
        if (state) {
          const currentScene = parsed.sceneMap[state.currentSceneId];
          const exits = formatExits(currentScene, state, parsed);
          const isCompleted = exits.length === 0;
          
          return NextResponse.json({
            sessionId: state.id,
            state: {
              currentSceneId: state.currentSceneId,
              inventory: state.inventory,
              history: state.history,
              completed: isCompleted,
            },
            scene: {
              id: currentScene.id,
              title: currentScene.title,
              description: currentScene.description,
              image: currentScene.image,
              icon: currentScene.icon,
              exits,
            },
            inventory: parsed.inventory,
            meta: parsed.meta,
            oneShotResumed: true,
          });
        }
      }
    }

    // Create new session
    const sessionId = nanoid(16);
    const state = createInitialState(sessionId, adventureId, parsed);
    await saveGameState(state);

    const startScene = parsed.sceneMap['start'];

    await sendAdventureNotification('started', {
      adventureId: adventure.id,
      title: adventure.title,
      theme: adventure.theme,
      sessionId: state.id,
      baseUrl: request.nextUrl.origin,
    });

    return NextResponse.json({
      sessionId: state.id,
      state: {
        currentSceneId: state.currentSceneId,
        inventory: state.inventory,
        history: state.history,
        completed: state.completed,
      },
      scene: {
        id: startScene.id,
        title: startScene.title,
        description: startScene.description,
        image: startScene.image,
        icon: startScene.icon,
        exits: formatExits(startScene, state, parsed),
      },
      inventory: parsed.inventory,
      meta: parsed.meta,
    });
  } catch (error) {
    console.error('Error starting game:', error);
    return NextResponse.json(
      { error: 'Failed to start game: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}
