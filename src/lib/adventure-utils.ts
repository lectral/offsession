import * as yaml from 'js-yaml';
import * as bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { themes } from './themes';

// Fantasy word dictionary for ID generation
const fantasyWords = [
  'shadow', 'fire', 'storm', 'frost', 'iron', 'moon', 'star', 'blade',
  'dragon', 'wolf', 'raven', 'phoenix', 'serpent', 'lion', 'tiger',
  'ancient', 'mystic', 'arcane', 'divine', 'ethereal', 'crimson',
  'azure', 'golden', 'silver', 'obsidian', 'crystal', 'ember',
  'thunder', 'void', 'chaos', 'order', 'light', 'dark'
];

export function generateAdventureId(): string {
  const word1 = fantasyWords[Math.floor(Math.random() * fantasyWords.length)];
  const word2 = fantasyWords[Math.floor(Math.random() * fantasyWords.length)];
  const num = Math.floor(Math.random() * 1000);
  return `${word1}-${word2}-${num}`;
}

export function generateSessionId(): string {
  return nanoid(16);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// YAML Schema Types - matching the specification
export interface CounterDefinition {
  type: 'number' | 'boolean';
  default: number | boolean;
}

export interface InventoryItemDefinition {
  name: string;
  description: string;
  type: 'currency' | 'item' | 'reroll' | 'bonus';
  image?: string;
  icon?: string;
  color?: string;
  default?: number;
  consumed?: boolean;
  value?: string;
  usage_count?: number;
  bonus_timing?: 'before' | 'after' | 'both';
}

export interface GateDefinition {
  text: string;
  short_text?: string;
  show_short?: boolean;
  dc: number;
  failure_target: string;
}

// Condition types for conditional exits
export interface ConditionDefinition {
  counter?: string;
  item?: string;
  currency?: string;
  equals?: number | boolean;
  not_equals?: number | boolean;
  greater_than?: number;
  less_than?: number;
  greater_or_equal?: number;
  less_or_equal?: number;
  has_item?: boolean;  // Check if player has at least 1 of the item
}

export interface ConditionState {
  counters: Record<string, number | boolean>;
  inventory: Record<string, number>;
}

export interface ExitDefinition {
  text: string;
  target?: string;
  gate?: GateDefinition;
  one_time?: boolean;
  color?: string;  // red, green, blue, purple, gold, yellow, cyan, orange, pink, white
  requires_item?: {
    id: string;
    amount?: number;
  };
  visible_if?: ConditionDefinition;  // Show exit only if condition is met
  effects?: {
    set_counter?: Record<string, boolean | number>;
    add_item?: string;
    remove_item?: string;
    add_currency?: Record<string, number>;
  };
}

// Scene-level item changes
export interface SceneItemChange {
  id: string;
  amount: number;  // Positive to add, negative to remove
  text?: string;   // Message to display
}

export interface SceneDefinition {
  id: string;
  title: string;
  description: string;
  image?: string;
  icon?: string;
  exits: ExitDefinition[];
  add_items?: SceneItemChange[];      // Items to add when entering scene
  remove_items?: SceneItemChange[];   // Items to remove when entering scene
}

export interface AdventureYaml {
  meta: {
    title: string;
    description?: string;
    theme: string;
    one_shot?: boolean;
  };
  counters?: Record<string, CounterDefinition>;
  inventory?: Record<string, InventoryItemDefinition>;
  scenes: SceneDefinition[];
}

export interface ParsedAdventure {
  meta: {
    title: string;
    description?: string;
    theme: string;
    one_shot: boolean;
  };
  counters: Record<string, CounterDefinition>;
  inventory: Record<string, InventoryItemDefinition>;
  scenes: SceneDefinition[];
  sceneMap: Record<string, SceneDefinition>;
}

export interface AdventureGraphReport {
  totalScenes: number;
  reachableScenes: number;
  unreachableScenes: string[];
  terminalScenes: string[];
  deadEndScenes: string[];
  completable: boolean;
}

export interface AdventureValidationReport {
  status: 'Valid' | 'Invalid';
  errors: string[];
  warnings: string[];
  graph: AdventureGraphReport;
}

export interface AdventureValidationResult extends AdventureValidationReport {
  parsed?: ParsedAdventure;
}

const VALID_THEME_IDS = new Set(Object.keys(themes));
const VALID_COUNTER_TYPES = new Set<CounterDefinition['type']>(['number', 'boolean']);
const VALID_INVENTORY_TYPES = new Set<InventoryItemDefinition['type']>(['currency', 'item', 'reroll', 'bonus']);
const VALID_EXIT_COLORS = new Set([
  'red',
  'green',
  'blue',
  'purple',
  'gold',
  'yellow',
  'cyan',
  'orange',
  'pink',
  'white',
  'emerald',
  'amber',
]);

const TOP_LEVEL_KEYS = new Set(['meta', 'counters', 'inventory', 'scenes']);
const META_KEYS = new Set(['title', 'description', 'theme', 'one_shot']);
const COUNTER_KEYS = new Set(['type', 'default']);
const VALID_BONUS_TIMINGS = new Set<NonNullable<InventoryItemDefinition['bonus_timing']>>(['before', 'after', 'both']);
const INVENTORY_KEYS = new Set(['name', 'description', 'type', 'image', 'icon', 'color', 'default', 'consumed', 'value', 'usage_count', 'bonus_timing']);
const SCENE_KEYS = new Set(['id', 'title', 'description', 'image', 'icon', 'exits', 'add_items', 'remove_items']);
const EXIT_KEYS = new Set(['text', 'target', 'gate', 'one_time', 'color', 'requires_item', 'visible_if', 'effects']);
const GATE_KEYS = new Set(['text', 'short_text', 'show_short', 'dc', 'failure_target']);
const REQUIRES_ITEM_KEYS = new Set(['id', 'amount']);
const CONDITION_KEYS = new Set([
  'counter',
  'item',
  'currency',
  'equals',
  'not_equals',
  'greater_than',
  'less_than',
  'greater_or_equal',
  'less_or_equal',
  'has_item',
]);
const EFFECT_KEYS = new Set(['set_counter', 'add_item', 'remove_item', 'add_currency']);
const SCENE_ITEM_CHANGE_KEYS = new Set(['id', 'amount', 'text']);

function createEmptyGraphReport(totalScenes = 0): AdventureGraphReport {
  return {
    totalScenes,
    reachableScenes: 0,
    unreachableScenes: [],
    terminalScenes: [],
    deadEndScenes: [],
    completable: false,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isConditionEqualityValue(value: unknown): value is number | boolean {
  return typeof value === 'boolean' || isFiniteNumber(value);
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0;
}

function appendUnique(target: string[], messages: Iterable<string>): void {
  for (const message of messages) {
    if (!target.includes(message)) {
      target.push(message);
    }
  }
}

function reportUnknownKeys(
  path: string,
  value: unknown,
  allowedKeys: Set<string>,
  errors: string[]
): void {
  if (!isRecord(value)) {
    return;
  }

  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      errors.push(`${path}: unknown key "${key}"`);
    }
  }
}

function loadAdventureYamlDocument(yamlContent: string): unknown {
  return yaml.load(yamlContent);
}

function parseAdventureDocument(document: unknown): ParsedAdventure {
  if (!isRecord(document)) {
    throw new Error('Invalid YAML: root must be an object');
  }

  const meta = document.meta;
  const scenes = document.scenes;

  if (!isRecord(meta) || !isNonEmptyString(meta.title) || !Array.isArray(scenes)) {
    throw new Error('Invalid YAML: missing required fields (meta.title, scenes)');
  }

  const sceneMap: Record<string, SceneDefinition> = {};
  for (const scene of scenes) {
    if (!isRecord(scene) || !isNonEmptyString(scene.id)) {
      throw new Error('Invalid YAML: scene missing id');
    }
    sceneMap[scene.id] = scene as unknown as SceneDefinition;
  }

  const inventory = isRecord(document.inventory)
    ? Object.fromEntries(
        Object.entries(document.inventory).map(([itemId, definition]) => {
          if (!isRecord(definition)) {
            return [itemId, definition];
          }

          return [
            itemId,
            {
              ...definition,
              value: definition.value !== undefined ? String(definition.value) : undefined,
              bonus_timing: definition.type === 'bonus'
                ? (definition.bonus_timing === undefined ? 'both' : String(definition.bonus_timing).toLowerCase())
                : undefined,
            },
          ];
        })
      ) as Record<string, InventoryItemDefinition>
    : {};

  return {
    meta: {
      title: meta.title,
      description: typeof meta.description === 'string' ? meta.description : undefined,
      theme: typeof meta.theme === 'string' ? meta.theme : 'neon-mana-circuit',
      one_shot: meta.one_shot !== false,
    },
    counters: isRecord(document.counters) ? document.counters as Record<string, CounterDefinition> : {},
    inventory,
    scenes: scenes as SceneDefinition[],
    sceneMap,
  };
}

function validateConditionDefinition(
  condition: unknown,
  path: string,
  errors: string[]
): void {
  if (!isRecord(condition)) {
    errors.push(`${path} must be an object`);
    return;
  }

  reportUnknownKeys(path, condition, CONDITION_KEYS, errors);

  const subjectKeys = ['counter', 'item', 'currency'].filter((key) => condition[key] !== undefined);
  const operatorKeys = [
    'equals',
    'not_equals',
    'greater_than',
    'less_than',
    'greater_or_equal',
    'less_or_equal',
    'has_item',
  ].filter((key) => condition[key] !== undefined);

  if (subjectKeys.length !== 1) {
    errors.push(`${path} must define exactly one of counter, item, or currency`);
  }

  if (operatorKeys.length === 0) {
    errors.push(`${path} must define at least one comparison operator`);
  }

  if (condition.counter !== undefined && !isNonEmptyString(condition.counter)) {
    errors.push(`${path}.counter must be a non-empty string`);
  }

  if (condition.item !== undefined && !isNonEmptyString(condition.item)) {
    errors.push(`${path}.item must be a non-empty string`);
  }

  if (condition.currency !== undefined && !isNonEmptyString(condition.currency)) {
    errors.push(`${path}.currency must be a non-empty string`);
  }

  for (const key of ['greater_than', 'less_than', 'greater_or_equal', 'less_or_equal']) {
    if (condition[key] !== undefined && !isFiniteNumber(condition[key])) {
      errors.push(`${path}.${key} must be a number`);
    }
  }

  for (const key of ['equals', 'not_equals']) {
    if (condition[key] !== undefined && !isConditionEqualityValue(condition[key])) {
      errors.push(`${path}.${key} must be a number or boolean`);
    }
  }

  if (condition.has_item !== undefined && typeof condition.has_item !== 'boolean') {
    errors.push(`${path}.has_item must be a boolean`);
  }
}

export function evaluateCondition(condition: ConditionDefinition, state: ConditionState): boolean {
  const getValue = (): number | boolean | undefined => {
    if (condition.counter) {
      return state.counters[condition.counter];
    }

    const inventoryKey = condition.item ?? condition.currency;
    if (inventoryKey) {
      return state.inventory[inventoryKey] ?? 0;
    }

    return undefined;
  };

  const value = getValue();
  if (value === undefined) {
    return false;
  }

  if (condition.has_item !== undefined) {
    const inventoryKey = condition.item ?? condition.currency;
    if (!inventoryKey) {
      return false;
    }

    const hasItem = (state.inventory[inventoryKey] ?? 0) > 0;
    return condition.has_item ? hasItem : !hasItem;
  }

  if (condition.equals !== undefined) return value === condition.equals;
  if (condition.not_equals !== undefined) return value !== condition.not_equals;
  if (typeof value !== 'number') {
    return false;
  }
  if (condition.greater_than !== undefined) return value > condition.greater_than;
  if (condition.less_than !== undefined) return value < condition.less_than;
  if (condition.greater_or_equal !== undefined) return value >= condition.greater_or_equal;
  if (condition.less_or_equal !== undefined) return value <= condition.less_or_equal;

  return true;
}

function validateAdventureSchema(document: unknown): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isRecord(document)) {
    errors.push('YAML root must be an object');
    return { errors, warnings };
  }

  reportUnknownKeys('root', document, TOP_LEVEL_KEYS, errors);

  const meta = document.meta;
  if (!isRecord(meta)) {
    errors.push('meta must be an object');
  } else {
    reportUnknownKeys('meta', meta, META_KEYS, errors);

    if (!isNonEmptyString(meta.title)) {
      errors.push('meta.title must be a non-empty string');
    }

    if (meta.description !== undefined && typeof meta.description !== 'string') {
      errors.push('meta.description must be a string');
    }

    if (meta.theme !== undefined) {
      if (!isNonEmptyString(meta.theme)) {
        errors.push('meta.theme must be a non-empty string');
      } else if (!VALID_THEME_IDS.has(meta.theme)) {
        errors.push(`meta.theme must be one of: ${Array.from(VALID_THEME_IDS).join(', ')}`);
      }
    } else {
      warnings.push('meta.theme is missing; defaulting to neon-mana-circuit');
    }

    if (meta.one_shot !== undefined && typeof meta.one_shot !== 'boolean') {
      errors.push('meta.one_shot must be a boolean');
    }
  }

  if (document.counters !== undefined) {
    if (!isRecord(document.counters)) {
      errors.push('counters must be an object');
    } else {
      for (const [counterId, definition] of Object.entries(document.counters)) {
        const path = `counters.${counterId}`;
        if (!isRecord(definition)) {
          errors.push(`${path} must be an object`);
          continue;
        }

        reportUnknownKeys(path, definition, COUNTER_KEYS, errors);

        if (!VALID_COUNTER_TYPES.has(definition.type as CounterDefinition['type'])) {
          errors.push(`${path}.type must be one of: ${Array.from(VALID_COUNTER_TYPES).join(', ')}`);
        }

        if (definition.default === undefined) {
          errors.push(`${path}.default is required`);
        } else if (definition.type === 'number' && !isFiniteNumber(definition.default)) {
          errors.push(`${path}.default must be a number when type is "number"`);
        } else if (definition.type === 'boolean' && typeof definition.default !== 'boolean') {
          errors.push(`${path}.default must be a boolean when type is "boolean"`);
        }
      }
    }
  }

  if (document.inventory !== undefined) {
    if (!isRecord(document.inventory)) {
      errors.push('inventory must be an object');
    } else {
      for (const [itemId, definition] of Object.entries(document.inventory)) {
        const path = `inventory.${itemId}`;
        if (!isRecord(definition)) {
          errors.push(`${path} must be an object`);
          continue;
        }

        reportUnknownKeys(path, definition, INVENTORY_KEYS, errors);

        if (!isNonEmptyString(definition.name)) {
          errors.push(`${path}.name must be a non-empty string`);
        }

        if (!isNonEmptyString(definition.description)) {
          errors.push(`${path}.description must be a non-empty string`);
        }

        if (!VALID_INVENTORY_TYPES.has(definition.type as InventoryItemDefinition['type'])) {
          errors.push(`${path}.type must be one of: ${Array.from(VALID_INVENTORY_TYPES).join(', ')}`);
        }

        if (definition.image !== undefined && typeof definition.image !== 'string') {
          errors.push(`${path}.image must be a string`);
        }

        if (definition.icon !== undefined && typeof definition.icon !== 'string') {
          errors.push(`${path}.icon must be a string`);
        }

        if (definition.color !== undefined) {
          if (!isNonEmptyString(definition.color)) {
            errors.push(`${path}.color must be a non-empty string`);
          } else if (!VALID_EXIT_COLORS.has(definition.color.toLowerCase())) {
            errors.push(`${path}.color must be one of: ${Array.from(VALID_EXIT_COLORS).join(', ')}`);
          }
        }

        if (definition.default !== undefined && !isFiniteNumber(definition.default)) {
          errors.push(`${path}.default must be a number`);
        }

        if (definition.consumed !== undefined && typeof definition.consumed !== 'boolean') {
          errors.push(`${path}.consumed must be a boolean`);
        }

        if (definition.usage_count !== undefined && !isPositiveInteger(definition.usage_count)) {
          errors.push(`${path}.usage_count must be a positive integer`);
        }

        if (definition.value !== undefined && typeof definition.value !== 'string' && !isFiniteNumber(definition.value)) {
          errors.push(`${path}.value must be a string or number`);
        }

        if (definition.bonus_timing !== undefined) {
          if (typeof definition.bonus_timing !== 'string') {
            errors.push(`${path}.bonus_timing must be a string`);
          } else if (!VALID_BONUS_TIMINGS.has(definition.bonus_timing.toLowerCase() as NonNullable<InventoryItemDefinition['bonus_timing']>)) {
            errors.push(`${path}.bonus_timing must be one of: ${Array.from(VALID_BONUS_TIMINGS).join(', ')}`);
          }
        }

        if (definition.type === 'bonus' && definition.value === undefined) {
          errors.push(`${path}.value is required for bonus items`);
        }

        if (definition.type === 'bonus' && definition.bonus_timing === undefined) {
          warnings.push(`${path}.bonus_timing is missing; defaulting to both`);
        }
      }
    }
  }

  const scenes = document.scenes;
  if (!Array.isArray(scenes)) {
    errors.push('scenes must be an array');
    return { errors, warnings };
  }

  if (scenes.length === 0) {
    errors.push('scenes must contain at least one scene');
  }

  const sceneIds = new Set<string>();

  scenes.forEach((scene, sceneIndex) => {
    const scenePath = `scenes[${sceneIndex}]`;
    if (!isRecord(scene)) {
      errors.push(`${scenePath} must be an object`);
      return;
    }

    reportUnknownKeys(scenePath, scene, SCENE_KEYS, errors);

    if (!isNonEmptyString(scene.id)) {
      errors.push(`${scenePath}.id must be a non-empty string`);
    } else if (sceneIds.has(scene.id)) {
      errors.push(`Duplicate scene id "${scene.id}"`);
    } else {
      sceneIds.add(scene.id);
    }

    if (!isNonEmptyString(scene.title)) {
      errors.push(`${scenePath}.title must be a non-empty string`);
    }

    if (!isNonEmptyString(scene.description)) {
      errors.push(`${scenePath}.description must be a non-empty string`);
    }

    if (scene.image !== undefined && typeof scene.image !== 'string') {
      errors.push(`${scenePath}.image must be a string`);
    }

    if (scene.icon !== undefined && typeof scene.icon !== 'string') {
      errors.push(`${scenePath}.icon must be a string`);
    }

    if (!Array.isArray(scene.exits)) {
      errors.push(`${scenePath}.exits must be an array`);
    } else {
      scene.exits.forEach((exit, exitIndex) => {
        const exitPath = `${scenePath}.exits[${exitIndex}]`;
        if (!isRecord(exit)) {
          errors.push(`${exitPath} must be an object`);
          return;
        }

        reportUnknownKeys(exitPath, exit, EXIT_KEYS, errors);

        if (!isNonEmptyString(exit.text)) {
          errors.push(`${exitPath}.text must be a non-empty string`);
        }

        if (exit.target !== undefined && !isNonEmptyString(exit.target)) {
          errors.push(`${exitPath}.target must be a non-empty string`);
        }

        if (!exit.gate && !exit.target) {
          errors.push(`${exitPath} must define target or gate`);
        }

        if (exit.one_time !== undefined && typeof exit.one_time !== 'boolean') {
          errors.push(`${exitPath}.one_time must be a boolean`);
        }

        if (exit.color !== undefined) {
          if (!isNonEmptyString(exit.color)) {
            errors.push(`${exitPath}.color must be a non-empty string`);
          } else if (!VALID_EXIT_COLORS.has(exit.color.toLowerCase())) {
            errors.push(`${exitPath}.color must be one of: ${Array.from(VALID_EXIT_COLORS).join(', ')}`);
          }
        }

        if (exit.gate !== undefined) {
          if (!isRecord(exit.gate)) {
            errors.push(`${exitPath}.gate must be an object`);
          } else {
            reportUnknownKeys(`${exitPath}.gate`, exit.gate, GATE_KEYS, errors);

            if (!isNonEmptyString(exit.gate.text)) {
              errors.push(`${exitPath}.gate.text must be a non-empty string`);
            }

            if (exit.gate.short_text !== undefined && typeof exit.gate.short_text !== 'string') {
              errors.push(`${exitPath}.gate.short_text must be a string`);
            }

            if (exit.gate.show_short !== undefined && typeof exit.gate.show_short !== 'boolean') {
              errors.push(`${exitPath}.gate.show_short must be a boolean`);
            }

            if (!isFiniteNumber(exit.gate.dc) || exit.gate.dc <= 0) {
              errors.push(`${exitPath}.gate.dc must be a positive number`);
            }

            if (!isNonEmptyString(exit.gate.failure_target)) {
              errors.push(`${exitPath}.gate.failure_target must be a non-empty string`);
            }

            if (!isNonEmptyString(exit.target)) {
              errors.push(`${exitPath}.target is required when gate is defined`);
            }
          }
        }

        if (exit.requires_item !== undefined) {
          if (!isRecord(exit.requires_item)) {
            errors.push(`${exitPath}.requires_item must be an object`);
          } else {
            reportUnknownKeys(`${exitPath}.requires_item`, exit.requires_item, REQUIRES_ITEM_KEYS, errors);

            if (!isNonEmptyString(exit.requires_item.id)) {
              errors.push(`${exitPath}.requires_item.id must be a non-empty string`);
            }

            if (exit.requires_item.amount !== undefined && !isPositiveInteger(exit.requires_item.amount)) {
              errors.push(`${exitPath}.requires_item.amount must be a positive integer`);
            }
          }
        }

        if (exit.visible_if !== undefined) {
          validateConditionDefinition(exit.visible_if, `${exitPath}.visible_if`, errors);
        }

        if (exit.effects !== undefined) {
          if (!isRecord(exit.effects)) {
            errors.push(`${exitPath}.effects must be an object`);
          } else {
            reportUnknownKeys(`${exitPath}.effects`, exit.effects, EFFECT_KEYS, errors);

            if (exit.effects.set_counter !== undefined) {
              if (!isRecord(exit.effects.set_counter)) {
                errors.push(`${exitPath}.effects.set_counter must be an object`);
              } else {
                for (const [counterId, counterValue] of Object.entries(exit.effects.set_counter)) {
                  if (!isFiniteNumber(counterValue) && typeof counterValue !== 'boolean') {
                    errors.push(`${exitPath}.effects.set_counter.${counterId} must be a number or boolean`);
                  }
                }
              }
            }

            for (const key of ['add_item', 'remove_item']) {
              if (exit.effects[key] !== undefined && !isNonEmptyString(exit.effects[key])) {
                errors.push(`${exitPath}.effects.${key} must be a non-empty string`);
              }
            }

            if (exit.effects.add_currency !== undefined) {
              if (!isRecord(exit.effects.add_currency)) {
                errors.push(`${exitPath}.effects.add_currency must be an object`);
              } else {
                for (const [currencyId, amount] of Object.entries(exit.effects.add_currency)) {
                  if (!isFiniteNumber(amount)) {
                    errors.push(`${exitPath}.effects.add_currency.${currencyId} must be a number`);
                  }
                }
              }
            }
          }
        }
      });
    }

    for (const field of ['add_items', 'remove_items'] as const) {
      const items = scene[field];
      if (items === undefined) {
        continue;
      }

      if (!Array.isArray(items)) {
        errors.push(`${scenePath}.${field} must be an array`);
        continue;
      }

      items.forEach((itemChange, itemIndex) => {
        const itemPath = `${scenePath}.${field}[${itemIndex}]`;
        if (!isRecord(itemChange)) {
          errors.push(`${itemPath} must be an object`);
          return;
        }

        reportUnknownKeys(itemPath, itemChange, SCENE_ITEM_CHANGE_KEYS, errors);

        if (!isNonEmptyString(itemChange.id)) {
          errors.push(`${itemPath}.id must be a non-empty string`);
        }

        if (!isPositiveInteger(itemChange.amount)) {
          errors.push(`${itemPath}.amount must be a positive integer`);
        }

        if (itemChange.text !== undefined && typeof itemChange.text !== 'string') {
          errors.push(`${itemPath}.text must be a string`);
        }
      });
    }
  });

  return { errors, warnings };
}

