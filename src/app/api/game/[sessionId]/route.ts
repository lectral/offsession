import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { evaluateCondition, parseAdventureYaml, ParsedAdventure, SceneDefinition, verifyPassword } from '@/lib/adventure-utils';
import { applyBonusToDiceResult, DiceResult, rollDice } from '@/lib/dice';
import { createGameStateSnapshot, GameHistoryEntry, GameState, normalizeHistoryEntry } from '@/lib/game-state';
import { sendAdventureNotification } from '@/lib/discord-webhook';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

interface PendingGateState {
  sceneId: string;
  exitIndex: number;
  rerollArmed: boolean;
  lastRoll?: DiceResult;
}

interface PendingGateForClient {
  exitIndex: number;
  rerollArmed: boolean;
  lastRoll?: DiceResult;
}

interface ExitForClient {
  exitIndex: number;
  text: string;
  target?: string;
  hasGate: boolean;
  gateText?: string;
  gateShortText?: string;
  showShort?: boolean;
  dc?: number;
  color?: string;
  requiresItem?: { id: string; amount?: number; itemName?: string } | null;
  isOneTime: boolean;
  isUsed: boolean;
  canUse: boolean;
  reason?: string;
}

interface SceneItemChangeForClient {
  id: string;
  itemName: string;
  amount: number;
  text?: string;
  type: 'add' | 'remove';
}

const PENDING_GATE_PREFIX = '__pending_gate__:';

function encodePendingGate(pendingGate: PendingGateState): string {
  return `${PENDING_GATE_PREFIX}${Buffer.from(JSON.stringify(pendingGate), 'utf8').toString('base64url')}`;
}

function getPendingGate(state: GameState): PendingGateState | null {
  const encoded = state.usedExits.find(entry => entry.startsWith(PENDING_GATE_PREFIX));
  if (!encoded) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(encoded.slice(PENDING_GATE_PREFIX.length), 'base64url').toString('utf8')) as PendingGateState;
  } catch {
    return null;
  }
}

function clearPendingGate(state: GameState): void {
  state.usedExits = state.usedExits.filter(entry => !entry.startsWith(PENDING_GATE_PREFIX));
}

function setPendingGate(state: GameState, pendingGate: PendingGateState): void {
  clearPendingGate(state);
  state.usedExits.push(encodePendingGate(pendingGate));
}

function getPendingGateForClient(state: GameState): PendingGateForClient | null {
  const pendingGate = getPendingGate(state);
  if (!pendingGate) {
    return null;
  }

  return {
    exitIndex: pendingGate.exitIndex,
    rerollArmed: pendingGate.rerollArmed,
    lastRoll: pendingGate.lastRoll,
  };
}

function buildStatePayload(state: GameState, completed: boolean) {
  return {
    currentSceneId: state.currentSceneId,
    inventory: state.inventory,
    history: state.history,
    completed,
    pendingGate: getPendingGateForClient(state),
  };
}

function appendHistoryEntry(
  state: GameState,
  completed: boolean,
  entry: Omit<GameHistoryEntry, 'snapshot'>
): void {
  state.history.push({
    ...entry,
    snapshot: createGameStateSnapshot(state, completed),
  });
}

function describeRollOutcome(result: DiceResult): string {
  if (result.success === null) {
    return `Result: ${result.total}`;
  }

  if (result.critical === 'success') {
    return `Result: ${result.total} (Critical Success)`;
  }

  if (result.critical === 'failure') {
    return `Result: ${result.total} (Critical Failure)`;
  }

  return `Result: ${result.total} (${result.success ? 'Success' : 'Failure'})`;
}

function getBonusTiming(item: ParsedAdventure['inventory'][string]): 'before' | 'after' | 'both' {
  return item.bonus_timing ?? 'both';
}

function canUseBonusAtStage(
  item: ParsedAdventure['inventory'][string],
  stage: 'before' | 'after'
): boolean {
  const timing = getBonusTiming(item);
  return timing === 'both' || timing === stage;
}

