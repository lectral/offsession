import { readFileSync } from 'node:fs';
import { afterEach, beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test';
import { NextRequest } from 'next/server';
import { hashPassword } from '../lib/adventure-utils';

const mockDb = {
  adventure: {
    create: async () => ({ id: 'adv-created', title: 'Created Adventure', theme: 'neon-mana-circuit' }),
    findUnique: async () => null,
    delete: async () => ({ id: 'adv-deleted' }),
  },
  gameState: {
    findMany: async () => [],
    findFirst: async () => null,
    findUnique: async () => null,
    upsert: async () => ({}),
  },
};

const originalFetch = globalThis.fetch;

function extractDefaultYamlFromPageSource(): string {
  const pageSource = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
  const yamlMatch = pageSource.match(/const DEFAULT_YAML = `([\s\S]*?)`;\n\nconst YAML_DOCUMENTATION_MD/);

  if (!yamlMatch?.[1]) {
    throw new Error('Could not extract DEFAULT_YAML from src/app/page.tsx');
  }

  return yamlMatch[1];
}

const FORGOTTEN_CITADEL_YAML = extractDefaultYamlFromPageSource();
const LARGE_YAML_VALIDATION_MAX_DURATION_MS = 2500;
const API_ROUTE_SOURCES = [
  '../app/api/route.ts',
  '../app/api/adventures/route.ts',
  '../app/api/adventures/[id]/route.ts',
  '../app/api/adventures/[id]/dm/route.ts',
  '../app/api/adventures/validate/route.ts',
  '../app/api/game/route.ts',
  '../app/api/game/[sessionId]/route.ts',
];

const DISCORD_TEST_BASE_URL = 'https://app.offsession.test';

const VALID_YAML = `
meta:
  title: "Test Adventure"
  theme: "neon-mana-circuit"
  one_shot: false
scenes:
  - id: start
    title: "Start"
    description: "Opening scene"
    exits:
      - text: "Finish"
        target: end
  - id: end
    title: "End"
    description: "Ending scene"
    exits: []
`;

const GATED_BONUS_YAML = `
meta:
  title: "Gate Adventure"
  theme: "neon-mana-circuit"
  one_shot: false
inventory:
  blessing:
    name: "Blessing"
    description: "Add 10 after the roll"
    type: "bonus"
    value: "10"
    bonus_timing: "after"
    default: 1
  charm:
    name: "Lucky Charm"
    description: "Reroll a failed check"
    type: "reroll"
    default: 1
scenes:
  - id: start
    title: "Gate"
    description: "A dangerous check"
    exits:
      - text: "Leap"
        gate:
          text: "Roll Acrobatics"
          dc: 15
          failure_target: fail
        target: end
  - id: end
    title: "End"
    description: "Success"
    exits: []
  - id: fail
    title: "Fail"
    description: "Failure"
    exits: []
`;

const BEFORE_ONLY_BONUS_YAML = `
meta:
  title: "Before Only"
  theme: "neon-mana-circuit"
  one_shot: false
inventory:
  blessing:
    name: "Battle Plan"
    description: "Add 4 before the roll"
    type: "bonus"
    value: "4"
    bonus_timing: "before"
    default: 1
scenes:
  - id: start
    title: "Gate"
    description: "A dangerous check"
    exits:
      - text: "Leap"
        gate:
          text: "Roll Acrobatics"
          dc: 15
          failure_target: fail
        target: end
  - id: end
    title: "End"
    description: "Success"
    exits: []
  - id: fail
    title: "Fail"
    description: "Failure"
    exits: []
`;

const GATED_WEAK_BONUS_YAML = `
meta:
  title: "Weak Bonus"
  theme: "neon-mana-circuit"
  one_shot: false
inventory:
  blessing:
    name: "Minor Blessing"
    description: "Add 2 after the roll"
    type: "bonus"
    value: "2"
    bonus_timing: "after"
    default: 1
scenes:
  - id: start
    title: "Gate"
    description: "A dangerous check"
    exits:
      - text: "Leap"
        gate:
          text: "Roll Acrobatics"
          dc: 15
          failure_target: fail
        target: end
  - id: end
    title: "End"
    description: "Success"
    exits: []
  - id: fail
    title: "Fail"
    description: "Failure"
    exits: []
`;

const CONDITIONAL_START_YAML = `
meta:
  title: "Conditional Start"
  theme: "neon-mana-circuit"
  one_shot: false
inventory:
  research_fragment:
    name: "Research Fragment"
    description: "A currency used to unlock the finale."
    type: "currency"
    default: 0
scenes:
  - id: start
    title: "Workbench"
    description: "You assess the first experiment."
    exits:
      - text: "Begin research"
        target: lab
        visible_if:
          currency: research_fragment
          equals: 0
      - text: "Finalize project"
        target: finale
        visible_if:
          currency: research_fragment
          equals: 1
  - id: lab
    title: "Lab"
    description: "The experiment proceeds."
    exits: []
  - id: finale
    title: "Finale"
    description: "The project is complete."
    exits: []
`;

const COUNTER_CONDITION_YAML = `
meta:
  title: "Counter Condition"
  theme: "neon-mana-circuit"
  one_shot: false
counters:
  suspicion:
    type: "number"
    default: 0
scenes:
  - id: start
    title: "Watchtower"
    description: "The guards are scanning the road."
    exits:
      - text: "Use the hidden path"
        target: end
        visible_if:
          counter: suspicion
          less_than: 3
      - text: "Charge the gate"
        target: end
        visible_if:
          counter: suspicion
          greater_or_equal: 3
  - id: end
    title: "End"
    description: "Finished"
    exits: []
`;

const SIMULATION_BLOCKED_YAML = `
meta:
  title: "Blocked Treasury"
  theme: "neon-mana-circuit"
  one_shot: false
inventory:
  gold:
    name: "Gold"
    description: "Coins for a bribe."
    type: "currency"
    default: 0
scenes:
  - id: start
    title: "Crossroads"
    description: "A guard blocks the vault."
    exits:
      - text: "Search the ruins"
        target: loop
        one_time: true
        effects:
          add_currency:
            gold: 1
      - text: "Bribe the guard"
        target: end
        visible_if:
          currency: gold
          greater_or_equal: 2
        requires_item:
          id: gold
          amount: 2
  - id: loop
    title: "Ruins"
    description: "You find a single coin and head back."
    exits:
      - text: "Return"
        target: start
  - id: end
    title: "Vault"
    description: "You made it through."
    exits: []
`;

const SIMULATION_BRANCHING_YAML = `
meta:
  title: "Fail Forward"
  theme: "neon-mana-circuit"
  one_shot: false
inventory:
  gate_key:
    name: "Gate Key"
    description: "Opens the final door."
    type: "item"
scenes:
  - id: start
    title: "Bridge"
    description: "A risky shortcut hangs over the chasm."
    exits:
      - text: "Attempt the shortcut"
        gate:
          text: "Roll Agility"
          dc: 15
          failure_target: detour
        target: trap
      - text: "Open the final gate"
        target: end
        visible_if:
          item: gate_key
          has_item: true
        requires_item:
          id: gate_key
  - id: detour
    title: "Detour"
    description: "The long road hides a spare key."
    add_items:
      - id: gate_key
        amount: 1
    exits:
      - text: "Return to the bridge"
        target: start
  - id: trap
    title: "Trap"
    description: "The shortcut strands you on the wrong side."
    exits: []
  - id: end
    title: "Sanctum"
    description: "You reach the sanctum."
    exits: []
`;

const PROTECTED_STATE_RECORD = {
  id: 'session-protected',
  adventureId: 'adv-protected',
  currentSceneId: 'start',
  counters: '{}',
  inventory: '{}',
  usedExits: '[]',
  history: '[]',
  updatedAt: new Date('2026-03-14T00:00:00.000Z'),
};

const UNPROTECTED_STATE_RECORD = {
  ...PROTECTED_STATE_RECORD,
  id: 'session-open',
  adventureId: 'adv-open',
};

let validateAdventurePost: typeof import('../app/api/adventures/validate/route').POST;
let createAdventurePost: typeof import('../app/api/adventures/route').POST;
let dmDashboardPost: typeof import('../app/api/adventures/[id]/dm/route').POST;
let deleteAdventureRoute: typeof import('../app/api/adventures/[id]/route').DELETE;
let startGamePost: typeof import('../app/api/game/route').POST;
let getGameSession: typeof import('../app/api/game/[sessionId]/route').GET;
let postGameSession: typeof import('../app/api/game/[sessionId]/route').POST;

mock.module('@/lib/db', () => ({ db: mockDb }));
mock.module('server-only', () => ({}));

beforeAll(async () => {
  ({ POST: validateAdventurePost } = await import('../app/api/adventures/validate/route'));
  ({ POST: createAdventurePost } = await import('../app/api/adventures/route'));
  ({ POST: dmDashboardPost } = await import('../app/api/adventures/[id]/dm/route'));
  ({ DELETE: deleteAdventureRoute } = await import('../app/api/adventures/[id]/route'));
  ({ POST: startGamePost } = await import('../app/api/game/route'));
  ({ GET: getGameSession } = await import('../app/api/game/[sessionId]/route'));
  ({ POST: postGameSession } = await import('../app/api/game/[sessionId]/route'));
});

beforeEach(() => {
  mockDb.adventure.create = async ({ data }: { data: { id: string; title: string; theme: string } }) => ({
    id: data.id,
    title: data.title,
    theme: data.theme,
  });
  mockDb.adventure.findUnique = async () => null;
  mockDb.adventure.delete = async () => ({ id: 'adv-deleted' });
  mockDb.gameState.findMany = async () => [];
  mockDb.gameState.findFirst = async () => null;
  mockDb.gameState.findUnique = async () => null;
  mockDb.gameState.upsert = async () => ({});
  delete process.env.DISCORD_WEBHOOK;
  delete process.env.APP_BASE_URL;
  delete process.env.NEXT_PUBLIC_APP_URL;
  delete process.env.VERCEL_URL;
  globalThis.fetch = originalFetch;
});

afterEach(() => {
  mockDb.adventure.create = async () => ({ id: 'adv-created', title: 'Created Adventure', theme: 'neon-mana-circuit' });
  mockDb.adventure.findUnique = async () => null;
  mockDb.adventure.delete = async () => ({ id: 'adv-deleted' });
  mockDb.gameState.findMany = async () => [];
  mockDb.gameState.findFirst = async () => null;
  mockDb.gameState.findUnique = async () => null;
  mockDb.gameState.upsert = async () => ({});
  delete process.env.DISCORD_WEBHOOK;
  delete process.env.APP_BASE_URL;
  delete process.env.NEXT_PUBLIC_APP_URL;
  delete process.env.VERCEL_URL;
  globalThis.fetch = originalFetch;
});

function jsonPostRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

function jsonGetRequest(url: string): NextRequest {
  return new NextRequest(url, {
    method: 'GET',
  });
}

function createFetchSpy() {
  const fetchSpy = mock(async () => new Response(null, { status: 204 }));
  globalThis.fetch = fetchSpy as typeof fetch;
  return fetchSpy;
}

function withMockRandom<T>(values: number[], callback: () => Promise<T> | T): Promise<T> | T {
  const originalRandom = Math.random;
  let index = 0;
  Math.random = () => {
    const value = values[Math.min(index, values.length - 1)] ?? 0;
    index += 1;
    return value;
  };

  const finalize = () => {
    Math.random = originalRandom;
  };

  try {
    const result = callback();
    if (result instanceof Promise) {
      return result.finally(finalize);
    }
    finalize();
    return result;
  } catch (error) {
    finalize();
    throw error;
  }
}

function createStateRecord(overrides?: Partial<typeof PROTECTED_STATE_RECORD>) {
  return {
    ...PROTECTED_STATE_RECORD,
    id: overrides?.id ?? 'session-open',
    adventureId: overrides?.adventureId ?? 'adv-open',
    currentSceneId: overrides?.currentSceneId ?? 'start',
    counters: overrides?.counters ?? '{}',
    inventory: overrides?.inventory ?? '{}',
    usedExits: overrides?.usedExits ?? '[]',
    history: overrides?.history ?? '[]',
    updatedAt: overrides?.updatedAt ?? new Date('2026-03-14T00:00:00.000Z'),
  };
}

describe('Adventure Validation API', () => {
  it('keeps all API route handlers force-dynamic and no-store', () => {
    for (const routePath of API_ROUTE_SOURCES) {
      const routeSource = readFileSync(new URL(routePath, import.meta.url), 'utf8');

      expect(routeSource).toMatch(/export const dynamic = ['\"]force-dynamic['\"];?/);
      expect(routeSource).toContain("export const revalidate = 0;");
      expect(routeSource).toMatch(/export const fetchCache = ['\"]force-no-store['\"];?/);
    }
  });

  it('should report valid YAML as valid', async () => {
    const response = await validateAdventurePost(
      jsonPostRequest('http://localhost/api/adventures/validate', { yamlContent: VALID_YAML })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('Valid');
    expect(data.errors).toEqual([]);
    expect(data.graph.completable).toBe(true);
  });

  it('should report invalid YAML details', async () => {
    const invalidYaml = `
meta:
  title: "Broken Adventure"
  theme: "neon-mana-circuit"
scenes: []
`;

    const response = await validateAdventurePost(
      jsonPostRequest('http://localhost/api/adventures/validate', { yamlContent: invalidYaml })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('Invalid');
    expect(data.errors).toContain('scenes must contain at least one scene');
  });

  it('rejects inventory colors that are outside the supported palette', async () => {
    const invalidYaml = `
meta:
  title: "Broken Colors"
  theme: "neon-mana-circuit"
inventory:
  torch:
    name: "Torch"
    description: "A light source"
    type: "item"
    color: "magenta"
scenes:
  - id: start
    title: "Start"
    description: "Test"
    exits: []
`;

    const response = await validateAdventurePost(
      jsonPostRequest('http://localhost/api/adventures/validate', { yamlContent: invalidYaml })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('Invalid');
    expect(data.errors).toContain('inventory.torch.color must be one of: red, green, blue, purple, gold, yellow, cyan, orange, pink, white, emerald, amber');
  });

  it('marks adventures invalid when simulation proves the ending cannot be reached', async () => {
    const response = await validateAdventurePost(
      jsonPostRequest('http://localhost/api/adventures/validate', { yamlContent: SIMULATION_BLOCKED_YAML })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('Invalid');
    expect(data.graph.completable).toBe(false);
    expect(data.errors).toContain('Adventure is not completable from the "start" scene');
  });

  it('treats gated success and failure branches as part of the simulation search', async () => {
    const response = await validateAdventurePost(
      jsonPostRequest('http://localhost/api/adventures/validate', { yamlContent: SIMULATION_BRANCHING_YAML })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('Valid');
    expect(data.graph.completable).toBe(true);
    expect(data.errors).toEqual([]);
  });

  it('validates the Forgotten Citadel YAML without taking an excessive amount of time', async () => {
    const startedAt = performance.now();
    const response = await validateAdventurePost(
      jsonPostRequest('http://localhost/api/adventures/validate', { yamlContent: FORGOTTEN_CITADEL_YAML })
    );
    const elapsedMs = performance.now() - startedAt;
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('Valid');
    expect(data.errors).toEqual([]);
    expect(data.graph.completable).toBe(true);
    expect(elapsedMs).toBeLessThan(LARGE_YAML_VALIDATION_MAX_DURATION_MS);
  });
});

describe('Discord Adventure Notifications', () => {
  it('should notify Discord when an adventure is created using the server env var', async () => {
    process.env.DISCORD_WEBHOOK = 'https://example.test/discord-webhook';
    process.env.APP_BASE_URL = DISCORD_TEST_BASE_URL;
    const fetchSpy = createFetchSpy();

    const response = await createAdventurePost(
      jsonPostRequest('http://localhost/api/adventures', {
        yamlContent: VALID_YAML,
        adminPassword: 'gm-secret',
      })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]?.[0]).toBe('https://example.test/discord-webhook');

    const requestInit = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(requestInit.body));
    expect(body.content).toContain('Adventure created');
    expect(body.content).toContain('Test Adventure');
    expect(body.content).toContain(`Player Link: ${DISCORD_TEST_BASE_URL}/?adventure=`);
  });

  it('should notify Discord when a fresh adventure session is started', async () => {
    process.env.DISCORD_WEBHOOK = 'https://example.test/discord-webhook';
    process.env.APP_BASE_URL = DISCORD_TEST_BASE_URL;
    const fetchSpy = createFetchSpy();

    mockDb.adventure.findUnique = async () => ({
      id: 'adv-open',
      title: 'Open Adventure',
      theme: 'neon-mana-circuit',
      yamlContent: VALID_YAML,
      adminPasswordHash: 'unused',
      playerPasswordHash: null,
    });

    const response = await startGamePost(
      jsonPostRequest('http://localhost/api/game', { adventureId: 'adv-open' })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(typeof data.sessionId).toBe('string');
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const requestInit = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(requestInit.body));
    expect(body.content).toContain('Adventure started');
    expect(body.content).toContain(`Session ID**: \`${data.sessionId}\``);
    expect(body.content).toContain(`Player Link: ${DISCORD_TEST_BASE_URL}/?adventure=adv-open`);
    expect(body.content).toContain(`DM Dashboard: ${DISCORD_TEST_BASE_URL}/?adventure=adv-open&view=dm`);
  });

  it('should notify Discord when a session reaches a terminal scene', async () => {
    process.env.DISCORD_WEBHOOK = 'https://example.test/discord-webhook';
    process.env.APP_BASE_URL = DISCORD_TEST_BASE_URL;
    const fetchSpy = createFetchSpy();

    mockDb.gameState.findUnique = async () => ({
      id: 'session-open',
      adventureId: 'adv-open',
      currentSceneId: 'start',
      counters: '{}',
      inventory: '{}',
      usedExits: '[]',
      history: '[]',
    });
    mockDb.adventure.findUnique = async () => ({
      id: 'adv-open',
      title: 'Open Adventure',
      theme: 'neon-mana-circuit',
      yamlContent: VALID_YAML,
      adminPasswordHash: 'unused',
      playerPasswordHash: null,
    });

    const response = await postGameSession(
      jsonPostRequest('http://localhost/api/game/session-open', {
        action: 'use_exit',
        exitIndex: 0,
      }),
      { params: Promise.resolve({ sessionId: 'session-open' }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.state.completed).toBe(true);
    expect(data.scene.id).toBe('end');
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const requestInit = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(requestInit.body));
    expect(body.content).toContain('Adventure completed');
    expect(body.content).toContain('Session ID**: `session-open`');
    expect(body.content).toContain(`DM Dashboard: ${DISCORD_TEST_BASE_URL}/?adventure=adv-open&view=dm`);
  });

  it('keeps the Discord webhook server-only and out of the client source', async () => {
    const clientSource = await Bun.file(new URL('../app/page.tsx', import.meta.url)).text();
    const notifierSource = await Bun.file(new URL('../lib/discord-webhook.ts', import.meta.url)).text();

    expect(clientSource).not.toContain('DISCORD_WEBHOOK');
    expect(clientSource).not.toContain('discord.com/api/webhooks/');
    expect(notifierSource).toContain("import 'server-only';");
  });
});

describe('Game Start API', () => {
  it('shows exits gated by currency comparisons at session start', async () => {
    mockDb.adventure.findUnique = async () => ({
      id: 'adv-conditional',
      title: 'Conditional Adventure',
      theme: 'neon-mana-circuit',
      yamlContent: CONDITIONAL_START_YAML,
      adminPasswordHash: 'unused',
      playerPasswordHash: null,
    });

    const response = await startGamePost(
      jsonPostRequest('http://localhost/api/game', { adventureId: 'adv-conditional' })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.scene.id).toBe('start');
    expect(data.scene.exits).toHaveLength(1);
    expect(data.scene.exits[0].text).toBe('Begin research');
  });
});

describe('GM Dashboard Password Protection', () => {
  it('should reject an invalid GM password', async () => {
    const adminPasswordHash = await hashPassword('gm-secret');
    mockDb.adventure.findUnique = async () => ({
      id: 'adv-gm',
      title: 'GM Adventure',
      theme: 'neon-mana-circuit',
      yamlContent: VALID_YAML,
      adminPasswordHash,
      playerPasswordHash: null,
    });

    const response = await dmDashboardPost(
      jsonPostRequest('http://localhost/api/adventures/adv-gm/dm', { password: 'wrong-password' }),
      { params: Promise.resolve({ id: 'adv-gm' }) }
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Invalid password');
  });

  it('should allow access with a valid GM password', async () => {
    const adminPasswordHash = await hashPassword('gm-secret');
    mockDb.adventure.findUnique = async () => ({
      id: 'adv-gm',
      title: 'GM Adventure',
      theme: 'neon-mana-circuit',
      yamlContent: VALID_YAML,
      adminPasswordHash,
      playerPasswordHash: null,
    });
    mockDb.gameState.findMany = async () => [
      {
        ...PROTECTED_STATE_RECORD,
        adventureId: 'adv-gm',
      },
    ];

    const response = await dmDashboardPost(
      jsonPostRequest('http://localhost/api/adventures/adv-gm/dm', { password: 'gm-secret' }),
      { params: Promise.resolve({ id: 'adv-gm' }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.adventure.id).toBe('adv-gm');
    expect(data.gameStates).toHaveLength(1);
    expect(data.scenes).toHaveLength(2);
  });
});

describe('Adventure Delete Password Protection', () => {
  it('should require an admin password to delete an adventure', async () => {
    const adminPasswordHash = await hashPassword('gm-secret');
    mockDb.adventure.findUnique = async () => ({
      id: 'adv-gm',
      title: 'GM Adventure',
      theme: 'neon-mana-circuit',
      yamlContent: VALID_YAML,
      adminPasswordHash,
      playerPasswordHash: null,
    });

    const response = await deleteAdventureRoute(
      new NextRequest('http://localhost/api/adventures/adv-gm', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'adv-gm' }) }
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Admin password required');
  });

  it('should reject an invalid admin password when deleting an adventure', async () => {
    const adminPasswordHash = await hashPassword('gm-secret');
    const deleteSpy = mock(async () => ({ id: 'adv-gm' }));
    mockDb.adventure.findUnique = async () => ({
      id: 'adv-gm',
      title: 'GM Adventure',
      theme: 'neon-mana-circuit',
      yamlContent: VALID_YAML,
      adminPasswordHash,
      playerPasswordHash: null,
    });
    mockDb.adventure.delete = deleteSpy;

    const response = await deleteAdventureRoute(
      new NextRequest('http://localhost/api/adventures/adv-gm', {
        method: 'DELETE',
        body: JSON.stringify({ adminPassword: 'wrong-password' }),
        headers: { 'Content-Type': 'application/json' },
      }),
      { params: Promise.resolve({ id: 'adv-gm' }) }
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Invalid password');
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it('should delete an adventure with the correct admin password', async () => {
    const adminPasswordHash = await hashPassword('gm-secret');
    const deleteSpy = mock(async ({ where }: { where: { id: string } }) => ({ id: where.id }));
    mockDb.adventure.findUnique = async () => ({
      id: 'adv-gm',
      title: 'GM Adventure',
      theme: 'neon-mana-circuit',
      yamlContent: VALID_YAML,
      adminPasswordHash,
      playerPasswordHash: null,
    });
    mockDb.adventure.delete = deleteSpy;

    const response = await deleteAdventureRoute(
      new NextRequest('http://localhost/api/adventures/adv-gm', {
        method: 'DELETE',
        body: JSON.stringify({ adminPassword: 'gm-secret' }),
        headers: { 'Content-Type': 'application/json' },
      }),
      { params: Promise.resolve({ id: 'adv-gm' }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(deleteSpy).toHaveBeenCalledWith({ where: { id: 'adv-gm' } });
  });
});

describe('Player Session Password Protection', () => {
  it('should require a player password to start a protected adventure', async () => {
    const playerPasswordHash = await hashPassword('player-secret');
    mockDb.adventure.findUnique = async () => ({
      id: 'adv-protected',
      title: 'Protected Adventure',
      theme: 'neon-mana-circuit',
      yamlContent: VALID_YAML,
      adminPasswordHash: 'unused',
      playerPasswordHash,
    });

    const response = await startGamePost(
      jsonPostRequest('http://localhost/api/game', { adventureId: 'adv-protected' })
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Player password required');
  });

  it('should start a protected adventure with the correct player password', async () => {
    const playerPasswordHash = await hashPassword('player-secret');
    mockDb.adventure.findUnique = async () => ({
      id: 'adv-protected',
      title: 'Protected Adventure',
      theme: 'neon-mana-circuit',
      yamlContent: VALID_YAML,
      adminPasswordHash: 'unused',
      playerPasswordHash,
    });

    const response = await startGamePost(
      jsonPostRequest('http://localhost/api/game', {
        adventureId: 'adv-protected',
        playerPassword: 'player-secret',
      })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(typeof data.sessionId).toBe('string');
    expect(data.scene.id).toBe('start');
  });

  it('should start an unprotected adventure without a player password', async () => {
    mockDb.adventure.findUnique = async () => ({
      id: 'adv-open',
      title: 'Open Adventure',
      theme: 'neon-mana-circuit',
      yamlContent: VALID_YAML,
      adminPasswordHash: 'unused',
      playerPasswordHash: null,
    });

    const response = await startGamePost(
      jsonPostRequest('http://localhost/api/game', { adventureId: 'adv-open' })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(typeof data.sessionId).toBe('string');
    expect(data.scene.id).toBe('start');
  });

  it('should require a player password when resuming a protected session', async () => {
    const playerPasswordHash = await hashPassword('player-secret');
    mockDb.gameState.findUnique = async () => PROTECTED_STATE_RECORD;
    mockDb.adventure.findUnique = async () => ({
      id: 'adv-protected',
      title: 'Protected Adventure',
      theme: 'neon-mana-circuit',
      yamlContent: VALID_YAML,
      adminPasswordHash: 'unused',
      playerPasswordHash,
    });

    const response = await getGameSession(
      jsonGetRequest('http://localhost/api/game/session-protected'),
      { params: Promise.resolve({ sessionId: 'session-protected' }) }
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Player password required');
  });

  it('should resume a protected session with the correct player password', async () => {
    const playerPasswordHash = await hashPassword('player-secret');
    mockDb.gameState.findUnique = async () => PROTECTED_STATE_RECORD;
    mockDb.adventure.findUnique = async () => ({
      id: 'adv-protected',
      title: 'Protected Adventure',
      theme: 'neon-mana-circuit',
      yamlContent: VALID_YAML,
      adminPasswordHash: 'unused',
      playerPasswordHash,
    });

    const response = await getGameSession(
      jsonGetRequest('http://localhost/api/game/session-protected?playerPassword=player-secret'),
      { params: Promise.resolve({ sessionId: 'session-protected' }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.sessionId).toBe('session-protected');
    expect(data.scene.id).toBe('start');
  });

  it('should resume an unprotected session without a player password', async () => {
    mockDb.gameState.findUnique = async () => UNPROTECTED_STATE_RECORD;
    mockDb.adventure.findUnique = async () => ({
      id: 'adv-open',
      title: 'Open Adventure',
      theme: 'neon-mana-circuit',
      yamlContent: VALID_YAML,
      adminPasswordHash: 'unused',
      playerPasswordHash: null,
    });

    const response = await getGameSession(
      jsonGetRequest('http://localhost/api/game/session-open'),
      { params: Promise.resolve({ sessionId: 'session-open' }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.sessionId).toBe('session-open');
    expect(data.scene.id).toBe('start');
  });

  it('shows exits gated by counter comparisons when resuming a session', async () => {
    mockDb.gameState.findUnique = async () => createStateRecord({
      adventureId: 'adv-counter',
      counters: JSON.stringify({ suspicion: 3 }),
    });
    mockDb.adventure.findUnique = async () => ({
      id: 'adv-counter',
      title: 'Counter Adventure',
      theme: 'neon-mana-circuit',
      yamlContent: COUNTER_CONDITION_YAML,
      adminPasswordHash: 'unused',
      playerPasswordHash: null,
    });

    const response = await getGameSession(
      jsonGetRequest('http://localhost/api/game/session-open'),
      { params: Promise.resolve({ sessionId: 'session-open' }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.scene.exits).toHaveLength(1);
    expect(data.scene.exits[0].exitIndex).toBe(1);
    expect(data.scene.exits[0].text).toBe('Charge the gate');
  });

  it('uses the original scene exit index when visible options are filtered', async () => {
    let currentRecord = createStateRecord({
      adventureId: 'adv-counter',
      counters: JSON.stringify({ suspicion: 3 }),
      history: JSON.stringify([]),
    });

    mockDb.gameState.findUnique = async () => currentRecord;
    mockDb.gameState.upsert = async ({ update }: { update: Record<string, string> }) => {
      currentRecord = {
        ...currentRecord,
        ...update,
        updatedAt: new Date('2026-03-15T00:00:00.000Z'),
      } as typeof currentRecord;
      return currentRecord;
    };
    mockDb.adventure.findUnique = async () => ({
      id: 'adv-counter',
      title: 'Counter Adventure',
      theme: 'neon-mana-circuit',
      yamlContent: COUNTER_CONDITION_YAML,
      adminPasswordHash: 'unused',
      playerPasswordHash: null,
    });

    const response = await postGameSession(
      jsonPostRequest('http://localhost/api/game/session-open', {
        action: 'use_exit',
        exitIndex: 1,
      }),
      { params: Promise.resolve({ sessionId: 'session-open' }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.scene.id).toBe('end');
    expect(data.state.currentSceneId).toBe('end');
  });
});

describe('Detailed Session Inspection And Bonus Resolution', () => {
  it('returns DM session details with normalized history entries', async () => {
    const adminPasswordHash = await hashPassword('gm-secret');
    mockDb.adventure.findUnique = async () => ({
      id: 'adv-gm',
      title: 'GM Adventure',
      theme: 'neon-mana-circuit',
      yamlContent: VALID_YAML,
      adminPasswordHash,
      playerPasswordHash: null,
    });
    mockDb.gameState.findMany = async () => [createStateRecord({
      id: 'session-detail',
      adventureId: 'adv-gm',
      history: JSON.stringify([
        { timestamp: '2026-03-14T00:00:00.000Z', action: 'Legacy event', sceneId: 'start', details: 'Old format entry' },
        {
          timestamp: '2026-03-14T00:01:00.000Z',
          action: 'Rolled 1d20',
          sceneId: 'start',
          type: 'roll',
          roll: { notation: '1d20', rolls: [12], total: 12, modifier: 0, success: true, dc: 10 },
          snapshot: {
            currentSceneId: 'start',
            counters: {},
            inventory: {},
            usedExits: [],
            completed: false,
          },
        },
      ]),
    })];

    const response = await dmDashboardPost(
      jsonPostRequest('http://localhost/api/adventures/adv-gm/dm', { password: 'gm-secret', sessionId: 'session-detail' }),
      { params: Promise.resolve({ id: 'adv-gm' }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.sessionDetail.sessionId).toBe('session-detail');
    expect(data.sessionDetail.history).toHaveLength(2);
    expect(data.sessionDetail.history[0].action).toBe('Legacy event');
    expect(data.sessionDetail.history[1].snapshot.currentSceneId).toBe('start');
  });

  it('applies an after-roll bonus to the existing failed roll without rerolling', async () => {
    let currentRecord = createStateRecord({
      inventory: JSON.stringify({ blessing: 1 }),
      history: JSON.stringify([]),
    });

    mockDb.adventure.findUnique = async () => ({
      id: 'adv-open',
      title: 'Open Adventure',
      theme: 'neon-mana-circuit',
      yamlContent: GATED_BONUS_YAML,
      adminPasswordHash: 'unused',
      playerPasswordHash: null,
    });
    mockDb.gameState.findUnique = async () => currentRecord;
    mockDb.gameState.upsert = async ({ update }: { update: Record<string, string> }) => {
      currentRecord = {
        ...currentRecord,
        ...update,
        updatedAt: new Date('2026-03-14T00:05:00.000Z'),
      } as typeof currentRecord;
      return currentRecord;
    };

    const firstResponse = await withMockRandom([0.35], () => postGameSession(
      jsonPostRequest('http://localhost/api/game/session-open', {
        action: 'use_exit',
        exitIndex: 0,
        diceNotation: '1d20',
      }),
      { params: Promise.resolve({ sessionId: 'session-open' }) }
    )) as Response;
    const firstData = await firstResponse.json();

    expect(firstResponse.status).toBe(200);
    expect(firstData.diceResult.total).toBe(8);
    expect(firstData.pendingGate.lastRoll.total).toBe(8);

    const originalRandom = Math.random;
    Math.random = () => {
      throw new Error('after-roll bonus should not reroll dice');
    };

    try {
      const secondResponse = await postGameSession(
        jsonPostRequest('http://localhost/api/game/session-open', {
          action: 'use_exit',
          exitIndex: 0,
          itemId: 'blessing',
          bonusValue: 10,
          bonusStage: 'after',
        }),
        { params: Promise.resolve({ sessionId: 'session-open' }) }
      );
      const secondData = await secondResponse.json();

      expect(secondResponse.status).toBe(200);
      expect(secondData.diceResult.rolls).toEqual(firstData.diceResult.rolls);
      expect(secondData.diceResult.total).toBe(18);
      expect(secondData.diceResult.success).toBe(true);
      expect(secondData.scene.id).toBe('end');
    } finally {
      Math.random = originalRandom;
    }
  });

  it('blocks after-roll bonuses on critical failures but still allows rerolls', async () => {
    let currentRecord = createStateRecord({
      inventory: JSON.stringify({ blessing: 1, charm: 1 }),
      history: JSON.stringify([]),
    });

    mockDb.adventure.findUnique = async () => ({
      id: 'adv-open',
      title: 'Open Adventure',
      theme: 'neon-mana-circuit',
      yamlContent: GATED_BONUS_YAML,
      adminPasswordHash: 'unused',
      playerPasswordHash: null,
    });
    mockDb.gameState.findUnique = async () => currentRecord;
    mockDb.gameState.upsert = async ({ update }: { update: Record<string, string> }) => {
      currentRecord = {
        ...currentRecord,
        ...update,
        updatedAt: new Date('2026-03-14T00:10:00.000Z'),
      } as typeof currentRecord;
      return currentRecord;
    };

    await withMockRandom([0], () => postGameSession(
      jsonPostRequest('http://localhost/api/game/session-open', {
        action: 'use_exit',
        exitIndex: 0,
        diceNotation: '1d20',
      }),
      { params: Promise.resolve({ sessionId: 'session-open' }) }
    ));

    const blockedResponse = await postGameSession(
      jsonPostRequest('http://localhost/api/game/session-open', {
        action: 'use_exit',
        exitIndex: 0,
        itemId: 'blessing',
        bonusValue: 10,
        bonusStage: 'after',
      }),
      { params: Promise.resolve({ sessionId: 'session-open' }) }
    );
    const blockedData = await blockedResponse.json();

    expect(blockedResponse.status).toBe(400);
    expect(blockedData.error).toContain('Critical failures');

    const rerollResponse = await postGameSession(
      jsonPostRequest('http://localhost/api/game/session-open', {
        action: 'use_item',
        itemId: 'charm',
      }),
      { params: Promise.resolve({ sessionId: 'session-open' }) }
    );
    const rerollData = await rerollResponse.json();

    expect(rerollResponse.status).toBe(200);
    expect(rerollData.preparedReroll).toBe(true);
  });

  it('commits a failed after-roll bonus immediately to the failure scene', async () => {
    let currentRecord = createStateRecord({
      inventory: JSON.stringify({ blessing: 1 }),
      history: JSON.stringify([]),
    });

    mockDb.adventure.findUnique = async () => ({
      id: 'adv-open',
      title: 'Open Adventure',
      theme: 'neon-mana-circuit',
      yamlContent: GATED_WEAK_BONUS_YAML,
      adminPasswordHash: 'unused',
      playerPasswordHash: null,
    });
    mockDb.gameState.findUnique = async () => currentRecord;
    mockDb.gameState.upsert = async ({ update }: { update: Record<string, string> }) => {
      currentRecord = {
        ...currentRecord,
        ...update,
        updatedAt: new Date('2026-03-14T00:15:00.000Z'),
      } as typeof currentRecord;
      return currentRecord;
    };

    const firstResponse = await withMockRandom([0.35], () => postGameSession(
      jsonPostRequest('http://localhost/api/game/session-open', {
        action: 'use_exit',
        exitIndex: 0,
        diceNotation: '1d20',
      }),
      { params: Promise.resolve({ sessionId: 'session-open' }) }
    )) as Response;
    const firstData = await firstResponse.json();

    expect(firstResponse.status).toBe(200);
    expect(firstData.pendingGate.lastRoll.total).toBe(8);

    const secondResponse = await postGameSession(
      jsonPostRequest('http://localhost/api/game/session-open', {
        action: 'use_exit',
        exitIndex: 0,
        itemId: 'blessing',
        bonusValue: 2,
        bonusStage: 'after',
      }),
      { params: Promise.resolve({ sessionId: 'session-open' }) }
    );
    const secondData = await secondResponse.json();

    expect(secondResponse.status).toBe(200);
    expect(secondData.diceResult.total).toBe(10);
    expect(secondData.diceResult.success).toBe(false);
    expect(secondData.scene.id).toBe('fail');
    expect(secondData.state.pendingGate).toBeNull();

    const persistedInventory = JSON.parse(currentRecord.inventory) as Record<string, number>;
    expect(persistedInventory.blessing).toBeUndefined();
    expect(currentRecord.currentSceneId).toBe('fail');
  });

  it('rejects after-roll application for before-only bonus items', async () => {
    let currentRecord = createStateRecord({
      inventory: JSON.stringify({ blessing: 1 }),
      history: JSON.stringify([]),
    });

    mockDb.adventure.findUnique = async () => ({
      id: 'adv-open',
      title: 'Open Adventure',
      theme: 'neon-mana-circuit',
      yamlContent: BEFORE_ONLY_BONUS_YAML,
      adminPasswordHash: 'unused',
      playerPasswordHash: null,
    });
    mockDb.gameState.findUnique = async () => currentRecord;
    mockDb.gameState.upsert = async ({ update }: { update: Record<string, string> }) => {
      currentRecord = {
        ...currentRecord,
        ...update,
        updatedAt: new Date('2026-03-14T00:15:00.000Z'),
      } as typeof currentRecord;
      return currentRecord;
    };

    await withMockRandom([0.2], () => postGameSession(
      jsonPostRequest('http://localhost/api/game/session-open', {
        action: 'use_exit',
        exitIndex: 0,
        diceNotation: '1d20',
      }),
      { params: Promise.resolve({ sessionId: 'session-open' }) }
    ));

    const response = await postGameSession(
      jsonPostRequest('http://localhost/api/game/session-open', {
        action: 'use_exit',
        exitIndex: 0,
        itemId: 'blessing',
        bonusValue: 4,
        bonusStage: 'after',
      }),
      { params: Promise.resolve({ sessionId: 'session-open' }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('before the roll');
  });
});