export function parseAdventureYaml(yamlContent: string): ParsedAdventure {
  return parseAdventureDocument(loadAdventureYamlDocument(yamlContent));
}

export function validateAdventure(parsed: ParsedAdventure): string[] {
  const errors: string[] = [];

  const validateParsedCondition = (condition: ConditionDefinition, sceneId: string, exitText: string): void => {
    const prefix = `Scene "${sceneId}": exit "${exitText}" visible_if`;

    if (condition.counter) {
      const counter = parsed.counters[condition.counter];
      if (!counter) {
        return;
      }

      if (condition.has_item !== undefined) {
        errors.push(`${prefix} cannot use has_item with a counter subject`);
      }

      const hasNumericComparison = condition.greater_than !== undefined
        || condition.less_than !== undefined
        || condition.greater_or_equal !== undefined
        || condition.less_or_equal !== undefined;

      if (counter.type === 'boolean') {
        if (hasNumericComparison) {
          errors.push(`${prefix} cannot use numeric comparisons with boolean counter "${condition.counter}"`);
        }

        for (const [operator, value] of [
          ['equals', condition.equals],
          ['not_equals', condition.not_equals],
        ] as const) {
          if (value !== undefined && typeof value !== 'boolean') {
            errors.push(`${prefix}.${operator} must be a boolean for counter "${condition.counter}"`);
          }
        }
      }

      if (counter.type === 'number') {
        for (const [operator, value] of [
          ['equals', condition.equals],
          ['not_equals', condition.not_equals],
        ] as const) {
          if (value !== undefined && !isFiniteNumber(value)) {
            errors.push(`${prefix}.${operator} must be a number for counter "${condition.counter}"`);
          }
        }
      }

      return;
    }

    if (condition.has_item !== undefined) {
      return;
    }

    for (const [operator, value] of [
      ['equals', condition.equals],
      ['not_equals', condition.not_equals],
    ] as const) {
      if (value !== undefined && !isFiniteNumber(value)) {
        errors.push(`${prefix}.${operator} must be a number for item or currency subjects`);
      }
    }
  };
  
  // Check for start scene
  if (!parsed.sceneMap['start']) {
    errors.push('Missing required "start" scene');
  }

  // Validate all exit targets exist
  for (const scene of parsed.scenes) {
    for (const exit of scene.exits) {
      if (!exit.target) {
        errors.push(`Scene "${scene.id}": exit "${exit.text}" is missing a target`);
      }
      if (exit.target && !parsed.sceneMap[exit.target]) {
        errors.push(`Scene "${scene.id}": exit "${exit.text}" targets non-existent scene "${exit.target}"`);
      }
      if (exit.gate?.failure_target && !parsed.sceneMap[exit.gate.failure_target]) {
        errors.push(`Scene "${scene.id}": gate failure targets non-existent scene "${exit.gate.failure_target}"`);
      }
      if (exit.requires_item && !parsed.inventory[exit.requires_item.id]) {
        errors.push(`Scene "${scene.id}": exit requires non-existent item "${exit.requires_item.id}"`);
      }
      if (exit.visible_if?.counter && !parsed.counters[exit.visible_if.counter]) {
        errors.push(`Scene "${scene.id}": exit references non-existent counter "${exit.visible_if.counter}"`);
      }
      if (exit.visible_if?.item && !parsed.inventory[exit.visible_if.item]) {
        errors.push(`Scene "${scene.id}": exit references non-existent item "${exit.visible_if.item}"`);
      }
      if (exit.visible_if?.currency) {
        const currency = parsed.inventory[exit.visible_if.currency];
        if (!currency) {
          errors.push(`Scene "${scene.id}": exit references non-existent currency "${exit.visible_if.currency}"`);
        } else if (currency.type !== 'currency') {
          errors.push(`Scene "${scene.id}": visible_if.currency must reference an inventory item of type "currency"`);
        }
      }

      if (exit.visible_if) {
        validateParsedCondition(exit.visible_if, scene.id, exit.text);
      }

      if (exit.effects?.set_counter) {
        for (const [counterId, value] of Object.entries(exit.effects.set_counter)) {
          const counter = parsed.counters[counterId];
          if (!counter) {
            errors.push(`Scene "${scene.id}": effects.set_counter references non-existent counter "${counterId}"`);
            continue;
          }

          if (counter.type === 'number' && typeof value !== 'number') {
            errors.push(`Scene "${scene.id}": effects.set_counter.${counterId} must be a number`);
          }

          if (counter.type === 'boolean' && typeof value !== 'boolean') {
            errors.push(`Scene "${scene.id}": effects.set_counter.${counterId} must be a boolean`);
          }
        }
      }

      if (exit.effects?.add_item && !parsed.inventory[exit.effects.add_item]) {
        errors.push(`Scene "${scene.id}": effects.add_item references non-existent item "${exit.effects.add_item}"`);
      }

      if (exit.effects?.remove_item && !parsed.inventory[exit.effects.remove_item]) {
        errors.push(`Scene "${scene.id}": effects.remove_item references non-existent item "${exit.effects.remove_item}"`);
      }

      if (exit.effects?.add_currency) {
        for (const currencyId of Object.keys(exit.effects.add_currency)) {
          const currency = parsed.inventory[currencyId];
          if (!currency) {
            errors.push(`Scene "${scene.id}": effects.add_currency references non-existent item "${currencyId}"`);
          } else if (currency.type !== 'currency') {
            errors.push(`Scene "${scene.id}": effects.add_currency.${currencyId} must reference an inventory item of type "currency"`);
          }
        }
      }
    }

    for (const field of ['add_items', 'remove_items'] as const) {
      for (const itemChange of scene[field] || []) {
        if (!parsed.inventory[itemChange.id]) {
          errors.push(`Scene "${scene.id}": ${field} references non-existent item "${itemChange.id}"`);
        }
      }
    }
  }

  return errors;
}