function consumeInventoryItem(state: GameState, itemId: string, item: ParsedAdventure['inventory'][string]): void {
  if (item.usage_count && item.usage_count > 1) {
    const usageKey = `_usage_${itemId}`;
    const currentUsage = (state.inventory[usageKey] as number) ?? item.usage_count;
    if (currentUsage <= 1) {
      delete state.inventory[itemId];
      delete state.inventory[usageKey];
    } else {
      state.inventory[usageKey] = currentUsage - 1;
    }
    return;
  }

  const currentCount = state.inventory[itemId] || 0;
  if (currentCount <= 1) {
    delete state.inventory[itemId];
  } else {
    state.inventory[itemId] = currentCount - 1;
  }
}

// Helper functions
function isExitVisible(exit: SceneDefinition['exits'][0], state: GameState): boolean {
  if (exit.visible_if) {
    return evaluateCondition(exit.visible_if, state);
  }
  return true;
}

function checkExit(exit: SceneDefinition['exits'][0], state: GameState): { canUse: boolean; reason?: string } {
  const exitKey = `${state.currentSceneId}:${exit.text}`;
  
  if (exit.one_time && state.usedExits.includes(exitKey)) {
    return { canUse: false, reason: 'This path is no longer available.' };
  }

  if (exit.requires_item) {
    const has = state.inventory[exit.requires_item.id] || 0;
    const needed = exit.requires_item.amount || 1;
    if (has < needed) {
      return { canUse: false, reason: `You need ${needed} of the required item.` };
    }
  }

  return { canUse: true };
}

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
        color: exit.color,
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

// Process scene item changes
function processSceneItemChanges(scene: SceneDefinition, state: GameState, parsed: ParsedAdventure): { changes: SceneItemChangeForClient[]; newState: GameState } {
  const newState: GameState = JSON.parse(JSON.stringify(state));
  const changes: SceneItemChangeForClient[] = [];

  // Handle add_items
  if (scene.add_items) {
    for (const itemChange of scene.add_items) {
      const item = parsed.inventory[itemChange.id];
      if (item) {
        const amount = Math.abs(itemChange.amount);
        newState.inventory[itemChange.id] = (newState.inventory[itemChange.id] || 0) + amount;
        changes.push({
          id: itemChange.id,
          itemName: item.name,
          amount: amount,
          text: itemChange.text,
          type: 'add',
        });
      }
    }
  }

  // Handle remove_items
  if (scene.remove_items) {
    for (const itemChange of scene.remove_items) {
      const item = parsed.inventory[itemChange.id];
      if (item) {
        const amount = Math.abs(itemChange.amount);
        const current = newState.inventory[itemChange.id] || 0;
        const newAmount = Math.max(0, current - amount);
        if (newAmount > 0) {
          newState.inventory[itemChange.id] = newAmount;
        } else {
          delete newState.inventory[itemChange.id];
        }
        changes.push({
          id: itemChange.id,
          itemName: item.name,
          amount: amount,
          text: itemChange.text,
          type: 'remove',
        });
      }
    }
  }

  return { changes, newState };
}