export function analyzeAdventureGraph(parsed: ParsedAdventure): AdventureGraphReport {
  const terminalScenes = parsed.scenes.filter((scene) => scene.exits.length === 0).map((scene) => scene.id);
  const report = createEmptyGraphReport(parsed.scenes.length);
  report.terminalScenes = terminalScenes;

  if (!parsed.sceneMap.start) {
    report.unreachableScenes = parsed.scenes.map((scene) => scene.id);
    return report;
  }

  interface SimulationState {
    currentSceneId: string;
    counters: Record<string, number | boolean>;
    inventory: Record<string, number>;
    usedExits: string[];
  }

  interface InventoryBounds {
    min: number;
    max: number;
  }

  const relevantCounterIds = new Set<string>();
  const relevantItemIds = new Set<string>();

  for (const scene of parsed.scenes) {
    for (const exit of scene.exits) {
      if (exit.visible_if?.counter) {
        relevantCounterIds.add(exit.visible_if.counter);
      }

      if (exit.visible_if?.item) {
        relevantItemIds.add(exit.visible_if.item);
      }

      if (exit.visible_if?.currency) {
        relevantItemIds.add(exit.visible_if.currency);
      }

      if (exit.requires_item?.id) {
        relevantItemIds.add(exit.requires_item.id);
      }
    }
  }

  const itemIds = [...relevantItemIds].sort();
  const counterIds = [...relevantCounterIds].sort();

  const collectInventoryBounds = (): Record<string, InventoryBounds> => {
    const maxRelevant: Record<string, number> = {};
    const minRelevant: Record<string, number> = {};
    const positiveDelta: Record<string, number> = {};
    const negativeDelta: Record<string, number> = {};
    const ensureItem = (itemId: string) => {
      if (!relevantItemIds.has(itemId)) {
        return;
      }

      if (maxRelevant[itemId] === undefined) {
        maxRelevant[itemId] = 0;
      }
      if (minRelevant[itemId] === undefined) {
        minRelevant[itemId] = parsed.inventory[itemId]?.type === 'currency' ? 0 : 0;
      }
      if (positiveDelta[itemId] === undefined) {
        positiveDelta[itemId] = 0;
      }
      if (negativeDelta[itemId] === undefined) {
        negativeDelta[itemId] = 0;
      }
    };

    const registerConditionValue = (itemId: string, condition: ConditionDefinition) => {
      ensureItem(itemId);

      if (condition.has_item !== undefined) {
        maxRelevant[itemId] = Math.max(maxRelevant[itemId], 1);
      }

      const numericCandidates = [
        condition.equals,
        condition.not_equals,
        condition.greater_than,
        condition.less_than,
        condition.greater_or_equal,
        condition.less_or_equal,
      ].filter(isFiniteNumber);

      for (const value of numericCandidates) {
        maxRelevant[itemId] = Math.max(maxRelevant[itemId], value + 1);
        minRelevant[itemId] = Math.min(minRelevant[itemId], value - 1);
      }
    };

    for (const [itemId, definition] of Object.entries(parsed.inventory)) {
      ensureItem(itemId);
      if (!relevantItemIds.has(itemId)) {
        continue;
      }

      const defaultValue = definition.default ?? (definition.type === 'currency' ? 0 : 0);
      maxRelevant[itemId] = Math.max(maxRelevant[itemId], defaultValue);
      minRelevant[itemId] = Math.min(minRelevant[itemId], defaultValue);
    }

    for (const scene of parsed.scenes) {
      for (const exit of scene.exits) {
        if (exit.requires_item?.id) {
          ensureItem(exit.requires_item.id);
          maxRelevant[exit.requires_item.id] = Math.max(maxRelevant[exit.requires_item.id], exit.requires_item.amount || 1);
        }

        if (exit.visible_if?.item) {
          registerConditionValue(exit.visible_if.item, exit.visible_if);
        }

        if (exit.visible_if?.currency) {
          registerConditionValue(exit.visible_if.currency, exit.visible_if);
        }

        if (exit.effects?.add_item) {
          ensureItem(exit.effects.add_item);
          positiveDelta[exit.effects.add_item] += 1;
          maxRelevant[exit.effects.add_item] = Math.max(maxRelevant[exit.effects.add_item], 1);
        }

        if (exit.effects?.add_currency) {
          for (const [itemId, amount] of Object.entries(exit.effects.add_currency)) {
            ensureItem(itemId);
            if (amount >= 0) {
              positiveDelta[itemId] += amount;
            } else {
              negativeDelta[itemId] += Math.abs(amount);
            }
          }
        }
      }

      for (const itemChange of scene.add_items || []) {
        ensureItem(itemChange.id);
        positiveDelta[itemChange.id] += Math.abs(itemChange.amount);
        maxRelevant[itemChange.id] = Math.max(maxRelevant[itemChange.id], Math.abs(itemChange.amount));
      }

      for (const itemChange of scene.remove_items || []) {
        ensureItem(itemChange.id);
        maxRelevant[itemChange.id] = Math.max(maxRelevant[itemChange.id], Math.abs(itemChange.amount));
      }
    }

    return Object.fromEntries(
      itemIds.map((itemId) => {
        const item = parsed.inventory[itemId];
        const max = Math.max(maxRelevant[itemId] ?? 0, 0) + (positiveDelta[itemId] ?? 0) + 1;
        const min = item?.type === 'currency'
          ? Math.min(minRelevant[itemId] ?? 0, 0) - (negativeDelta[itemId] ?? 0) - 1
          : 0;
        return [itemId, { min, max: Math.max(max, 1) }];
      })
    );
  };

  const inventoryBounds = collectInventoryBounds();

  const normalizeInventoryValue = (itemId: string, value: number): number => {
    const bounds = inventoryBounds[itemId];
    if (!bounds) {
      return value;
    }

    if (value < bounds.min) {
      return bounds.min;
    }

    if (value > bounds.max) {
      return bounds.max;
    }

    return value;
  };

  const cloneState = (state: SimulationState): SimulationState => ({
    currentSceneId: state.currentSceneId,
    counters: { ...state.counters },
    inventory: { ...state.inventory },
    usedExits: [...state.usedExits],
  });

  const normalizeState = (state: SimulationState): SimulationState => {
    const normalizedInventory: Record<string, number> = {};
    for (const itemId of itemIds) {
      const value = normalizeInventoryValue(itemId, state.inventory[itemId] ?? 0);
      if (value !== 0) {
        normalizedInventory[itemId] = value;
      }
    }

    return {
      currentSceneId: state.currentSceneId,
      counters: counterIds.reduce<Record<string, number | boolean>>((result, counterId) => {
        result[counterId] = state.counters[counterId] ?? parsed.counters[counterId]?.default;
        return result;
      }, {}),
      inventory: normalizedInventory,
      usedExits: [...new Set(state.usedExits)].sort(),
    };
  };

  const serializeState = (state: SimulationState): string => JSON.stringify({
    currentSceneId: state.currentSceneId,
    counters: counterIds.map((counterId) => [counterId, state.counters[counterId] ?? null]),
    inventory: itemIds.map((itemId) => [itemId, state.inventory[itemId] ?? 0]),
    usedExits: state.usedExits,
  });

  const applySceneItemChanges = (state: SimulationState, scene: SceneDefinition): void => {
    for (const itemChange of scene.add_items || []) {
      if (!relevantItemIds.has(itemChange.id)) {
        continue;
      }

      state.inventory[itemChange.id] = normalizeInventoryValue(
        itemChange.id,
        (state.inventory[itemChange.id] ?? 0) + Math.abs(itemChange.amount)
      );
    }

    for (const itemChange of scene.remove_items || []) {
      if (!relevantItemIds.has(itemChange.id)) {
        continue;
      }

      const nextAmount = Math.max(0, (state.inventory[itemChange.id] ?? 0) - Math.abs(itemChange.amount));
      if (nextAmount === 0) {
        delete state.inventory[itemChange.id];
      } else {
        state.inventory[itemChange.id] = nextAmount;
      }
    }
  };

  const isExitVisible = (state: SimulationState, exit: ExitDefinition): boolean => {
    if (!exit.visible_if) {
      return true;
    }

    return evaluateCondition(exit.visible_if, state);
  };

  const canUseExit = (state: SimulationState, exit: ExitDefinition): boolean => {
    const exitKey = `${state.currentSceneId}:${exit.text}`;
    if (exit.one_time && state.usedExits.includes(exitKey)) {
      return false;
    }

    if (!exit.requires_item) {
      return true;
    }

    return (state.inventory[exit.requires_item.id] ?? 0) >= (exit.requires_item.amount || 1);
  };

  const applyExitTransition = (
    state: SimulationState,
    exit: ExitDefinition,
    targetSceneId: string,
    isGateOutcome: boolean
  ): SimulationState => {
    const nextState = cloneState(state);
    const exitKey = `${state.currentSceneId}:${exit.text}`;

    if (!isGateOutcome && exit.requires_item) {
      const item = parsed.inventory[exit.requires_item.id];
      const amount = exit.requires_item.amount || 1;
      if (item?.type === 'currency') {
        nextState.inventory[exit.requires_item.id] = normalizeInventoryValue(
          exit.requires_item.id,
          (nextState.inventory[exit.requires_item.id] ?? 0) - amount
        );
        if ((nextState.inventory[exit.requires_item.id] ?? 0) === 0) {
          delete nextState.inventory[exit.requires_item.id];
        }
      } else if (item?.consumed !== false) {
        delete nextState.inventory[exit.requires_item.id];
      }
    }

    if (!isGateOutcome && exit.effects) {
      if (exit.effects.set_counter) {
        for (const [counterId, value] of Object.entries(exit.effects.set_counter)) {
          if (relevantCounterIds.has(counterId)) {
            nextState.counters[counterId] = value;
          }
        }
      }

      if (exit.effects.add_item && relevantItemIds.has(exit.effects.add_item)) {
        nextState.inventory[exit.effects.add_item] = normalizeInventoryValue(exit.effects.add_item, 1);
      }

      if (exit.effects.remove_item && relevantItemIds.has(exit.effects.remove_item)) {
        delete nextState.inventory[exit.effects.remove_item];
      }

      if (exit.effects.add_currency) {
        for (const [itemId, amount] of Object.entries(exit.effects.add_currency)) {
          if (!relevantItemIds.has(itemId)) {
            continue;
          }

          nextState.inventory[itemId] = normalizeInventoryValue(itemId, (nextState.inventory[itemId] ?? 0) + amount);
          if ((nextState.inventory[itemId] ?? 0) === 0) {
            delete nextState.inventory[itemId];
          }
        }
      }
    }

    if (exit.one_time) {
      nextState.usedExits.push(exitKey);
    }

    nextState.currentSceneId = targetSceneId;
    const targetScene = parsed.sceneMap[targetSceneId];
    if (targetScene) {
      applySceneItemChanges(nextState, targetScene);
    }

    return normalizeState(nextState);
  };

  const initialState = normalizeState({
    currentSceneId: 'start',
    counters: Object.fromEntries(
      Object.entries(parsed.counters)
        .filter(([counterId]) => relevantCounterIds.has(counterId))
        .map(([counterId, definition]) => [counterId, definition.default])
    ),
    inventory: Object.fromEntries(
      Object.entries(parsed.inventory)
        .filter(([itemId]) => relevantItemIds.has(itemId))
        .map(([itemId, definition]) => [itemId, definition.default ?? (definition.type === 'currency' ? 0 : 0)])
        .filter(([, amount]) => amount !== 0)
    ),
    usedExits: [],
  });

  const initialKey = serializeState(initialState);
  const queue: SimulationState[] = [initialState];
  let queueIndex = 0;
  const visited = new Map<string, SimulationState>([[initialKey, initialState]]);
  const edges = new Map<string, Set<string>>();
  const reverseEdges = new Map<string, Set<string>>();
  const sceneStates = new Map<string, Set<string>>();
  const terminalStateKeys = new Set<string>();

  while (queueIndex < queue.length) {
    const state = queue[queueIndex];
    queueIndex += 1;

    const stateKey = serializeState(state);
    const scene = parsed.sceneMap[state.currentSceneId];
    if (!scene) {
      continue;
    }

    if (!sceneStates.has(scene.id)) {
      sceneStates.set(scene.id, new Set());
    }
    sceneStates.get(scene.id)?.add(stateKey);

    if (scene.exits.length === 0) {
      terminalStateKeys.add(stateKey);
      continue;
    }

    const nextStateKeys = new Set<string>();
    for (const exit of scene.exits) {
      if (!isExitVisible(state, exit) || !canUseExit(state, exit)) {
        continue;
      }

      const outcomes = exit.gate
        ? [exit.target, exit.gate.failure_target]
        : [exit.target];

      for (const targetSceneId of outcomes) {
        if (!targetSceneId || !parsed.sceneMap[targetSceneId]) {
          continue;
        }

        const nextState = applyExitTransition(state, exit, targetSceneId, Boolean(exit.gate));
        const nextKey = serializeState(nextState);
        nextStateKeys.add(nextKey);

        if (!reverseEdges.has(nextKey)) {
          reverseEdges.set(nextKey, new Set());
        }
        reverseEdges.get(nextKey)?.add(stateKey);

        if (!visited.has(nextKey)) {
          visited.set(nextKey, nextState);
          queue.push(nextState);
        }
      }
    }

    edges.set(stateKey, nextStateKeys);
  }

  const statesThatReachEnding = new Set<string>(terminalStateKeys);
  const reverseQueue = [...terminalStateKeys];
  let reverseQueueIndex = 0;
  while (reverseQueueIndex < reverseQueue.length) {
    const stateKey = reverseQueue[reverseQueueIndex];
    reverseQueueIndex += 1;

    for (const previousStateKey of reverseEdges.get(stateKey) || []) {
      if (statesThatReachEnding.has(previousStateKey)) {
        continue;
      }

      statesThatReachEnding.add(previousStateKey);
      reverseQueue.push(previousStateKey);
    }
  }

  const reachableSceneIds = new Set(sceneStates.keys());

  report.reachableScenes = reachableSceneIds.size;
  report.unreachableScenes = parsed.scenes
    .map((scene) => scene.id)
    .filter((sceneId) => !reachableSceneIds.has(sceneId));
  report.deadEndScenes = parsed.scenes
    .filter((scene) => scene.exits.length > 0 && reachableSceneIds.has(scene.id))
    .filter((scene) => {
      const keys = sceneStates.get(scene.id);
      if (!keys || keys.size === 0) {
        return false;
      }

      for (const key of keys) {
        if (statesThatReachEnding.has(key)) {
          return false;
        }
      }

      return true;
    })
    .map((scene) => scene.id);
  report.completable = statesThatReachEnding.has(initialKey);

  return report;
}

export function validateAdventureYamlContent(yamlContent: string): AdventureValidationResult {
  try {
    const document = loadAdventureYamlDocument(yamlContent);
    const { errors, warnings } = validateAdventureSchema(document);
    let parsed: ParsedAdventure | undefined;
    let graph = createEmptyGraphReport();

    try {
      parsed = parseAdventureDocument(document);
    } catch (error) {
      appendUnique(errors, [error instanceof Error ? error.message : 'Invalid YAML document']);
    }

    if (parsed) {
      appendUnique(errors, validateAdventure(parsed));
      graph = analyzeAdventureGraph(parsed);

      if (graph.unreachableScenes.length > 0) {
        warnings.push(`Unreachable scenes: ${graph.unreachableScenes.join(', ')}`);
      }

      if (graph.terminalScenes.length === 0) {
        errors.push('Adventure has no ending scenes (scenes with no exits)');
      }

      if (graph.deadEndScenes.length > 0) {
        errors.push(`Dead-end scenes detected: ${graph.deadEndScenes.join(', ')}`);
      }

      if (!graph.completable && parsed.sceneMap.start) {
        errors.push('Adventure is not completable from the "start" scene');
      }

      const usedCounters = new Set<string>();
      const usedInventory = new Set<string>();

      for (const scene of parsed.scenes) {
        for (const exit of scene.exits) {
          if (exit.requires_item?.id) {
            usedInventory.add(exit.requires_item.id);
          }

          if (exit.visible_if?.counter) {
            usedCounters.add(exit.visible_if.counter);
          }

          if (exit.visible_if?.item) {
            usedInventory.add(exit.visible_if.item);
          }

          if (exit.visible_if?.currency) {
            usedInventory.add(exit.visible_if.currency);
          }

          if (exit.effects?.set_counter) {
            for (const counterId of Object.keys(exit.effects.set_counter)) {
              usedCounters.add(counterId);
            }
          }

          if (exit.effects?.add_item) {
            usedInventory.add(exit.effects.add_item);
          }

          if (exit.effects?.remove_item) {
            usedInventory.add(exit.effects.remove_item);
          }

          if (exit.effects?.add_currency) {
            for (const currencyId of Object.keys(exit.effects.add_currency)) {
              usedInventory.add(currencyId);
            }
          }
        }

        for (const itemChange of scene.add_items || []) {
          usedInventory.add(itemChange.id);
        }

        for (const itemChange of scene.remove_items || []) {
          usedInventory.add(itemChange.id);
        }
      }

      for (const counterId of Object.keys(parsed.counters)) {
        if (!usedCounters.has(counterId)) {
          warnings.push(`Counter "${counterId}" is defined but never used`);
        }
      }

      for (const itemId of Object.keys(parsed.inventory)) {
        if (!usedInventory.has(itemId)) {
          warnings.push(`Inventory item "${itemId}" is defined but never used`);
        }
      }
    }

    const uniqueErrors = Array.from(new Set(errors));
    const uniqueWarnings = Array.from(new Set(warnings)).filter((warning) => !uniqueErrors.includes(warning));

    return {
      status: uniqueErrors.length > 0 ? 'Invalid' : 'Valid',
      errors: uniqueErrors,
      warnings: uniqueWarnings,
      graph,
      parsed,
    };
  } catch (error) {
    return {
      status: 'Invalid',
      errors: [`YAML parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`],
      warnings: [],
      graph: createEmptyGraphReport(),
    };
  }
}