async function loadGameState(sessionId: string): Promise<GameState | null> {
  const record = await db.gameState.findUnique({ where: { id: sessionId } });
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

async function finalizePendingFailure(
  state: GameState,
  pendingGate: PendingGateState,
  parsed: ParsedAdventure,
  exit: SceneDefinition['exits'][0]
) {
  const resolvedState: GameState = JSON.parse(JSON.stringify(state));
  clearPendingGate(resolvedState);

  if (exit.one_time) {
    const exitKey = `${pendingGate.sceneId}:${exit.text}`;
    if (!resolvedState.usedExits.includes(exitKey)) {
      resolvedState.usedExits.push(exitKey);
    }
  }

  resolvedState.currentSceneId = exit.gate!.failure_target;

  const newScene = parsed.sceneMap[resolvedState.currentSceneId];
  const isCompleted = newScene.exits.length === 0;
  const { changes: itemChanges, newState: updatedState } = processSceneItemChanges(newScene, resolvedState, parsed);

  const finalState = itemChanges.length > 0 ? updatedState : resolvedState;

  appendHistoryEntry(finalState, isCompleted, {
    timestamp: new Date().toISOString(),
    action: `Failed "${exit.text}" and moved to "${newScene.title}"`,
    sceneId: newScene.id,
    details: pendingGate.lastRoll ? describeRollOutcome(pendingGate.lastRoll) : 'The failed check forced the failure path.',
    type: 'resolution',
    roll: pendingGate.lastRoll,
  });

  await saveGameState(finalState);

  return {
    success: true,
    state: buildStatePayload(finalState, isCompleted),
    scene: {
      id: newScene.id,
      title: newScene.title,
      description: newScene.description,
      image: newScene.image,
      icon: newScene.icon,
      exits: formatExits(newScene, finalState, parsed),
      itemChanges: itemChanges.length > 0 ? itemChanges : undefined,
    },
  };
}

// GET - Get current game state
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const state = await loadGameState(sessionId);

    if (!state) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const adventure = await db.adventure.findUnique({
      where: { id: state.adventureId },
    });

    if (!adventure) {
      return NextResponse.json({ error: 'Adventure not found' }, { status: 404 });
    }

    if (adventure.playerPasswordHash) {
      const playerPassword = request.nextUrl.searchParams.get('playerPassword');
      if (!playerPassword) {
        return NextResponse.json({ error: 'Player password required' }, { status: 401 });
      }

      const isValidPassword = await verifyPassword(playerPassword, adventure.playerPasswordHash);
      if (!isValidPassword) {
        return NextResponse.json({ error: 'Invalid player password' }, { status: 401 });
      }
    }

    const parsed = parseAdventureYaml(adventure.yamlContent);
    const currentScene = parsed.sceneMap[state.currentSceneId];

    if (!currentScene) {
      return NextResponse.json({ error: 'Current scene not found' }, { status: 404 });
    }

    // Process scene item changes
    const { changes: itemChanges, newState } = processSceneItemChanges(currentScene, state, parsed);

    // Save state if items changed
    if (itemChanges.length > 0) {
      await saveGameState(newState);
    }

    // Check if completed (no exits)
    const isCompleted = currentScene.exits.length === 0;

    return NextResponse.json({
      sessionId: state.id,
      state: buildStatePayload(newState, isCompleted),
      scene: {
        id: currentScene.id,
        title: currentScene.title,
        description: currentScene.description,
        image: currentScene.image,
        icon: currentScene.icon,
        exits: formatExits(currentScene, newState, parsed),
        itemChanges: itemChanges.length > 0 ? itemChanges : undefined,
      },
      inventory: parsed.inventory,
      meta: parsed.meta,
    });
  } catch (error) {
    console.error('Error fetching game state:', error);
    return NextResponse.json(
      { error: 'Failed to fetch game state' },
      { status: 500 }
    );
  }
}

// POST - Perform an action
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const body = await request.json();
    const { action, exitIndex, diceNotation, bonusValue, itemId, bonusStage } = body;

    const state = await loadGameState(sessionId);
    if (!state) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const adventure = await db.adventure.findUnique({
      where: { id: state.adventureId },
    });

    if (!adventure) {
      return NextResponse.json({ error: 'Adventure not found' }, { status: 404 });
    }

    const parsed = parseAdventureYaml(adventure.yamlContent);
    const currentScene = parsed.sceneMap[state.currentSceneId];
    const pendingGate = getPendingGate(state);

    if (pendingGate && action !== 'resolve_pending_gate' && action !== 'use_item' && action !== 'use_exit') {
      return NextResponse.json({ error: 'Resolve the pending failed roll first.' }, { status: 400 });
    }

    if (action === 'use_exit') {
      let exit = currentScene.exits[exitIndex];
      let activeScene = currentScene;
      const requestedBonusStage = bonusStage === 'before' || bonusStage === 'after' ? bonusStage : undefined;
      const isAfterBonusAttempt = Boolean(pendingGate && requestedBonusStage === 'after' && (bonusValue !== undefined || itemId));
      const isRerollAttempt = Boolean(pendingGate?.rerollArmed && requestedBonusStage !== 'after');

      if (pendingGate) {
        if (exitIndex !== pendingGate.exitIndex) {
          return NextResponse.json({ error: 'Resolve the pending failed roll before taking another action.' }, { status: 400 });
        }

        activeScene = parsed.sceneMap[pendingGate.sceneId];
        exit = activeScene?.exits[pendingGate.exitIndex];

        if (!pendingGate.rerollArmed && !isAfterBonusAttempt) {
          return NextResponse.json({ error: 'Use a reroll item, apply an after-roll bonus, or continue to the failure path.' }, { status: 400 });
        }
      }

      if (!exit) {
        return NextResponse.json({ error: 'Exit not found' }, { status: 400 });
      }

      const check = checkExit(exit, pendingGate ? { ...state, currentSceneId: activeScene.id } : state);
      if (!check.canUse && !pendingGate) {
        return NextResponse.json({ error: check.reason }, { status: 400 });
      }

      // If gated and no dice, request dice roll
      if (exit.gate && !diceNotation && !isAfterBonusAttempt) {
        return NextResponse.json({
          requiresDice: true,
          gate: {
            text: exit.gate.text,
            short_text: exit.gate.short_text,
            show_short: exit.gate.show_short,
            dc: exit.gate.dc,
          }
        });
      }

      // Create new state
      const newState: GameState = JSON.parse(JSON.stringify(state));
      const consumedItems: string[] = [];
      let diceResult: DiceResult | undefined;
      let bonusItem: ParsedAdventure['inventory'][string] | undefined;
      let resolvedBonusValue = typeof bonusValue === 'number' || typeof bonusValue === 'string' ? bonusValue : undefined;
      let resolvedBonusStage = requestedBonusStage;

      if (itemId) {
        const item = parsed.inventory[itemId];
        if (!item || !newState.inventory[itemId]) {
          return NextResponse.json({ error: 'Bonus item not available' }, { status: 400 });
        }

        if (item.type !== 'bonus') {
          return NextResponse.json({ error: 'Only bonus items can be applied to a roll.' }, { status: 400 });
        }

        resolvedBonusStage = resolvedBonusStage ?? (pendingGate && !pendingGate.rerollArmed ? 'after' : 'before');
        if (!canUseBonusAtStage(item, resolvedBonusStage)) {
          return NextResponse.json({ error: `${item.name} can only be used ${getBonusTiming(item)} the roll.` }, { status: 400 });
        }

        resolvedBonusValue = item.value ?? resolvedBonusValue;

        if (resolvedBonusStage === 'after') {
          if (!pendingGate?.lastRoll) {
            return NextResponse.json({ error: 'No failed roll is available for a post-roll bonus.' }, { status: 400 });
          }

          if (pendingGate.lastRoll.critical === 'failure') {
            return NextResponse.json({ error: 'Critical failures can only be answered with reroll items.' }, { status: 400 });
          }
        }

        bonusItem = item;
      }

      // Handle gated exit with dice roll
      if (exit.gate && (diceNotation || isAfterBonusAttempt)) {
        if (resolvedBonusStage === 'after') {
          diceResult = applyBonusToDiceResult(pendingGate!.lastRoll!, resolvedBonusValue || 0, {
            itemId,
            itemName: bonusItem?.name,
            stage: 'after',
          });
        } else {
          diceResult = rollDice(diceNotation!, exit.gate.dc);
          if (resolvedBonusValue !== undefined && resolvedBonusValue !== 0 && resolvedBonusValue !== '0') {
            diceResult = applyBonusToDiceResult(diceResult, resolvedBonusValue, {
              itemId,
              itemName: bonusItem?.name,
              stage: 'before',
            });
          } else {
            diceResult = {
              ...diceResult,
              baseNotation: diceNotation,
            };
          }
        }

        if (bonusItem && itemId) {
          consumeInventoryItem(newState, itemId, bonusItem);
          consumedItems.push(itemId);
        }

        const rollAction = resolvedBonusStage === 'after'
          ? `Applied ${bonusItem?.name || 'a bonus'} to "${exit.text}"`
          : `${isRerollAttempt ? 'Rerolled' : 'Rolled'} ${diceNotation} for "${exit.text}"`;

        if (!diceResult.success) {
          appendHistoryEntry(newState, false, {
            timestamp: new Date().toISOString(),
            action: rollAction,
            sceneId: activeScene.id,
            details: describeRollOutcome(diceResult),
            type: 'roll',
            roll: diceResult,
            item: bonusItem && itemId ? {
              id: itemId,
              name: bonusItem.name,
              type: bonusItem.type,
              value: bonusItem.value,
              bonusTiming: getBonusTiming(bonusItem),
            } : undefined,
          });

          if (resolvedBonusStage === 'after') {
            const failureTarget = exit.gate.failure_target;
            if (!failureTarget) {
              return NextResponse.json({ error: 'Failure target not found for this exit.' }, { status: 400 });
            }

            if (exit.one_time) {
              const exitKey = `${activeScene.id}:${exit.text}`;
              if (!newState.usedExits.includes(exitKey)) {
                newState.usedExits.push(exitKey);
              }
            }

            clearPendingGate(newState);
            newState.currentSceneId = failureTarget;
          } else {
            setPendingGate(newState, {
              sceneId: activeScene.id,
              exitIndex,
              rerollArmed: false,
              lastRoll: diceResult,
            });

            await saveGameState(newState);

            return NextResponse.json({
              success: true,
              diceResult,
              pendingGate: getPendingGateForClient(newState),
              consumedItems,
              state: buildStatePayload(newState, false),
              scene: {
                id: activeScene.id,
                title: activeScene.title,
                description: activeScene.description,
                image: activeScene.image,
                icon: activeScene.icon,
                exits: formatExits(activeScene, newState, parsed),
              },
            });
          }
        }

        if (diceResult.success) {
          appendHistoryEntry(newState, false, {
            timestamp: new Date().toISOString(),
            action: rollAction,
            sceneId: activeScene.id,
            details: describeRollOutcome(diceResult),
            type: 'roll',
            roll: diceResult,
            item: bonusItem && itemId ? {
              id: itemId,
              name: bonusItem.name,
              type: bonusItem.type,
              value: bonusItem.value,
              bonusTiming: getBonusTiming(bonusItem),
            } : undefined,
          });

          const targetScene = exit.target;
          if (!targetScene) {
            return NextResponse.json({ error: 'Target scene not found for this exit.' }, { status: 400 });
          }

          if (exit.one_time) {
            const exitKey = `${activeScene.id}:${exit.text}`;
            if (!newState.usedExits.includes(exitKey)) {
              newState.usedExits.push(exitKey);
            }
          }

          clearPendingGate(newState);
          newState.currentSceneId = targetScene;
        }
      } else {
        // Normal exit
        // Handle item requirements
        if (exit.requires_item) {
          const itemId = exit.requires_item.id;
          const amount = exit.requires_item.amount || 1;
          const item = parsed.inventory[itemId];

          if (item?.type === 'currency') {
            newState.inventory[itemId] = (newState.inventory[itemId] || 0) - amount;
          } else if (item?.consumed !== false) {
            delete newState.inventory[itemId];
            consumedItems.push(itemId);
          }
        }

        // Apply effects
        if (exit.effects) {
          if (exit.effects.set_counter) {
            Object.assign(newState.counters, exit.effects.set_counter);
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

        if (!exit.target) {
          return NextResponse.json({ error: 'Target scene not found for this exit.' }, { status: 400 });
        }

        newState.currentSceneId = exit.target;
      }

      // Get new scene
      const newScene = parsed.sceneMap[newState.currentSceneId];
      const isCompleted = newScene.exits.length === 0;

      // Process scene item changes
      const { changes: itemChanges, newState: updatedState } = processSceneItemChanges(newScene, newState, parsed);

      const finalState = itemChanges.length > 0 ? updatedState : newState;

      appendHistoryEntry(finalState, isCompleted, {
        timestamp: new Date().toISOString(),
        action: exit.gate
          ? (diceResult?.success === false
            ? `Failed "${exit.text}" and moved to "${newScene.title}"`
            : `Passed "${exit.text}" and moved to "${newScene.title}"`)
          : `Chose "${exit.text}"`,
        sceneId: newScene.id,
        details: itemChanges.length > 0
          ? itemChanges.map(change => `${change.type === 'add' ? 'Gained' : 'Lost'} ${change.amount} ${change.itemName}`).join(' • ')
          : undefined,
        type: 'transition',
      });

      await saveGameState(finalState);

      if (isCompleted) {
        await sendAdventureNotification('completed', {
          adventureId: adventure.id,
          title: adventure.title,
          theme: adventure.theme,
          sessionId: state.id,
          baseUrl: request.nextUrl.origin,
        });
      }

      return NextResponse.json({
        success: true,
        diceResult,
        consumedItems,
        state: buildStatePayload(finalState, isCompleted),
        scene: {
          id: newScene.id,
          title: newScene.title,
          description: newScene.description,
          image: newScene.image,
          icon: newScene.icon,
          exits: formatExits(newScene, finalState, parsed),
          itemChanges: itemChanges.length > 0 ? itemChanges : undefined,
        },
      });
    }

    if (action === 'resolve_pending_gate') {
      if (!pendingGate) {
        return NextResponse.json({ error: 'No pending failed roll to resolve.' }, { status: 400 });
      }

      const pendingScene = parsed.sceneMap[pendingGate.sceneId];
      const exit = pendingScene?.exits[pendingGate.exitIndex];

      if (!pendingScene || !exit?.gate) {
        return NextResponse.json({ error: 'Pending roll is no longer valid.' }, { status: 400 });
      }

      const response = await finalizePendingFailure(state, pendingGate, parsed, exit);

      if (response.state.completed) {
        await sendAdventureNotification('completed', {
          adventureId: adventure.id,
          title: adventure.title,
          theme: adventure.theme,
          sessionId: state.id,
          baseUrl: request.nextUrl.origin,
        });
      }

      return NextResponse.json(response);
    }

    if (action === 'use_item') {
      const item = parsed.inventory[itemId];
      if (!item || !state.inventory[itemId]) {
        return NextResponse.json({ error: 'Item not available' }, { status: 400 });
      }

      const newState: GameState = JSON.parse(JSON.stringify(state));

      if (item.type === 'reroll') {
        if (!pendingGate) {
          return NextResponse.json({ error: 'No failed roll is available to reroll.' }, { status: 400 });
        }

        if (pendingGate.rerollArmed) {
          return NextResponse.json({ error: 'A reroll is already prepared for this check.' }, { status: 400 });
        }

        consumeInventoryItem(newState, itemId, item);
        setPendingGate(newState, { ...pendingGate, rerollArmed: true });
        appendHistoryEntry(newState, false, {
          timestamp: new Date().toISOString(),
          action: `Used ${item.name}`,
          sceneId: pendingGate.sceneId,
          details: 'Prepared a reroll for the failed check.',
          type: 'item',
          item: {
            id: itemId,
            name: item.name,
            type: item.type,
            value: item.value,
            bonusTiming: item.bonus_timing,
          },
        });

        await saveGameState(newState);

        return NextResponse.json({
          success: true,
          preparedReroll: true,
          item: { name: item.name, type: item.type, value: item.value },
          state: buildStatePayload(newState, false),
        });
      }

      if (item.type === 'bonus') {
        return NextResponse.json({ error: 'Bonus items must be applied through the dice builder.' }, { status: 400 });
      }

      consumeInventoryItem(newState, itemId, item);

      appendHistoryEntry(newState, false, {
        timestamp: new Date().toISOString(),
        action: `Used ${item.name}`,
        sceneId: state.currentSceneId,
        type: 'item',
        item: {
          id: itemId,
          name: item.name,
          type: item.type,
          value: item.value,
          bonusTiming: item.bonus_timing,
        },
      });

      await saveGameState(newState);

      return NextResponse.json({
        success: true,
        item: { name: item.name, type: item.type, value: item.value },
        state: buildStatePayload(newState, false),
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error performing action:', error);
    return NextResponse.json(
      { error: 'Failed to perform action' },
      { status: 500 }
    );
  }
}

// DELETE - Delete session
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    await db.gameState.delete({ where: { id: sessionId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting session:', error);
    return NextResponse.json(
      { error: 'Failed to delete session' },
      { status: 500 }
    );
  }
}
