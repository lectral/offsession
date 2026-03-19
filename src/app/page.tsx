'use client';

import { useState, useEffect } from 'react';
import type { DiceResult } from '@/lib/dice';
import type { InventoryItemDefinition } from '@/lib/adventure-utils';
import type { GameHistoryEntry } from '@/lib/game-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Scroll, Plus, Play, Lock, Trash2, 
  ChevronRight, Dices, Package, BookOpen, Eye, ArrowLeft,
  Sparkles, AlertCircle, CheckCircle, RefreshCw, ExternalLink, Copy, Download
} from 'lucide-react';
import ReactMarkdown, { type Components } from 'react-markdown';
import { toast } from '@/hooks/use-toast';
import { RPG_AWESOME_ICON_IDS_TEXT } from '@/lib/rpg-awesome-icons';

const MARKDOWN_COMPONENTS: Components = {
  h1: ({ children }) => <h1 className="markdown-h1" style={{ color: 'var(--theme-accent, currentColor)', margin: '1.5rem 0 1rem', fontSize: '1.875rem', fontWeight: 700, letterSpacing: '0.04em' }}>{children}</h1>,
  h2: ({ children }) => <h2 className="markdown-h2" style={{ color: 'var(--theme-accent, currentColor)', margin: '1.25rem 0 0.75rem', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '0.03em' }}>{children}</h2>,
  h3: ({ children }) => <h3 className="markdown-h3" style={{ color: 'var(--theme-accent, currentColor)', margin: '1rem 0 0.5rem', fontSize: '1.25rem', fontWeight: 600, letterSpacing: '0.02em' }}>{children}</h3>,
  h4: ({ children }) => <h4 className="markdown-h4" style={{ color: 'var(--theme-accent, currentColor)', margin: '1rem 0 0.5rem', fontSize: '1.125rem', fontWeight: 600 }}>{children}</h4>,
  h5: ({ children }) => <h5 className="markdown-h5" style={{ color: 'var(--theme-accent, currentColor)', margin: '0.75rem 0 0.5rem', fontSize: '1rem', fontWeight: 600 }}>{children}</h5>,
  h6: ({ children }) => <h6 className="markdown-h6" style={{ color: 'var(--theme-accent, currentColor)', margin: '0.75rem 0 0.5rem', fontSize: '0.875rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{children}</h6>,
  p: ({ children }) => <p className="markdown-p" style={{ margin: '0.75rem 0', lineHeight: 1.7 }}>{children}</p>,
  ul: ({ children }) => <ul className="markdown-ul" style={{ margin: '0.75rem 0', paddingLeft: '1.5rem', listStyleType: 'disc', listStylePosition: 'outside' }}>{children}</ul>,
  ol: ({ children }) => <ol className="markdown-ol" style={{ margin: '0.75rem 0', paddingLeft: '1.5rem', listStyleType: 'decimal', listStylePosition: 'outside' }}>{children}</ol>,
  li: ({ children }) => <li className="markdown-li" style={{ paddingLeft: '0.25rem', lineHeight: 1.7 }}>{children}</li>,
};

// Types
interface Adventure {
  id: string;
  title: string;
  theme: string;
  createdAt: string;
}

interface StoredAdventure {
  id: string;
  title: string;
  theme: string;
  createdAt: string;
  completed?: boolean;
  sessionId?: string;
}

interface Exit {
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

interface SceneItemChange {
  id: string;
  itemName: string;
  amount: number;
  text?: string;
  type: 'add' | 'remove';
}

interface Scene {
  id: string;
  title: string;
  description: string;
  image?: string;
  icon?: string;
  exits: Exit[];
  itemChanges?: SceneItemChange[];
}

interface InventoryItem {
  name: string;
  description: string;
  type: InventoryItemDefinition['type'];
  image?: string;
  icon?: string;
  color?: string;
  value?: string;
  usage_count?: number;
  bonus_timing?: InventoryItemDefinition['bonus_timing'];
}

const NAMED_COLOR_STYLES: Record<string, { bg: string; border: string; text: string; shadow: string }> = {
  red: { bg: 'rgba(239, 68, 68, 0.15)', border: '#ef4444', text: '#fca5a5', shadow: 'rgba(239, 68, 68, 0.3)' },
  green: { bg: 'rgba(34, 197, 94, 0.15)', border: '#22c55e', text: '#86efac', shadow: 'rgba(34, 197, 94, 0.3)' },
  blue: { bg: 'rgba(59, 130, 246, 0.15)', border: '#3b82f6', text: '#93c5fd', shadow: 'rgba(59, 130, 246, 0.3)' },
  purple: { bg: 'rgba(139, 92, 246, 0.15)', border: '#8b5cf6', text: '#c4b5fd', shadow: 'rgba(139, 92, 246, 0.3)' },
  gold: { bg: 'rgba(251, 191, 36, 0.15)', border: '#fbbf24', text: '#fde68a', shadow: 'rgba(251, 191, 36, 0.3)' },
  yellow: { bg: 'rgba(234, 179, 8, 0.15)', border: '#eab308', text: '#fde047', shadow: 'rgba(234, 179, 8, 0.3)' },
  cyan: { bg: 'rgba(6, 182, 212, 0.15)', border: '#06b6d4', text: '#67e8f9', shadow: 'rgba(6, 182, 212, 0.3)' },
  orange: { bg: 'rgba(249, 115, 22, 0.15)', border: '#f97316', text: '#fdba74', shadow: 'rgba(249, 115, 22, 0.3)' },
  pink: { bg: 'rgba(236, 72, 153, 0.15)', border: '#ec4899', text: '#f9a8d4', shadow: 'rgba(236, 72, 153, 0.3)' },
  white: { bg: 'rgba(255, 255, 255, 0.1)', border: '#ffffff', text: '#ffffff', shadow: 'rgba(255, 255, 255, 0.3)' },
  emerald: { bg: 'rgba(16, 185, 129, 0.15)', border: '#10b981', text: '#6ee7b7', shadow: 'rgba(16, 185, 129, 0.3)' },
  amber: { bg: 'rgba(245, 158, 11, 0.15)', border: '#f59e0b', text: '#fcd34d', shadow: 'rgba(245, 158, 11, 0.3)' },
};

function getNamedColorStyle(color?: string) {
  return color ? NAMED_COLOR_STYLES[color.toLowerCase()] ?? null : null;
}

function normalizeRpgAwesomeIcon(icon?: string): string | null {
  if (!icon) {
    return null;
  }

  const tokens = icon.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matchingToken = tokens.find((token) => token.startsWith('ra-')) ?? tokens.find((token) => token !== 'ra');
  if (!matchingToken) {
    return null;
  }

  const iconName = matchingToken.replace(/^ra-/, '');
  if (!iconName.match(/^[a-z0-9-]+$/)) {
    return null;
  }

  return `ra ra-${iconName}`;
}

function renderRpgAwesomeIcon(
  icon: string | undefined,
  label: string,
  className?: string,
  style?: React.CSSProperties
) {
  const iconClassName = normalizeRpgAwesomeIcon(icon);
  if (!iconClassName) {
    return null;
  }

  return <i aria-label={label} className={`${iconClassName} rpg-awesome-icon ${className || ''}`.trim()} style={style} />;
}

interface GameState {
  currentSceneId: string;
  inventory: Record<string, number>;
  history: GameHistoryEntry[];
  pendingGate?: {
    exitIndex: number;
    rerollArmed: boolean;
    lastRoll?: DiceResult;
  } | null;
  completed?: boolean;
}

interface GameData {
  sessionId: string;
  state: GameState;
  scene: Scene;
  inventory: Record<string, InventoryItem>;
  meta: { title: string; description?: string; theme: string };
}

interface AdventureValidationGraph {
  totalScenes: number;
  reachableScenes: number;
  unreachableScenes: string[];
  terminalScenes: string[];
  deadEndScenes: string[];
  completable: boolean;
}

interface AdventureValidationReport {
  status: 'Valid' | 'Invalid';
  errors: string[];
  warnings: string[];
  graph: AdventureValidationGraph;
}

interface DmSessionSummary {
  id: string;
  currentSceneId: string;
  updatedAt: string;
  historyLength: number;
}

interface DmSessionDetail {
  sessionId: string;
  currentSceneId: string;
  updatedAt: string;
  history: GameHistoryEntry[];
}

// Theme list
const THEMES = [
  { id: 'neon-mana-circuit', name: 'Neon Mana Circuit', desc: 'Retro-futuristic magic' },
  { id: 'sol-arcana-ledger', name: 'Sol-Arcana Ledger', desc: 'Warm JRPG aesthetic' },
  { id: 'prism-spark-sanctuary', name: 'Prism Spark Sanctuary', desc: 'Ethereal crystalline' },
  { id: 'mana-punk', name: 'Mana-Punk', desc: 'Tech-fantasy cyberpunk' },
  { id: 'gilded-relic', name: 'Gilded Relic', desc: 'Ancient artifact' },
];

// Larger demo YAML with 5+ scenes
const DEFAULT_YAML = `# ==========================================
# THE FORGOTTEN CITADEL
# ==========================================
meta:
  title: "The Forgotten Citadel"
  description: "An ancient citadel holds secrets and dangers beyond imagination."
  theme: "gilded-relic"
  one_shot: true

# ==========================================
# COUNTERS (Hidden Logic State)
# ==========================================
counters:
  guard_alerted:
    type: "number"
    default: 0
  found_secret:
    type: "number"
    default: 0
  treasure_collected:
    type: "number"
    default: 0

# ==========================================
# INVENTORY (Visible Player Assets)
# ==========================================
inventory:
  gold_coin:
    name: "Gold"
    description: "Shiny gold coins found throughout the citadel."
    type: "currency"
    icon: "gold-bar"
    color: "gold"
    default: 25

  torch:
    name: "Torch"
    description: "Illuminates dark passages. Limited uses."
    type: "item"
    icon: "torch"
    color: "amber"
    default: 1

  ancient_key:
    name: "Ancient Key"
    description: "An ornate key with mysterious engravings."
    type: "item"
    icon: "key"
    color: "yellow"

  healing_potion:
    name: "Healing Potion"
    description: "Restores health in dire situations."
    type: "item"
    icon: "potion"
    color: "red"

  citadel_map:
    name: "Citadel Map"
    description: "A worn map showing secret ledges, hidden stairs, and smuggler routes."
    type: "item"
    icon: "treasure-map"
    color: "cyan"

  lucky_charm:
    name: "Lucky Charm"
    description: "Reroll a failed check."
    type: "reroll"
    icon: "clovers"
    color: "emerald"
    default: 2

  scouts_focus:
    name: "Scout's Focus"
    description: "Add +2 before a roll after studying the guard routes."
    type: "bonus"
    icon: "eye-shield"
    color: "blue"
    value: "2"
    bonus_timing: "before"

  warriors_blessing:
    name: "Warrior's Blessing"
    description: "Add +5 to your roll."
    type: "bonus"
    icon: "sword"
    color: "purple"
    value: "5"
    bonus_timing: "both"
    default: 2

  fate_bead:
    name: "Fate Bead"
    description: "Add +4 after seeing the outcome of a roll."
    type: "bonus"
    icon: "crystal-ball"
    color: "pink"
    value: "4"
    bonus_timing: "after"

# ==========================================
# SCENES
# ==========================================
scenes:
  - id: start
    title: "The Gates of Yore"
    icon: "castle"
    description: |
      You stand before the towering gates of the Forgotten Citadel. Ancient stone walls rise high into the mist, their surfaces covered in moss and mysterious runes. The iron gates hang partially open, creaking ominously in the wind.

      Two paths lie before you: the main entrance, or a narrow crack in the wall to the east that might allow for a stealthy approach.
    exits:
      - text: "Enter through the main gates"
        target: courtyard

      - text: "Squeeze through the crack"
        gate:
          text: "The crack is tight. Roll Dexterity to squeeze through."
          short_text: "Dexterity"
          show_short: true
          dc: 10
          failure_target: stuck
        target: garden

      - text: "Search for another way"
        visible_if:
          counter: found_secret
          equals: 0
        effects:
          set_counter:
            found_secret: 1
        gate:
          text: "You carefully examine the walls for hidden passages. Roll Investigation."
          short_text: "Investigation"
          show_short: true
          dc: 14
          failure_target: courtyard
        target: secret_passage
        one_time: true

  - id: courtyard
    title: "The Central Courtyard"
    icon: "castle-emblem"
    description: |
      The courtyard stretches before you, once a place of beauty now reduced to ruin. A dried fountain stands in the center, its statue headless and weathered. Stone benches line the perimeter, and ancient tapestries hang tattered from the walls.

      To the north, a grand doorway leads deeper into the citadel. To the west, you see what appears to be a guard tower. An old well sits in the corner, its depths shrouded in darkness.
    exits:
      - text: "Enter the main hall"
        target: main_hall

      - text: "Investigate the guard tower"
        target: guard_tower

      - text: "Climb down the well"
        gate:
          text: "The well is deep and slippery. Roll Athletics to climb down safely."
          short_text: "Athletics"
          show_short: true
          dc: 12
          failure_target: well_fallen
        target: underground

      - text: "Rest at the fountain"
        target: courtyard_rest

      - text: "Inspect the fountain's false bottom"
        target: fountain_cache
        visible_if:
          counter: treasure_collected
          equals: 0
        one_time: true
        color: gold

  - id: garden
    title: "The Overgrown Garden"
    icon: "flowers"
    description: |
      You emerge into what was once a magnificent garden. Thorny vines have overgrown everything, and strange luminescent flowers cast an eerie glow. In the center, you spot an ancient pedestal holding a glowing orb.

      A crumbling gazebo offers shelter, and you notice fresh footprints leading toward a hidden door in the garden wall.
    exits:
      - text: "Take the glowing orb"
        gate:
          text: "As you reach for the orb, vines lash out! Roll Dexterity to dodge."
          short_text: "Dexterity"
          show_short: true
          dc: 13
          failure_target: garden_trapped
        target: garden_orb
        one_time: true

      - text: "Follow the footprints"
        visible_if:
          counter: guard_alerted
          less_than: 1
        target: secret_passage

      - text: "Search the gazebo"
        target: gazebo

  - id: secret_passage
    title: "The Hidden Corridor"
    icon: "stone-tower"
    description: |
      You discover a hidden corridor behind the walls, used by the citadel's former inhabitants for secret movements. Torches line the walls, still burning with an unnatural blue flame.

      The passage splits ahead: one path leads upward toward what must be the treasury, while another descends into the citadel's depths. You hear the faint sound of running water from below.
    exits:
      - text: "Ascend to the treasury"
        gate:
          text: "The stairs are trapped! Roll Perception to spot the pressure plates."
          short_text: "Perception"
          show_short: true
          dc: 15
          failure_target: treasury_trapped
        target: treasury
        one_time: true

      - text: "Descend to the depths"
        target: underground

      - text: "Return to the courtyard"
        target: courtyard

  - id: main_hall
    title: "The Grand Hall"
    icon: "crown"
    description: |
      The grand hall takes your breath away. Vaulted ceilings disappear into shadow, and massive pillars carved with ancient stories line the room. A faded red carpet leads to an ornate throne at the far end.

      Dust-covered chandeliers hang precariously overhead. To your left, a door marked with royal insignia beckons, while to your right, you hear distant chanting from behind a heavy oak door.
    exits:
      - text: "Approach the throne"
        gate:
          text: "The throne is warded! Roll Wisdom to sense the magical trap."
          short_text: "Wisdom"
          show_short: true
          dc: 14
          failure_target: throne_trapped
        target: throne_room
        one_time: true

      - text: "Enter the royal chambers"
        requires_item:
          id: ancient_key
          amount: 1
        target: royal_chambers

      - text: "Investigate the chanting"
        target: ritual_room

  - id: treasury
    title: "The Ancient Treasury"
    description: |
      Gold coins and precious gems scatter across the floor. Ancient weapons line the walls, and mysterious artifacts rest on velvet cushions. In the center, a magnificent crown sits upon a pedestal, radiating power.

      This is what you came for. But something feels wrong... the shadows seem to move of their own accord.
    exits:
      - text: "Take the crown"
        color: gold
        gate:
          text: "The crown is protected by a spectral guardian! Roll Constitution to withstand its presence."
          short_text: "Constitution"
          show_short: true
          dc: 16
          failure_target: treasury_defeat
        target: victory

      - text: "Collect what you can carry"
        target: escape_rich

      - text: "Leave before trouble finds you"
        color: cyan
        target: secret_passage

  - id: victory
    title: "VICTORY - Ruler of the Citadel"
    description: |
      The crown accepts you as the new ruler of the Forgotten Citadel. Power flows through you as the ancient magics recognize their new master.

      The spectral guardians bow in submission. The citadel's secrets are now yours to command. You have achieved the ultimate prize and lived to tell the tale.

      **Congratulations, adventurer! You have conquered the Forgotten Citadel!**
    exits: []

  - id: stuck
    title: "Wedged in the Wall"
    description: |
      You're stuck! The crack was narrower than it appeared. After several embarrassing minutes of wiggling, you finally push through, but your clothes are torn and you've made quite a racket.

      Someone—or something—may have heard you...
    exits:
      - text: "Continue carefully"
        target: garden

  - id: well_fallen
    title: "The Dark Depths"
    description: |
      You slip and tumble down the well! The fall is painful but not fatal. You land in shallow water, bruised but alive.

      Bioluminescent fungi light your surroundings. You appear to be in an underground river system. A tunnel leads away into darkness, and you can see a rusty ladder leading back up.
    exits:
      - text: "Climb back up"
        gate:
          text: "The ladder is old and rusty. Roll Strength to climb up."
          short_text: "Strength"
          show_short: true
          dc: 11
          failure_target: well_fallen
        target: courtyard

      - text: "Explore the tunnel"
        target: underground

  - id: underground
    title: "The Underground River"
    description: |
      An underground river flows through carved stone channels. Ancient bridges cross the dark water, and you can see distant lights flickering in caves along the banks.

      The air is damp and cold. You notice small boats moored along the shore, and a narrow path leads deeper into the cavern system.
    exits:
      - text: "Take a boat downstream"
        target: treasure_cave

      - text: "Follow the map to a smugglers' ledge"
        target: hidden_ledge
        visible_if:
          item: citadel_map
          has_item: true
        color: cyan

      - text: "Pay the ferryman's tithe"
        target: treasure_cave
        visible_if:
          currency: gold_coin
          greater_or_equal: 30
        effects:
          add_currency:
            gold_coin: -30
        color: yellow

      - text: "Follow the path"
        target: ritual_room

      - text: "Climb back to the surface"
        target: courtyard

  - id: treasure_cave
    title: "The Hidden Cache"
    description: |
      Your boat drifts into a small cave filled with old chests and scattered coins. This appears to be a smuggler's cache or perhaps a forgotten treasury vault.

      Most chests are empty, but one remains sealed with an intricate lock. Strange symbols glow faintly on its surface.
    exits:
      - text: "Force the chest open"
        gate:
          text: "The chest is trapped! Roll Dexterity to avoid the poison needle."
          short_text: "Dexterity"
          show_short: true
          dc: 12
          failure_target: chest_trapped
        target: chest_open
        one_time: true

      - text: "Return to the river"
        target: underground

  # Additional scenes for failures and side paths
  - id: guard_tower
    title: "The Old Guard Tower"
    description: |
      The guard tower offers a commanding view of the citadel grounds. Ancient weapons rust in their racks, and a tattered banner hangs from the wall.

      In a corner, you find an old guard's journal describing a secret treasury accessed through the main hall.
    add_items:
      - id: scouts_focus
        amount: 1
        text: "You study the patrol notes and gain Scout's Focus (+2 before a roll)."
    exits:
      - text: "Return to the courtyard"
        target: courtyard

  - id: courtyard_rest
    title: "A Moment's Rest"
    description: |
      You rest by the dried fountain, taking in the melancholy beauty of the ruined courtyard. Your wounds begin to heal, and you feel slightly rejuvenated.

      The peaceful moment is interrupted by the distant sound of stone grinding on stone...
    exits:
      - text: "Investigate the sound"
        target: main_hall

      - text: "Stay alert and rest more"
        target: courtyard

  - id: fountain_cache
    title: "The Fountain Cache"
    description: |
      Beneath the cracked basin you uncover a waterproof coffer, untouched by time. Inside are neatly wrapped coins and a small talisman once carried by a nervous court messenger.

      Whoever hid this intended to flee in a hurry and never made it back.
    add_items:
      - id: gold_coin
        amount: 15
        text: "You pocket 15 gold coins from the hidden cache."
      - id: lucky_charm
        amount: 1
        text: "You recover a Lucky Charm that can fuel a reroll."
    exits:
      - text: "Slip back to the courtyard"
        target: courtyard

  - id: garden_trapped
    title: "Ensnared by Vines"
    description: |
      The vines wrap around your arm, thorns digging into your flesh! You struggle against the magical vegetation, finally breaking free but not without cost.

      Your arm throbs with pain, and you notice the vines have left a strange mark on your skin—a map perhaps?
    remove_items:
      - id: torch
        amount: 1
        text: "Your torch is crushed and snuffed out in the struggle."
    exits:
      - text: "Study the mark"
        target: garden_orb

      - text: "Ignore it and continue"
        target: gazebo

  - id: garden_orb
    title: "The Orb's Power"
    description: |
      The orb pulses with ancient energy as you hold it. Visions of the citadel's golden age flash through your mind, and you see the location of the treasury clearly now.

      The orb crumbles to dust after sharing its secrets, but you know exactly where to go.
    exits:
      - text: "Head to the treasury"
        target: secret_passage

      - text: "Continue exploring"
        target: gazebo

  - id: gazebo
    title: "The Crumbling Gazebo"
    description: |
      The gazebo offers shelter from the eerie garden. Inside, you find old cushions and a small chest containing supplies left by previous explorers.

      Among the supplies, you discover a healing potion and a worn map of the citadel.
    add_items:
      - id: healing_potion
        amount: 1
        text: "You take a healing potion from the supply chest."
      - id: citadel_map
        amount: 1
        text: "You unfold a Citadel Map marked with a smugglers' ledge."
      - id: ancient_key
        amount: 1
        text: "A velvet pouch hides an Ancient Key."
    exits:
      - text: "Take the supplies"
        target: garden

      - text: "Follow the map to the secret passage"
        target: secret_passage

  - id: treasury_trapped
    title: "A Painful Lesson"
    description: |
      You trigger a pressure plate! Poison darts fly from the walls, and several find their mark. You stumble backward, weakened but alive.

      The passage ahead remains, but you'll need to be more careful.
    exits:
      - text: "Try again, more carefully"
        gate:
          text: "You attempt to spot the remaining traps. Roll Investigation."
          short_text: "Investigation"
          show_short: true
          dc: 13
          failure_target: treasury_trapped
        target: treasury

      - text: "Go back"
        target: secret_passage

  - id: throne_trapped
    title: "The Throne's Wrath"
    description: |
      The throne erupts with arcane energy! You're thrown backward, the magical wards rejecting your presence.

      As you recover, you notice the magic has revealed a hidden compartment in the throne's base.
    add_items:
      - id: warriors_blessing
        amount: 1
        text: "A battle-prayer etched into the compartment grants you a Warrior's Blessing (+5)."
    exits:
      - text: "Check the compartment"
        target: royal_chambers

      - text: "Try a different approach"
        target: main_hall

  - id: throne_room
    title: "The Throne's Secret"
    description: |
      You sense the ancient wards and step carefully around them. The throne itself is a masterwork of ancient craftsmanship, and behind it, you find a hidden lever.

      The lever reveals a passage leading directly to what must be the royal treasury.
    exits:
      - text: "Enter the treasury"
        target: treasury

      - text: "Search the throne room"
        target: royal_chambers

  - id: royal_chambers
    title: "The Royal Chambers"
    description: |
      Luxurious tapestries and fine furniture fill this room, remarkably preserved. A four-poster bed dominates one wall, and a writing desk sits by the window.

      In a drawer, you find the royal seal and several ancient coins. A secret door in the wardrobe leads to a private treasury.
    exits:
      - text: "Enter the private treasury"
        target: treasury

      - text: "Return to the main hall"
        target: main_hall

  - id: ritual_room
    title: "The Ritual Chamber"
    description: |
      Dark candles burn in a circle around an ancient altar. Strange symbols cover the floor, and you can feel the air thrumming with magical energy.

      A robed figure stands at the altar, chanting in an unknown tongue. They haven't noticed you yet.
    exits:
      - text: "Attack the figure"
        color: red
        gate:
          text: "You charge forward! Roll Initiative (Dexterity)."
          short_text: "Initiative"
          show_short: true
          dc: 14
          failure_target: ritual_fight
        target: ritual_victory

      - text: "Sneak past"
        gate:
          text: "You try to slip by unnoticed. Roll Stealth."
          short_text: "Stealth"
          show_short: true
          dc: 15
          failure_target: ritual_fight
        target: secret_passage

      - text: "Retreat quietly"
        target: main_hall

  - id: ritual_fight
    title: "Battle in the Chamber"
    description: |
      The figure spins around, revealing a skeletal face beneath the hood! The undead cultist raises a dagger dripping with dark ichor.

      After a fierce battle, you emerge victorious, but not unscathed. The ritual has been interrupted, and the magical energy dissipates.
    exits:
      - text: "Search the chamber"
        target: ritual_victory

      - text: "Flee the scene"
        target: secret_passage

  - id: ritual_victory
    title: "The Cultist's Hoard"
    description: |
      Among the cultist's belongings, you find valuable gems and a strange amulet that seems to pulse with protective magic.

      A passage behind the altar leads to an underground river, while another door leads back to the citadel proper.
    add_items:
      - id: fate_bead
        amount: 1
        text: "You claim a Fate Bead that can add +4 after a roll is revealed."
    exits:
      - text: "Take the underground passage"
        target: underground

      - text: "Return to the main hall"
        target: main_hall

  - id: chest_open
    title: "Treasure Found!"
    description: |
      The chest opens to reveal a fortune in ancient coins and a beautifully crafted sword. This cache alone would make your journey worthwhile.

      But something tells you greater treasures lie deeper in the citadel.
    exits:
      - text: "Continue exploring"
        target: underground

  - id: chest_trapped
    title: "Poisoned!"
    description: |
      A needle pricks your finger, and you feel the poison burning through your veins. You manage to break the lock and open the chest, taking what you can before the poison takes effect.

      You'll need to find healing soon.
    exits:
      - text: "Seek healing"
        target: underground

  - id: hidden_ledge
    title: "The Smuggler's Ledge"
    description: |
      The map guides you to a narrow ledge above the river where smugglers once hauled contraband through a crack in the stone. A rotted pulley, a few old crates, and a leather purse remain.

      From here you can lower yourself into the treasure cave or retreat before the footing gives way.
    add_items:
      - id: gold_coin
        amount: 10
        text: "You recover 10 gold coins from a smuggler's purse."
    exits:
      - text: "Climb down to the treasure cave"
        target: treasure_cave

      - text: "Retreat to the river path"
        target: underground

  - id: escape_rich
    title: "A Fortune Escaped"
    description: |
      You stuff your pockets with gold and gems, deciding to leave the more dangerous treasures behind. A wise choice—for now.

      As you exit the treasury, you feel the citadel's eyes upon you. Perhaps one day you'll return to claim what remains.
    exits: []

  - id: treasury_defeat
    title: "The Spectral Guardian"
    description: |
      The spectral guardian overwhelms you with its presence! You're forced to retreat, but the experience has taught you much about the citadel's defenses.

      Perhaps you need more preparation before facing such powerful guardians again.
    exits:
      - text: "Retreat to reconsider"
        target: secret_passage

      - text: "Try again with determination"
        gate:
          text: "You steel yourself against the guardian. Roll Constitution with advantage."
          short_text: "Constitution"
          show_short: true
          dc: 14
          failure_target: treasury_defeat
        target: victory
`;

const YAML_DOCUMENTATION_MD = String.raw`# YAML Syntax Documentation

Use this schema to build adventures for Offsession. The root object accepts four top-level keys: ` + '`meta`' + String.raw`, ` + '`counters`' + String.raw`, ` + '`inventory`' + String.raw`, and ` + '`scenes`' + String.raw`.

## meta

Required. Defines adventure metadata.

~~~yaml
meta:
  title: "Your Adventure Title"
  description: "A brief description"
  theme: "neon-mana-circuit"
  one_shot: true
~~~

- ` + '`title`' + String.raw` is required.
- ` + '`description`' + String.raw` is optional.
- ` + '`theme`' + String.raw` must be one of: ` + 'neon-mana-circuit, sol-arcana-ledger, prism-spark-sanctuary, mana-punk, gilded-relic' + String.raw`
- ` + '`one_shot`' + String.raw` defaults to ` + '`true`' + String.raw`. Set it to ` + '`false`' + String.raw` to allow multiple sessions.

## counters

Optional hidden state for branching logic.

~~~yaml
counters:
  guard_alerted:
    type: "boolean"
    default: false
  treasure_count:
    type: "number"
    default: 0
~~~

Counter types must be ` + '`number`' + String.raw` or ` + '`boolean`' + String.raw`.

## inventory

Optional player items, currencies, rerolls, and bonuses.

~~~yaml
inventory:
  gold_coin:
    name: "Gold Coins"
    description: "Currency for trading"
    type: "currency"
    default: 25

  torch:
    name: "Torch"
    description: "A basic light source"
    type: "item"
    icon: "torch"
    color: "amber"
    image: "https://example.com/torch.png"
    default: 1

  lucky_charm:
    name: "Lucky Charm"
    description: "Reroll a failed check"
    type: "reroll"
    usage_count: 2
    default: 1

  warrior_blessing:
    name: "Warrior's Blessing"
    description: "Add bonus to roll"
    type: "bonus"
    value: "5"
    bonus_timing: "both"
    default: 2
~~~

Valid types: ` + 'currency, item, reroll, bonus' + String.raw`

Supported inventory fields:

- ` + '`name`' + String.raw` and ` + '`description`' + String.raw` are required.
- ` + '`image`' + String.raw` is optional.
- ` + '`icon`' + String.raw` is optional and accepts an RPG Awesome icon name such as ` + '`torch`' + String.raw` or ` + '`ra-torch`' + String.raw`.
- ` + '`color`' + String.raw` is optional and must be one of ` + '`red`' + String.raw`, ` + '`green`' + String.raw`, ` + '`blue`' + String.raw`, ` + '`purple`' + String.raw`, ` + '`gold`' + String.raw`, ` + '`yellow`' + String.raw`, ` + '`cyan`' + String.raw`, ` + '`orange`' + String.raw`, ` + '`pink`' + String.raw`, ` + '`white`' + String.raw`, ` + '`emerald`' + String.raw`, or ` + '`amber`' + String.raw`.
- ` + '`default`' + String.raw` sets the starting amount.
- ` + '`usage_count`' + String.raw` gives a non-currency item multiple charges before it disappears.
- ` + '`value`' + String.raw` is required for ` + '`bonus`' + String.raw` items.
- ` + '`bonus_timing`' + String.raw` is only used by ` + '`bonus`' + String.raw` items and must be ` + '`before`' + String.raw`, ` + '`after`' + String.raw`, or ` + '`both`' + String.raw`. Missing timing defaults to ` + '`both`' + String.raw`.

## scenes

Required. The first playable scene must be ` + '`id: start`' + String.raw`.

~~~yaml
scenes:
  - id: start
    title: "The Beginning"
    description: |
      You stand at the entrance...

      Multiple paragraphs are supported.
    icon: "castle-emblem"
    image: "https://example.com/scene.png"
    exits:
      - text: "Go north"
        target: forest

      - text: "Pick the lock"
        target: treasure_room
        gate:
          text: "Roll Dexterity to pick the lock."
          short_text: "Dexterity"
          show_short: true
          dc: 12
          failure_target: jail
        one_time: true

      - text: "Open door"
        target: secret_room
        requires_item:
          id: ancient_key
          amount: 1
~~~

Scene fields:

- ` + '`id`' + String.raw`, ` + '`title`' + String.raw`, ` + '`description`' + String.raw`, and ` + '`exits`' + String.raw` are required.
- ` + '`image`' + String.raw`, ` + '`icon`' + String.raw`, ` + '`add_items`' + String.raw`, and ` + '`remove_items`' + String.raw` are optional.
- Ending scenes should use ` + '`exits: []`' + String.raw`.

## RPG Awesome icon ids

` + RPG_AWESOME_ICON_IDS_TEXT + String.raw`

## gates

Use gates for dice checks.

- ` + '`text`' + String.raw`: message shown in the dice modal
- ` + '`short_text`' + String.raw`: compact label on the exit button
- ` + '`show_short`' + String.raw`: show the compact label when ` + '`true`' + String.raw`
- ` + '`dc`' + String.raw`: difficulty class to beat
- ` + '`failure_target`' + String.raw`: scene to visit after a failed roll

Players roll against the DC. Success goes to ` + '`target`' + String.raw`; failure goes to ` + '`failure_target`' + String.raw`.

Natural 20 on the kept d20 is always a success. Natural 1 on the kept d20 is always a failure. On a critical failure, only reroll items can still change the outcome.

## exits

~~~yaml
# One-time exit
- text: "Search the chest"
  target: found_treasure
  one_time: true

# Item-required exit
- text: "Use key on door"
  target: secret_room
  requires_item:
    id: ancient_key
    amount: 1

# Colored exit
- text: "FLEE!"
  target: escape
  color: red
~~~

Valid colors: ` + 'red, green, blue, purple, gold, yellow, cyan, orange, pink, white' + String.raw`

## exit effects

Use ` + '`effects`' + String.raw` on an exit when choosing that path should update state immediately.

~~~yaml
exits:
  - text: "Pull the hidden lever"
    target: vault
    effects:
      set_counter:
        found_secret: 1

  - text: "Take the key and run"
    target: hallway
    effects:
      add_item: ancient_key

  - text: "Burn the forged pass"
    target: checkpoint
    effects:
      remove_item: forged_pass

  - text: "Pay the ferryman"
    target: river
    effects:
      add_currency:
        gold_coin: -10
~~~

- ` + '`set_counter`' + String.raw` sets one or more counters. Values must match the counter type.
- ` + '`add_item`' + String.raw` adds a single inventory item.
- ` + '`remove_item`' + String.raw` removes a single inventory item.
- ` + '`add_currency`' + String.raw` adjusts currency totals. Use a negative number to spend currency.

## scene item changes

Use ` + '`add_items`' + String.raw` and ` + '`remove_items`' + String.raw` when the state should change on entering a scene instead of choosing an exit.

~~~yaml
scenes:
  - id: treasure_room
    title: "Treasure Chamber"
    description: "You find a treasure chest!"
    add_items:
      - id: gold_coin
        amount: 50
        text: "You found 50 gold coins!"
    remove_items:
      - id: torch
        amount: 1
        text: "Your torch burns out."
    exits:
      - text: "Leave"
        target: hallway
~~~

` + '`amount`' + String.raw` must be a positive integer in both lists.

## conditional exits

Use ` + '`visible_if`' + String.raw` to hide an exit until a condition is met.

~~~yaml
exits:
  - text: "Open secret door"
    target: secret_passage
    visible_if:
      counter: found_key
      equals: 1

  - text: "Use membership card"
    target: vip_area
    visible_if:
      item: vip_pass
      has_item: true

  - text: "Bribe the guard"
    target: inside
    visible_if:
      currency: gold_coin
      greater_or_equal: 50
~~~

Supported operators: ` + 'equals, not_equals, greater_than, less_than, greater_or_equal, less_or_equal, has_item' + String.raw`

Rules for ` + '`visible_if`' + String.raw`:

- Define exactly one subject: ` + '`counter`' + String.raw`, ` + '`item`' + String.raw`, or ` + '`currency`' + String.raw`.
- Use one comparison operator per condition block for predictable behavior.
- ` + '`item`' + String.raw` and ` + '`currency`' + String.raw` conditions check the current inventory amount.

## Best Practices

- Always include a scene with ` + '`id: start`' + String.raw`
- End scenes should use ` + '`exits: []`' + String.raw`
- Use markdown in scene descriptions
- Validate every branch before sharing the adventure
- Give each gate a ` + '`failure_target`' + String.raw` to avoid soft-locks
- Prefer ` + '`scene.add_items`' + String.raw` for rewards with player-facing text, and ` + '`exit.effects`' + String.raw` for silent state changes
`;

const LOCAL_STORAGE_KEY = 'offsession_my_adventures';
const BUILD_TIMESTAMP = process.env.NEXT_PUBLIC_BUILD_TIMESTAMP ?? 'unknown-build-time';

function getBuildTimestampFromJs(): string {
  return process.env.NEXT_PUBLIC_BUILD_TIMESTAMP ?? 'unknown-build-time';
}

function FooterVersion({ label }: { label: string }) {
  return (
    <>
      <div>{label}</div>
      <div className="mt-1 opacity-80">HTML build: {BUILD_TIMESTAMP}</div>
      <div className="opacity-80">JS build: {getBuildTimestampFromJs()}</div>
    </>
  );
}

export default function OffsessionApp() {
  // View state
  const [view, setView] = useState<'list' | 'create' | 'play' | 'dm'>('list');
  const [storedAdventures, setStoredAdventures] = useState<StoredAdventure[]>([]);
  const [selectedAdventure, setSelectedAdventure] = useState<Adventure | null>(null);
  
  // Game state
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Modal states
  const [diceModal, setDiceModal] = useState<{
    open: boolean;
    exitIndex: number;
    exitText: string;
    gateText: string;
    dc: number;
    dicePool: { sides: number; count: number }[]; // Changed from single notation to pool
    customExpression: string; // For manual editing
    isEditing: boolean;
    modifier: number;
    advantage: 'none' | 'advantage' | 'disadvantage';
    isRolling: boolean;
    result?: DiceResult;
    afterBonusRevealResult?: DiceResult;
    afterBonusRevealItemId?: string;
    selectedPreRollBonusItemId?: string;
    showReroll: boolean;
    notice?: string;
    pendingResolution?: boolean;
  } | null>(null);
  
  const [loadingExitIndex, setLoadingExitIndex] = useState<number | null>(null);
  
  const [dmLoginModal, setDmLoginModal] = useState(false);
  const [dmPassword, setDmPassword] = useState('');
  const [dmData, setDmData] = useState<{
    adventure: { id: string; title: string; theme: string; yamlContent: string };
    gameStates: DmSessionSummary[];
    scenes: { id: string; title: string }[];
  } | null>(null);
  const [dmSessionDetail, setDmSessionDetail] = useState<DmSessionDetail | null>(null);
  
  // Create adventure state
  const [yamlContent, setYamlContent] = useState(DEFAULT_YAML);
  const [dmPasswordCreate, setDmPasswordCreate] = useState('');
  const [playerPasswordCreate, setPlayerPasswordCreate] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [yamlValidationReport, setYamlValidationReport] = useState<AdventureValidationReport | null>(null);
  const [isValidatingYaml, setIsValidatingYaml] = useState(false);
  const [createSuccess, setCreateSuccess] = useState<{ id: string; title: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  
  // Adventure link handling
  const [pendingAdventureId, setPendingAdventureId] = useState<string | null>(null);
  const [pendingAdventureInfo, setPendingAdventureInfo] = useState<{
    id: string;
    title: string;
    theme: string;
    description?: string;
    requiresPlayerPassword: boolean;
  } | null>(null);
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const [pendingAdventureMode, setPendingAdventureMode] = useState<'start' | 'resume'>('start');
  const [pendingLinkView, setPendingLinkView] = useState<'play' | 'dm'>('play');
  const [startAdventurePassword, setStartAdventurePassword] = useState('');
  const [startAdventureError, setStartAdventureError] = useState<string | null>(null);
  const activeDiceResult = diceModal?.result;
  const selectedPreRollBonusItem = diceModal?.selectedPreRollBonusItemId && gameData
    ? gameData.inventory[diceModal.selectedPreRollBonusItemId]
    : undefined;
  const appliedPreRollBonusName = activeDiceResult?.bonusStage === 'before'
    ? activeDiceResult.bonusItemName ?? (activeDiceResult.bonusItemId && gameData ? gameData.inventory[activeDiceResult.bonusItemId]?.name : undefined)
    : undefined;

  // Load adventures on mount
  useEffect(() => {
    loadStoredAdventures();
    
    // Check for adventure URL parameter
    const params = new URLSearchParams(window.location.search);
    const adventureId = params.get('adventure');
    const linkView = params.get('view');
    if (adventureId) {
      handleAdventureLink(adventureId, linkView === 'dm' ? 'dm' : 'play');
    }
  }, []);

  useEffect(() => {
    setYamlValidationReport(null);
  }, [yamlContent]);

  const setActiveAdventure = (adventure: { id: string; title: string; theme: string }, createdAt?: string) => {
    setSelectedAdventure({
      id: adventure.id,
      title: adventure.title,
      theme: adventure.theme,
      createdAt: createdAt
        ?? storedAdventures.find(stored => stored.id === adventure.id)?.createdAt
        ?? new Date().toISOString(),
    });
  };

  const getStoredAdventuresSnapshot = (): StoredAdventure[] => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!stored) {
        return [];
      }

      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.error('Failed to read stored adventures:', err);
      return [];
    }
  };

  const prepareAdventureStart = async (adventureId: string, forceNewSession: boolean = false) => {
    const stored = getStoredAdventuresSnapshot().find(a => a.id === adventureId);

    try {
      const res = await fetch(`/api/adventures/${adventureId}`);
      if (res.ok) {
        const data = await res.json();

        setActiveAdventure(data.adventure, stored?.createdAt);

        if (!forceNewSession && stored?.sessionId && !stored.completed && !data.adventure.requiresPlayerPassword) {
          await resumeAdventure(adventureId, stored.sessionId);
          return;
        }

        setPendingAdventureId(adventureId);
        setPendingAdventureInfo(data.adventure);
        setPendingSessionId(!forceNewSession && stored?.sessionId && !stored.completed ? stored.sessionId : null);
        setPendingAdventureMode(!forceNewSession && stored?.sessionId && !stored.completed ? 'resume' : 'start');
        setStartAdventurePassword('');
        setStartAdventureError(null);
        setView('play');
      } else {
        console.error('Adventure not found');
      }
    } catch (err) {
      console.error('Failed to fetch adventure:', err);
    }
  };

  const handleAdventureDmLink = async (adventureId: string) => {
    try {
      const res = await fetch(`/api/adventures/${adventureId}`);
      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Adventure not found');
      }

      setActiveAdventure(data.adventure);
      setPendingAdventureId(null);
      setPendingAdventureInfo(null);
      setPendingSessionId(null);
      setPendingAdventureMode('start');
      setPendingLinkView('dm');
      setStartAdventurePassword('');
      setStartAdventureError(null);
      setValidationErrors([]);
      setDmPassword('');
      setDmLoginModal(true);
      setView('list');
    } catch (err) {
      console.error('Failed to open DM dashboard link:', err);
      setValidationErrors(['Failed to open DM dashboard']);
      setView('list');
    }
  };

  const handleAdventureLink = async (adventureId: string, linkView: 'play' | 'dm' = 'play') => {
    setPendingLinkView(linkView);

    if (linkView === 'dm') {
      await handleAdventureDmLink(adventureId);
      return;
    }

    await prepareAdventureStart(adventureId);
  };

  const resumeAdventure = async (adventureId: string, sessionId: string, playerPassword?: string) => {
    setIsLoading(true);
    try {
      const query = playerPassword ? `?playerPassword=${encodeURIComponent(playerPassword)}` : '';
      const res = await fetch(`/api/game/${sessionId}${query}`);
      const data = await res.json();

      if (res.ok) {
        setGameData({ sessionId, ...data });
        setActiveAdventure(
          { id: adventureId, title: data.meta?.title || 'Adventure', theme: data.meta?.theme || 'neon-mana-circuit' },
        );
        setPendingSessionId(null);
        setPendingAdventureMode('start');
        setStartAdventureError(null);
        setView('play');
        return true;
      } else {
        if (res.status === 401) {
          setStartAdventureError(data.error || 'Player password required');
          return false;
        }

        // Session not found, start fresh
        await prepareAdventureStart(adventureId, true);
        return false;
      }
    } catch (err) {
      console.error('Failed to resume adventure:', err);
      setStartAdventureError('Failed to resume adventure');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const confirmStartAdventure = async () => {
    if (!pendingAdventureId) return;
    const didStart = pendingAdventureMode === 'resume' && pendingSessionId
      ? await resumeAdventure(pendingAdventureId, pendingSessionId, startAdventurePassword)
      : await startAdventure(pendingAdventureId, startAdventurePassword);

    if (didStart) {
      setPendingAdventureId(null);
      setPendingAdventureInfo(null);
      setPendingSessionId(null);
      setPendingAdventureMode('start');
      setPendingLinkView('play');
      setStartAdventurePassword('');
      setStartAdventureError(null);
    }
  };

  const loadStoredAdventures = () => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        setStoredAdventures(JSON.parse(stored));
      }
    } catch (err) {
      console.error('Failed to load stored adventures:', err);
    }
  };

  const saveAdventureToStorage = (adventure: { id: string; title: string; theme: string }, sessionId?: string, completed?: boolean) => {
    const existing = storedAdventures.find(a => a.id === adventure.id);
    const stored: StoredAdventure = {
      id: adventure.id,
      title: adventure.title,
      theme: adventure.theme,
      createdAt: existing?.createdAt || new Date().toISOString(),
      completed: completed ?? existing?.completed ?? false,
      sessionId: sessionId ?? existing?.sessionId,
    };
    
    const updated = [stored, ...storedAdventures.filter(a => a.id !== adventure.id)];
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    setStoredAdventures(updated);
  };

  const removeFromStorage = (adventureId: string) => {
    const updated = storedAdventures.filter(a => a.id !== adventureId);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    setStoredAdventures(updated);
  };

  const copyAdventureLink = (adventureId: string) => {
    const url = `${window.location.origin}/?adventure=${adventureId}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const downloadYamlDocumentation = () => {
    const file = new Blob([YAML_DOCUMENTATION_MD], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(file);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'Offsession-yaml-syntax-documentation.md';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const startAdventure = async (adventureId: string, playerPassword?: string) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adventureId, playerPassword }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      setGameData(data);
      setActiveAdventure(
        { id: adventureId, title: data.meta?.title || 'Adventure', theme: data.meta?.theme || 'neon-mana-circuit' },
      );
      setStartAdventureError(null);
      saveAdventureToStorage(
        { id: adventureId, title: data.meta?.title || 'Adventure', theme: data.meta?.theme || 'neon-mana-circuit' },
        data.sessionId,
        data.state?.completed
      );
      setView('play');
      return true;
    } catch (err) {
      console.error('Failed to start adventure:', err);
      setStartAdventureError(err instanceof Error ? err.message : 'Failed to start adventure');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleExitAction = async (
    exitIndex: number,
    exitText?: string,
    diceNotation?: string,
    options?: { bonusValue?: string | number; itemId?: string; bonusStage?: 'before' | 'after' }
  ) => {
    if (!gameData) return;
    
    setLoadingExitIndex(exitIndex);
    try {
      const res = await fetch(`/api/game/${gameData.sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'use_exit', 
          exitIndex, 
          diceNotation,
          bonusValue: options?.bonusValue,
          itemId: options?.itemId,
          bonusStage: options?.bonusStage,
        }),
      });
      const data = await res.json();
      
      if (data.requiresDice) {
        setDiceModal({
          open: true,
          exitIndex,
          exitText: exitText || gameData.scene.exits.find(exit => exit.exitIndex === exitIndex)?.text || 'Unknown option',
          gateText: data.gate.text,
          dc: data.gate.dc,
          dicePool: [{ sides: 20, count: 1 }], // Default: 1d20
          customExpression: '',
          isEditing: false,
          modifier: 0,
          advantage: 'none',
          isRolling: false,
          result: undefined,
          afterBonusRevealResult: undefined,
          afterBonusRevealItemId: undefined,
          selectedPreRollBonusItemId: undefined,
          showReroll: false,
          notice: undefined,
          pendingResolution: false,
        });
        setLoadingExitIndex(null);
        return;
      }
      
      if (data.error) throw new Error(data.error);
      
      setGameData(prev => prev ? { ...prev, ...data } : null);
      
      // Update storage with completion status
      if (data.state?.completed && selectedAdventure) {
        saveAdventureToStorage(selectedAdventure, gameData.sessionId, true);
      }
      
      if (data.diceResult) {
        const isAfterBonusCommit = options?.bonusStage === 'after' && !!options?.itemId;

        setDiceModal(prev => prev ? {
          ...prev,
          result: isAfterBonusCommit ? prev.result : data.diceResult,
          afterBonusRevealResult: isAfterBonusCommit ? data.diceResult : undefined,
          afterBonusRevealItemId: isAfterBonusCommit ? options?.itemId : undefined,
          selectedPreRollBonusItemId: undefined,
          showReroll: !isAfterBonusCommit && !data.diceResult.success && !!data.pendingGate,
          isRolling: false,
          notice: undefined,
          pendingResolution: !isAfterBonusCommit && !!data.pendingGate,
        } : null);
      } else if (data.state?.pendingGate === null) {
        setDiceModal(null);
      }
    } catch (err) {
      console.error('Failed to use exit:', err);
    } finally {
      setLoadingExitIndex(null);
    }
  };

  // Build dice notation from pool
  const buildDiceNotation = (pool: { sides: number; count: number }[], modifier: number = 0, advantage: 'none' | 'advantage' | 'disadvantage' = 'none'): string => {
    if (pool.length === 0) return '1d20';
    
    const parts: string[] = [];
    
    // Sort pool by sides (d4, d6, d8, etc.)
    const sortedPool = [...pool].sort((a, b) => a.sides - b.sides);
    
    for (const dice of sortedPool) {
      if (dice.count > 0) {
        // Apply advantage/disadvantage only to d20
        if (dice.sides === 20 && advantage !== 'none') {
          if (advantage === 'advantage') {
            parts.push(`2d20kh1`);
          } else {
            parts.push(`2d20kl1`);
          }
        } else {
          parts.push(`${dice.count}d${dice.sides}`);
        }
      }
    }
    
    let notation = parts.join(' + ');
    
    if (modifier !== 0) {
      const modSign = modifier >= 0 ? '+' : '-';
      notation = `${notation} ${modSign} ${Math.abs(modifier)}`;
    }
    
    return notation || '1d20';
  };

  // Add or increment dice in pool
  const addDiceToPool = (sides: number) => {
    if (!diceModal) return;
    const pool = [...diceModal.dicePool];
    const existing = pool.find(d => d.sides === sides);
    if (existing) {
      existing.count += 1;
    } else {
      pool.push({ sides, count: 1 });
    }
    setDiceModal(prev => prev ? { ...prev, dicePool: pool, customExpression: '' } : null);
  };

  // Remove or decrement dice from pool
  const removeDiceFromPool = (sides: number) => {
    if (!diceModal) return;
    const pool = [...diceModal.dicePool];
    const existing = pool.find(d => d.sides === sides);
    if (existing) {
      existing.count -= 1;
      if (existing.count <= 0) {
        const idx = pool.findIndex(d => d.sides === sides);
        pool.splice(idx, 1);
      }
    }
    setDiceModal(prev => prev ? { ...prev, dicePool: pool, customExpression: '' } : null);
  };

  // Get count for a specific dice type
  const getDiceCount = (sides: number): number => {
    if (!diceModal) return 0;
    return diceModal.dicePool.find(d => d.sides === sides)?.count || 0;
  };

  const getDiceModalNotation = () => {
    if (!diceModal) return '1d20';

    if (diceModal.isEditing && diceModal.customExpression) {
      return diceModal.customExpression.toLowerCase().trim();
    }

    return buildDiceNotation(diceModal.dicePool, diceModal.modifier, diceModal.advantage);
  };

  const rollDice = async () => {
    if (!diceModal) return;
    
    // Build notation from pool or use custom expression
    let notation = getDiceModalNotation();
    
    if (!notation.match(/^[\d\w\s+\-khlon]+$/)) {
      notation = '1d20';
    }

    const selectedBonusItemId = diceModal.selectedPreRollBonusItemId;
    const selectedBonusItem = selectedBonusItemId && gameData ? gameData.inventory[selectedBonusItemId] : undefined;
    const selectedBonusValue = selectedBonusItem?.value;
    
    // Show rolling animation
    setDiceModal(prev => prev ? { ...prev, isRolling: true } : null);
    
    // Small delay for animation effect
    await new Promise(resolve => setTimeout(resolve, 500));
    
    handleExitAction(diceModal.exitIndex, diceModal.exitText, notation, selectedBonusItemId && selectedBonusItem ? {
      bonusValue: selectedBonusValue,
      itemId: selectedBonusItemId,
      bonusStage: 'before',
    } : undefined);
  };
  
  const addModifier = (amount: number) => {
    if (!diceModal) return;
    setDiceModal(prev => prev ? { ...prev, modifier: (prev.modifier || 0) + amount } : null);
  };
  
  const cycleAdvantage = () => {
    if (!diceModal) return;
    const next = diceModal.advantage === 'none' ? 'advantage' : diceModal.advantage === 'advantage' ? 'disadvantage' : 'none';
    setDiceModal(prev => prev ? { ...prev, advantage: next } : null);
  };

  const rerollDice = async (itemId: string) => {
    if (!diceModal || !gameData) return;

    setIsLoading(true);
    try {
      const res = await fetch(`/api/game/${gameData.sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'use_item', itemId }),
      });
      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setGameData(prev => prev ? { ...prev, state: { ...prev.state, ...data.state } } : null);
      setDiceModal(prev => prev ? {
        ...prev,
        isRolling: false,
        result: undefined,
        afterBonusRevealResult: undefined,
        afterBonusRevealItemId: undefined,
        selectedPreRollBonusItemId: undefined,
        showReroll: false,
        notice: 'Reroll prepared. Build your second roll.',
        pendingResolution: true,
      } : null);

      toast({
        title: 'Reroll ready',
        description: 'Build your second roll for this check.',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to prepare reroll';
      console.error('Failed to prepare reroll:', err);
      toast({
        title: 'Reroll unavailable',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const togglePreRollBonus = (itemId: string) => {
    if (!diceModal || !gameData) return;

    const item = gameData.inventory[itemId];
    if (!item || item.type !== 'bonus') return;

    setDiceModal(prev => prev ? {
      ...prev,
      selectedPreRollBonusItemId: prev.selectedPreRollBonusItemId === itemId ? undefined : itemId,
    } : null);
  };

  const applyPostRollBonus = async (itemId: string) => {
    if (!diceModal?.result || !gameData) return;

    const item = gameData.inventory[itemId];
    if (!item || item.type !== 'bonus') return;

    setIsLoading(true);
    try {
      await handleExitAction(diceModal.exitIndex, diceModal.exitText, undefined, {
        bonusValue: item.value,
        itemId,
        bonusStage: 'after',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const continueFromDiceModal = async () => {
    if (!diceModal) return;

    if (!diceModal.pendingResolution || !gameData?.state.pendingGate) {
      setDiceModal(null);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/game/${gameData.sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve_pending_gate' }),
      });
      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setGameData(prev => prev ? { ...prev, ...data } : null);
      setDiceModal(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to continue';
      console.error('Failed to resolve pending gate:', err);
      toast({
        title: 'Unable to continue',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAdventure = async () => {
    setIsLoading(true);
    setValidationErrors([]);
    setCreateSuccess(null);
    const normalizedPlayerPassword = playerPasswordCreate.trim();
    
    try {
      const res = await fetch('/api/adventures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          yamlContent,
          adminPassword: dmPasswordCreate,
          playerPassword: normalizedPlayerPassword,
        }),
      });
      const data = await res.json();
      
      if (data.error) {
        if (data.details) {
          setValidationErrors(data.details);
        } else {
          setValidationErrors([data.error]);
        }
        return;
      }
      
      setCreateSuccess({ id: data.adventure.id, title: data.adventure.title });
      saveAdventureToStorage(data.adventure);
    } catch (err) {
      setValidationErrors(['Failed to create adventure']);
    } finally {
      setIsLoading(false);
    }
  };

  const handleValidateAdventure = async () => {
    setIsValidatingYaml(true);
    setValidationErrors([]);
    setCreateSuccess(null);

    try {
      const res = await fetch('/api/adventures/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yamlContent }),
      });
      const data = await res.json();

      if (!res.ok) {
        setYamlValidationReport(null);
        setValidationErrors([data.error || 'Failed to validate adventure']);
        return;
      }

      setYamlValidationReport(data);
    } catch (err) {
      setYamlValidationReport(null);
      setValidationErrors(['Failed to validate adventure']);
    } finally {
      setIsValidatingYaml(false);
    }
  };

  const handleDmLogin = async () => {
    if (!selectedAdventure) return;
    
    setIsLoading(true);
    try {
      const res = await fetch(`/api/adventures/${selectedAdventure.id}/dm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: dmPassword }),
      });
      const data = await res.json();
      
      if (data.error) {
        setValidationErrors([data.error]);
        return;
      }
      
      setDmData(data);
      setDmSessionDetail(null);
      setDmLoginModal(false);
      setView('dm');
    } catch (err) {
      setValidationErrors(['Failed to authenticate']);
    } finally {
      setIsLoading(false);
    }
  };

  const openDmLoginFromGame = () => {
    if (!selectedAdventure) return;

    setValidationErrors([]);
    setDmPassword('');
    setDmLoginModal(true);
  };

  const renderDmAccessButton = (className?: string) => (
    <Button
      onClick={openDmLoginFromGame}
      variant="outline"
      className={className}
      disabled={isLoading || !selectedAdventure}
    >
      <Lock className="w-4 h-4 mr-2" />
      DM Access
    </Button>
  );

  const getBonusTimingLabel = (item: InventoryItem) => {
    if (item.type !== 'bonus') return null;

    if (item.bonus_timing === 'before') return 'Before Roll';
    if (item.bonus_timing === 'after') return 'After Roll';
    return 'Before / After';
  };

  const renderInventoryTooltipContent = (item: InventoryItem, count: number) => {
    const bonusTimingLabel = item.type === 'bonus' ? getBonusTimingLabel(item) : null;
    const shouldShowCount = item.type === 'currency' || count > 1;

    return (
      <TooltipContent
        side="top"
        className="max-w-64 border-[var(--theme-border)] bg-[var(--theme-card)] px-3 py-2 text-[var(--theme-text)] shadow-[0_12px_32px_rgba(0,0,0,0.35)]"
      >
        <div className="space-y-2">
          <div>
            <div className="tooltip-item-name">{item.name}</div>
            <div className="tooltip-item-desc">{item.description}</div>
          </div>
          <div className="flex flex-wrap gap-1">
            {shouldShowCount && (
              <Badge className="bg-amber-950 text-amber-300">x{count}</Badge>
            )}
            {item.type === 'reroll' && (
              <Badge className="bg-emerald-900 text-emerald-300">Reroll</Badge>
            )}
            {item.type === 'bonus' && item.value && (
              <Badge className="bg-blue-900 text-blue-300">+{item.value}</Badge>
            )}
            {item.type === 'bonus' && bonusTimingLabel && (
              <Badge className="bg-sky-950 text-sky-300">{bonusTimingLabel}</Badge>
            )}
          </div>
        </div>
      </TooltipContent>
    );
  };

  const renderInventoryTile = (itemId: string, item: InventoryItem | undefined, count: number) => {
    if (!item || count <= 0) return null;

    const itemColor = getNamedColorStyle(item.color);
    const shouldShowCount = item.type === 'currency' || count > 1;

    return (
      <Tooltip key={itemId}>
        <TooltipTrigger asChild>
          <div
            className="inventory-slot"
            aria-label={`${item.name}${shouldShowCount ? ` x${count}` : ''}`}
            style={itemColor ? {
              background: itemColor.bg,
              borderColor: itemColor.border,
              boxShadow: `0 0 10px ${itemColor.shadow}`,
            } : undefined}
          >
            {item.image ? (
              <img src={item.image} alt={item.name} />
            ) : item.icon ? (
              renderRpgAwesomeIcon(item.icon, item.name, undefined, itemColor ? { color: itemColor.text } : undefined)
            ) : (
              <Package className="w-7 h-7" style={itemColor ? { color: itemColor.text } : { color: 'var(--theme-accent)' }} />
            )}
            {shouldShowCount && (
              <span className="currency-count">{count}</span>
            )}
          </div>
        </TooltipTrigger>
        {renderInventoryTooltipContent(item, count)}
      </Tooltip>
    );
  };

  const renderInventoryPanel = (inventoryMap: Record<string, InventoryItem>, entries: Array<[string, number]>) => {
    const visibleEntries = entries.filter(([itemId, count]) => count > 0 && inventoryMap[itemId]);
    if (visibleEntries.length === 0) {
      return null;
    }

    return (
      <div className="flex justify-center">
        <div className="w-full max-w-sm pixel-border bg-[var(--theme-card)] p-3">
          <TooltipProvider>
            <div className="inventory-grid justify-center">
              {visibleEntries.map(([itemId, count]) => renderInventoryTile(itemId, inventoryMap[itemId], count))}
            </div>
          </TooltipProvider>
        </div>
      </div>
    );
  };

  const getRollOutcomeLabel = (result: DiceResult) => {
    if (result.critical === 'success') return 'CRITICAL SUCCESS';
    if (result.critical === 'failure') return 'CRITICAL FAILURE';
    return result.success ? 'SUCCESS' : 'FAILURE';
  };

  const renderRollBreakdown = (result?: DiceResult | null) => {
    if (!result) {
      return null;
    }

    if (!result.rollSegments?.length) {
      return (
        <>
          {result.rolls.join(' + ')}
          {result.modifier !== 0 && ` + ${result.modifier}`}
        </>
      );
    }

    const tokens: React.ReactNode[] = [];
    let tokenIndex = 0;

    for (const [segmentIndex, segment] of result.rollSegments.entries()) {
      if (segment.type === 'modifier') {
        const modifierValue = segment.value ?? 0;
        if (modifierValue === 0) {
          continue;
        }

        const signPrefix = tokenIndex === 0
          ? (segment.sign === -1 ? '- ' : '')
          : (segment.sign === -1 ? ' - ' : ' + ');

        tokens.push(
          <span key={`modifier-${segmentIndex}`}>
            {signPrefix}
            <span
              className={[
                'inline-flex items-center rounded-md px-1.5 py-0.5',
                segment.source === 'bonus'
                  ? 'border border-blue-400/45 bg-blue-500/15 text-blue-200 shadow-[0_0_12px_rgba(59,130,246,0.18)]'
                  : 'text-[var(--theme-text)]',
              ].join(' ')}
            >
              {modifierValue}
            </span>
          </span>
        );
        tokenIndex += 1;
        continue;
      }

      for (const [rollIndex, roll] of (segment.rolls ?? []).entries()) {
        const signPrefix = tokenIndex === 0
          ? (segment.sign === -1 ? '- ' : '')
          : (segment.sign === -1 ? ' - ' : ' + ');

        tokens.push(
          <span key={`roll-${segmentIndex}-${rollIndex}`}>
            {signPrefix}
            <span
              className={[
                'inline-flex items-center rounded-md px-1.5 py-0.5',
                segment.source === 'bonus'
                  ? 'border border-blue-400/45 bg-blue-500/15 text-blue-200 shadow-[0_0_12px_rgba(59,130,246,0.18)]'
                  : 'text-[var(--theme-text)]',
                roll.kept
                  ? ''
                  : 'border border-white/10 bg-white/5 text-[var(--theme-text-muted)] line-through opacity-60 decoration-2',
              ].join(' ')}
              title={roll.kept ? undefined : 'Discarded roll'}
            >
              {roll.value}
            </span>
          </span>
        );
        tokenIndex += 1;
      }
    }

    return tokens;
  };

  const formatHistoryDetails = (entry: GameHistoryEntry) => {
    if (entry.roll) {
      const kept = entry.roll.keptRolls?.length ? ` kept ${entry.roll.keptRolls.join(', ')}` : '';
      const dropped = entry.roll.droppedRolls?.length ? ` dropped ${entry.roll.droppedRolls.join(', ')}` : '';
      return `${entry.roll.notation} -> ${entry.roll.total}${kept}${dropped}`;
    }

    return entry.details;
  };

  const loadDmSessionDetail = async (sessionId: string) => {
    if (!selectedAdventure || !dmPassword) return;

    setIsLoading(true);
    try {
      const res = await fetch(`/api/adventures/${selectedAdventure.id}/dm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: dmPassword, sessionId }),
      });
      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setDmSessionDetail(data.sessionDetail);
    } catch (err) {
      toast({
        title: 'Session details unavailable',
        description: err instanceof Error ? err.message : 'Failed to load session details',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const deleteSession = async (sessionId: string) => {
    try {
      await fetch(`/api/game/${sessionId}`, { method: 'DELETE' });
      if (dmData) {
        setDmData({
          ...dmData,
          gameStates: dmData.gameStates.filter(gs => gs.id !== sessionId),
        });
      }
      if (dmSessionDetail?.sessionId === sessionId) {
        setDmSessionDetail(null);
      }
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  };

  const deleteAdventure = async () => {
    if (!selectedAdventure || !dmPassword) return;
    
    try {
      await fetch(`/api/adventures/${selectedAdventure.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPassword: dmPassword }),
      });
      removeFromStorage(selectedAdventure.id);
      setView('list');
      setSelectedAdventure(null);
      setDmData(null);
    } catch (err) {
      console.error('Failed to delete adventure:', err);
    }
  };

  // Get current theme class
  const themeClass = gameData?.meta?.theme 
    ? `theme-${gameData.meta.theme}` 
    : selectedAdventure?.theme 
      ? `theme-${selectedAdventure.theme}`
      : 'theme-neon-mana-circuit';

  // Render Adventure List View
  const renderListView = () => (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur">
        <div className="w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Scroll className="w-8 h-8 text-amber-500" />
            <h1 className="text-2xl font-bold tracking-wide" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '18px' }}>
              OFFSESSION
            </h1>
          </div>
          <Button
            onClick={() => setView('create')}
            className="bg-amber-600 hover:bg-amber-500 text-black font-bold"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Adventure
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-8">
        {/* Played Adventures Section */}
        {storedAdventures.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xl font-semibold mb-4 text-amber-400 flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Played Adventures
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {storedAdventures.map((adventure) => (
                <Card key={adventure.id} className="bg-zinc-900 border-amber-600/30 hover:border-amber-600/50 transition-colors pixel-border-clippy">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{adventure.title}</CardTitle>
                      {adventure.completed ? (
                        <span className="status-badge completed">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Completed
                        </span>
                      ) : (
                        <span className="status-badge in-progress">
                          In Progress
                        </span>
                      )}
                    </div>
                    <CardDescription className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs border-amber-600/50 text-amber-400">
                        {THEMES.find(t => t.id === adventure.theme)?.name || adventure.theme}
                      </Badge>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-zinc-500 mb-3 font-mono">
                      ID: {adventure.id}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => prepareAdventureStart(adventure.id)}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-500"
                        size="sm"
                        disabled={isLoading}
                      >
                        <Play className="w-3 h-3 mr-1" />
                        {adventure.completed ? 'Replay' : 'Continue'}
                      </Button>
                      <Button
                        onClick={() => copyAdventureLink(adventure.id)}
                        variant="outline"
                        size="sm"
                        className="border-zinc-700"
                      >
                        {copiedLink ? <CheckCircle className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </Button>
                      <Button
                        onClick={() => removeFromStorage(adventure.id)}
                        variant="outline"
                        size="sm"
                        className="border-red-800 text-red-400 hover:bg-red-900/30"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800 bg-zinc-900/50 py-4 text-center text-zinc-500 text-sm">
        <FooterVersion label="Offsession" />
      </footer>
    </div>
  );

  // Render Create View
  const renderCreateView = () => (
    <div className="min-h-screen bg-black flex flex-col">
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur">
        <div className="w-full max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <Button
            onClick={() => {
              setView('list');
              setValidationErrors([]);
              setCreateSuccess(null);
            }}
            variant="ghost"
            className="text-zinc-400"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="text-xl font-bold">Create Adventure</h1>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* YAML Editor - 2 columns */}
          <div className="lg:col-span-2 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Adventure YAML</label>
              <Textarea
                value={yamlContent}
                onChange={(e) => setYamlContent(e.target.value)}
                className="font-mono text-sm bg-zinc-900 border-zinc-700 min-h-[500px]"
                placeholder="Enter your adventure YAML..."
              />
            </div>
            
            <div className="flex gap-2">
              <Button
                onClick={() => navigator.clipboard.writeText(DEFAULT_YAML)}
                variant="outline"
                size="sm"
                className="border-zinc-700"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy Template
              </Button>
              <Button
                onClick={() => setYamlContent(DEFAULT_YAML)}
                variant="outline"
                size="sm"
                className="border-zinc-700"
              >
                Reset to Demo
              </Button>
            </div>

            <details className="bg-zinc-900 border border-zinc-800 rounded-lg">
              <summary className="p-4 cursor-pointer text-lg font-semibold flex items-center gap-2 hover:text-amber-400">
                <BookOpen className="w-5 h-5" />
                YAML Syntax Documentation
              </summary>
              <div className="px-4 pb-4 space-y-4">
                <div className="flex justify-end">
                  <Button
                    onClick={downloadYamlDocumentation}
                    variant="outline"
                    size="sm"
                    className="border-zinc-700"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download .md
                  </Button>
                </div>
                <div className="markdown-content markdown-content-docs max-w-none text-zinc-300">
                  <ReactMarkdown components={MARKDOWN_COMPONENTS}>{YAML_DOCUMENTATION_MD}</ReactMarkdown>
                </div>
              </div>
            </details>
          </div>

          {/* Settings - 1 column */}
          <div className="space-y-6">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Lock className="w-5 h-5 text-amber-500" />
                  Access Passwords
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">DM Password</label>
                  <Input
                    type="password"
                    value={dmPasswordCreate}
                    onChange={(e) => setDmPasswordCreate(e.target.value)}
                    className="bg-zinc-800 border-zinc-700"
                    placeholder="Set a password to protect DM access"
                  />
                  <p className="text-xs text-zinc-500 mt-1">Required to access DM dashboard</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Player Password (Optional)</label>
                  <Input
                    type="password"
                    value={playerPasswordCreate}
                    onChange={(e) => setPlayerPasswordCreate(e.target.value)}
                    className="bg-zinc-800 border-zinc-700"
                    placeholder="Leave blank to allow players to join without a password"
                  />
                  <p className="text-xs text-zinc-500 mt-1">When set, players must enter it to start or resume a session.</p>
                </div>
              </CardContent>
            </Card>

            {/* Validation Errors */}
            {validationErrors.length > 0 && (
              <Card className="bg-red-900/20 border-red-800">
                <CardContent className="py-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />
                    <div>
                      <p className="font-medium text-red-400">Validation Failed</p>
                      <ul className="text-sm text-red-300 mt-1 list-disc list-inside">
                        {validationErrors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {yamlValidationReport && (
              <Card className={yamlValidationReport.status === 'Valid' ? 'bg-emerald-900/20 border-emerald-800' : 'bg-red-900/20 border-red-800'}>
                <CardContent className="py-4 space-y-3">
                  <div className="flex items-start gap-2">
                    {yamlValidationReport.status === 'Valid' ? (
                      <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className={`font-medium ${yamlValidationReport.status === 'Valid' ? 'text-emerald-400' : 'text-red-400'}`}>
                        {yamlValidationReport.status}
                      </p>
                      <p className="text-sm text-zinc-300 mt-1">
                        {yamlValidationReport.graph.totalScenes} scenes, {yamlValidationReport.graph.reachableScenes} reachable, {yamlValidationReport.graph.terminalScenes.length} ending{yamlValidationReport.graph.terminalScenes.length === 1 ? '' : 's'}, {yamlValidationReport.graph.completable ? 'completable' : 'not completable'}.
                      </p>
                    </div>
                  </div>

                  {yamlValidationReport.errors.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-red-300">Errors</p>
                      <ul className="text-sm text-red-200 mt-1 list-disc list-inside">
                        {yamlValidationReport.errors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {yamlValidationReport.warnings.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-amber-300">Warnings</p>
                      <ul className="text-sm text-amber-200 mt-1 list-disc list-inside">
                        {yamlValidationReport.warnings.map((warning, i) => (
                          <li key={i}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Success */}
            {createSuccess && (
              <Card className="bg-emerald-900/20 border-emerald-800">
                <CardContent className="py-4">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-emerald-400">Adventure Created!</p>
                      <p className="text-sm text-emerald-300 mt-1">
                        ID: <code className="bg-emerald-900/50 px-1 rounded">{createSuccess.id}</code>
                      </p>
                      <Button
                        onClick={() => copyAdventureLink(createSuccess.id)}
                        variant="outline"
                        size="sm"
                        className="mt-2 border-emerald-600 text-emerald-400"
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        Copy Link
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                onClick={handleValidateAdventure}
                variant="outline"
                className="border-zinc-700"
                disabled={isLoading || isValidatingYaml || !yamlContent.trim()}
              >
                {isValidatingYaml ? 'Validating...' : 'Validate YAML'}
              </Button>
              <Button
                onClick={handleCreateAdventure}
                className="w-full bg-amber-600 hover:bg-amber-500 text-black font-bold"
                disabled={isLoading || isValidatingYaml || !dmPasswordCreate}
              >
                {isLoading ? 'Creating...' : 'Create Adventure'}
              </Button>
            </div>

            {/* Theme Preview */}
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-lg">Available Themes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2">
                  {THEMES.map(theme => (
                    <div 
                      key={theme.id}
                      className={`p-2 rounded border cursor-pointer transition-colors ${
                        yamlContent.includes(`theme: "${theme.id}"`) || yamlContent.includes(`theme: '${theme.id}'`)
                          ? 'border-amber-500 bg-amber-900/20'
                          : 'border-zinc-700 hover:border-zinc-600'
                      }`}
                      onClick={() => {
                        setYamlContent(prev => prev.replace(/theme:\s*["'][^"']+["']/, `theme: "${theme.id}"`));
                      }}
                    >
                      <p className="font-medium text-sm">{theme.name}</p>
                      <p className="text-xs text-zinc-500">{theme.desc}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );

  // Render Play View
  const renderPlayView = () => {
    // Show start confirmation panel if arriving via link but game not started
    if (!gameData && pendingAdventureInfo) {
      const themeClass = `theme-${pendingAdventureInfo.theme}`;
      return (
        <div className={`min-h-screen flex flex-col ${themeClass}`}>
          <header className="border-b border-[var(--theme-border)] bg-[var(--theme-base)] py-3">
            <div className="w-full max-w-5xl mx-auto px-4 flex items-center justify-between">
              <Button
                onClick={() => {
                  setView('list');
                  setPendingAdventureId(null);
                  setPendingAdventureInfo(null);
                  setPendingSessionId(null);
                  setPendingAdventureMode('start');
                }}
                variant="ghost"
                className="text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <h1 className="text-lg font-bold glow-text" style={{ fontFamily: 'var(--theme-font)' }}>
                {pendingAdventureInfo.title}
              </h1>
              <div className="w-20" />
            </div>
          </header>

          <main className="flex-1 flex items-center justify-center p-4">
            <div className="pixel-border p-8 bg-[var(--theme-card)] max-w-lg w-full text-center letterbox-enter">
              <div className="mb-6">
                <Scroll className="w-16 h-16 mx-auto text-[var(--theme-accent)] mb-4" />
                <h2 className="text-2xl font-bold glow-text mb-2" style={{ fontFamily: 'var(--theme-font)' }}>
                  {pendingAdventureInfo.title}
                </h2>
                {pendingAdventureInfo.description && (
                  <p className="text-[var(--theme-text-muted)]">{pendingAdventureInfo.description}</p>
                )}
              </div>
              
              <p className="text-[var(--theme-text)] mb-6">
                {pendingAdventureMode === 'resume'
                  ? pendingAdventureInfo.requiresPlayerPassword
                    ? 'Your previous session is waiting. Enter the player password to continue where you left off.'
                    : 'Your previous session is waiting. Continue where you left off.'
                  : pendingAdventureInfo.requiresPlayerPassword
                    ? 'You are about to embark on a protected adventure. Enter the player password to begin.'
                    : 'You are about to embark on a new adventure. Your choices will have permanent consequences - choose wisely!'}
              </p>

              {pendingAdventureInfo.requiresPlayerPassword && (
                <div className="text-left mb-6 space-y-2">
                  <label className="block text-sm font-medium text-[var(--theme-text)]">Player Password</label>
                  <Input
                    type="password"
                    value={startAdventurePassword}
                    onChange={(e) => {
                      setStartAdventurePassword(e.target.value);
                      setStartAdventureError(null);
                    }}
                    className="bg-[var(--theme-base)] border-[var(--theme-border)] text-[var(--theme-text)]"
                    placeholder={pendingAdventureMode === 'resume' ? 'Enter the password to continue' : 'Enter the password to begin'}
                  />
                  <p className="text-xs text-[var(--theme-text-muted)]">
                    {pendingAdventureMode === 'resume'
                      ? 'This protected session cannot be resumed without the player password.'
                      : 'This adventure is protected and cannot be started without the player password.'}
                  </p>
                </div>
              )}

              {startAdventureError && (
                <div className="mb-6 rounded-lg border border-red-800 bg-red-900/20 p-3 text-left text-sm text-red-200">
                  {startAdventureError}
                </div>
              )}
              
              <div className="space-y-3">
                <Button
                  onClick={confirmStartAdventure}
                  className="w-full pixel-btn bg-emerald-600 hover:bg-emerald-500"
                  disabled={isLoading || (pendingAdventureInfo.requiresPlayerPassword && !startAdventurePassword)}
                >
                  <Play className="w-5 h-5 mr-2" />
                  {isLoading ? (pendingAdventureMode === 'resume' ? 'Continuing...' : 'Starting...') : (pendingAdventureMode === 'resume' ? 'Continue Adventure' : 'Begin Adventure')}
                </Button>
                {renderDmAccessButton('w-full border-[var(--theme-border)] text-[var(--theme-text)] hover:text-[var(--theme-text)]')}
                <Button
                  onClick={() => {
                    setView('list');
                    setPendingAdventureId(null);
                    setPendingAdventureInfo(null);
                    setPendingSessionId(null);
                    setPendingAdventureMode('start');
                    setStartAdventurePassword('');
                    setStartAdventureError(null);
                  }}
                  variant="outline"
                  className="w-full border-[var(--theme-border)]"
                >
                  Cancel
                </Button>
              </div>
              
              <p className="text-xs text-[var(--theme-text-muted)] mt-6 font-mono">
                ID: {pendingAdventureInfo.id}
              </p>
            </div>
          </main>

          <footer className="border-t border-[var(--theme-border)] bg-[var(--theme-base)] py-2 text-center text-[var(--theme-text-muted)] text-xs">
            <FooterVersion label="Offsession" />
          </footer>
        </div>
      );
    }
    
    if (!gameData) return null;
    
    const { scene, state, inventory, meta } = gameData;
    const themeClass = `theme-${meta.theme}`;
    const isCompleted = scene.exits.length === 0;
    const collectedInventoryEntries = Object.entries(state.inventory).filter(([, count]) => count > 0);

    // Show end game summary if completed
    if (isCompleted) {
      return (
        <div className={`min-h-screen flex flex-col ${themeClass}`}>
          <header className="border-b border-[var(--theme-border)] bg-[var(--theme-base)] py-3">
            <div className="w-full max-w-5xl mx-auto px-4 flex items-center justify-between">
              <Button
                onClick={() => {
                  setView('list');
                  setGameData(null);
                }}
                variant="ghost"
                className="text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Exit
              </Button>
              <h1 className="text-lg font-bold glow-text" style={{ fontFamily: 'var(--theme-font)' }}>
                {meta.title}
              </h1>
              <div className="w-20" />
            </div>
          </header>

          <main className="flex-1 flex items-center justify-center p-4">
            <div className="w-full max-w-3xl space-y-4 letterbox-enter">
              {/* Victory Banner */}
              <div className="pixel-border p-8 bg-[var(--theme-card)] text-center">
                <Sparkles className="w-16 h-16 mx-auto text-[var(--theme-accent)] mb-4" />
                <h2 className="text-3xl font-bold glow-text mb-2" style={{ fontFamily: 'var(--theme-font)' }}>
                  ADVENTURE COMPLETE
                </h2>
                <p className="text-xl text-[var(--theme-text)]">{scene.title}</p>
              </div>
              
              {/* Final Scene */}
              <div className="pixel-border p-6 bg-[var(--theme-card)]">
                <h3 className="text-lg font-bold mb-3 glow-text" style={{ fontFamily: 'var(--theme-font)' }}>
                  Final Scene
                </h3>
                <div className="markdown-content max-w-none text-[var(--theme-text)]">
                  <ReactMarkdown components={MARKDOWN_COMPONENTS}>{scene.description}</ReactMarkdown>
                </div>
              </div>
              
              {/* Adventure Summary */}
              <div className="pixel-border p-6 bg-[var(--theme-card)]">
                <h3 className="text-lg font-bold mb-4 glow-text" style={{ fontFamily: 'var(--theme-font)' }}>
                  Adventure Summary
                </h3>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="text-center p-4 bg-[var(--theme-base)] rounded">
                    <p className="text-3xl font-bold text-[var(--theme-accent)]">{state.history.length}</p>
                    <p className="text-xs text-[var(--theme-text-muted)]">Actions Taken</p>
                  </div>
                  <div className="text-center p-4 bg-[var(--theme-base)] rounded">
                    <p className="text-3xl font-bold text-[var(--theme-accent)]">
                      {collectedInventoryEntries.length}
                    </p>
                    <p className="text-xs text-[var(--theme-text-muted)]">Items Collected</p>
                  </div>
                </div>
                
                {/* Inventory at End */}
                {collectedInventoryEntries.length > 0 && (
                  <div>
                    <p className="mb-3 text-sm text-[var(--theme-text-muted)]">Final Inventory:</p>
                    {renderInventoryPanel(inventory, collectedInventoryEntries)}
                  </div>
                )}
              </div>
              
              {/* Full History with DCs */}
              <div className="pixel-border p-6 bg-[var(--theme-card)]">
                <h3 className="text-lg font-bold mb-4 glow-text" style={{ fontFamily: 'var(--theme-font)' }}>
                  Journey Log
                </h3>
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {state.history.map((entry, i) => (
                    <div key={i} className="p-3 bg-[var(--theme-base)] rounded border-l-4 border-[var(--theme-accent)]">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-xs text-[var(--theme-text-muted)]">
                          {new Date(entry.timestamp).toLocaleTimeString()}
                        </span>
                        <span className="text-xs text-[var(--theme-text-muted)]">
                          Scene: {entry.sceneId}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--theme-text)]">{entry.action}</p>
                      {formatHistoryDetails(entry) && (
                        <p className="text-xs text-[var(--theme-text-muted)] mt-1">{formatHistoryDetails(entry)}</p>
                      )}
                      {entry.roll?.critical && (
                        <p className={`text-xs mt-1 ${entry.roll.critical === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                          {getRollOutcomeLabel(entry.roll)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="grid gap-3 sm:grid-cols-2">
                {renderDmAccessButton('w-full border-[var(--theme-border)] text-[var(--theme-text)] hover:text-[var(--theme-text)]')}
                <Button
                  onClick={() => {
                    setView('list');
                    setGameData(null);
                  }}
                  className="w-full pixel-btn"
                >
                  Return to Menu
                </Button>
              </div>
            </div>
          </main>

          <footer className="border-t border-[var(--theme-border)] bg-[var(--theme-base)] py-2 text-center text-[var(--theme-text-muted)] text-xs">
            <FooterVersion label="Offsession" />
          </footer>
        </div>
      );
    }

    return (
      <div className={`min-h-screen flex flex-col ${themeClass}`}>
        {/* Header */}
        <header className="border-b border-[var(--theme-border)] bg-[var(--theme-base)] py-3">
          <div className="w-full max-w-5xl mx-auto px-4 flex items-center justify-between">
            <Button
              onClick={() => {
                setView('list');
                setGameData(null);
              }}
              variant="ghost"
              className="text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Exit
            </Button>
            <h1 className="text-lg font-bold glow-text" style={{ fontFamily: 'var(--theme-font)' }}>
              {meta.title}
            </h1>
            <div className="w-20" />
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-5xl space-y-4 letterbox-enter">
            {/* Inventory Bar */}
            {renderInventoryPanel(inventory, Object.entries(state.inventory))}

            {/* Main Scene Box */}
            <div className="pixel-border p-6 bg-[var(--theme-card)] scroll-unfurl">
              {/* Scene Title */}
              <h2 className="text-2xl font-bold mb-4 glow-text" style={{ fontFamily: 'var(--theme-font)' }}>
                {scene.title}
              </h2>

              {/* Item Changes - shown before description */}
              {scene.itemChanges && scene.itemChanges.length > 0 && (
                <div className="mb-4 space-y-2">
                  {scene.itemChanges.map((change, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded border-l-4 ${
                        change.type === 'add'
                          ? 'bg-emerald-900/20 border-emerald-500 text-emerald-300'
                          : 'bg-red-900/20 border-red-500 text-red-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {change.type === 'add' ? (
                          <span className="text-emerald-400 font-bold">+</span>
                        ) : (
                          <span className="text-red-400 font-bold">−</span>
                        )}
                        <span className="font-medium">
                          {change.text || `${change.amount}× ${change.itemName}`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Scene Image */}
              {scene.image ? (
                <div className="mb-4 flex justify-center">
                  <img
                    src={scene.image}
                    alt={scene.title}
                    className="max-w-full max-h-64 object-contain"
                    style={{ imageRendering: 'pixelated' }}
                  />
                </div>
              ) : scene.icon ? (
                <div className="mb-4 flex justify-center">
                  <div className="scene-icon rounded-md" aria-label={scene.title}>
                    {renderRpgAwesomeIcon(scene.icon, scene.title)}
                  </div>
                </div>
              ) : null}

              {/* Scene Description */}
              <div className="markdown-content max-w-none mb-6 text-[var(--theme-text)]">
                <ReactMarkdown components={MARKDOWN_COMPONENTS}>{scene.description}</ReactMarkdown>
              </div>

              {/* Exits */}
              <div className="space-y-2">
                {scene.exits.map((exit) => {
                  const buttonText = exit.hasGate && exit.showShort && exit.gateShortText
                    ? `${exit.text} (${exit.gateShortText})`
                    : exit.text;

                  // Default canUse to true if not specified (for backwards compatibility)
                  const canUse = exit.canUse !== undefined ? exit.canUse : true;
                  const isCurrentlyLoading = loadingExitIndex === exit.exitIndex;
                  const isDisabled = !canUse || exit.isUsed || (loadingExitIndex !== null && loadingExitIndex !== exit.exitIndex);

                  // Color mapping for exit buttons
                  const colorMap: Record<string, { bg: string; border: string; text: string; shadow: string }> = {
                    red: { bg: 'rgba(239, 68, 68, 0.15)', border: '#ef4444', text: '#fca5a5', shadow: 'rgba(239, 68, 68, 0.3)' },
                    green: { bg: 'rgba(34, 197, 94, 0.15)', border: '#22c55e', text: '#86efac', shadow: 'rgba(34, 197, 94, 0.3)' },
                    blue: { bg: 'rgba(59, 130, 246, 0.15)', border: '#3b82f6', text: '#93c5fd', shadow: 'rgba(59, 130, 246, 0.3)' },
                    purple: { bg: 'rgba(139, 92, 246, 0.15)', border: '#8b5cf6', text: '#c4b5fd', shadow: 'rgba(139, 92, 246, 0.3)' },
                    gold: { bg: 'rgba(251, 191, 36, 0.15)', border: '#fbbf24', text: '#fde68a', shadow: 'rgba(251, 191, 36, 0.3)' },
                    yellow: { bg: 'rgba(234, 179, 8, 0.15)', border: '#eab308', text: '#fde047', shadow: 'rgba(234, 179, 8, 0.3)' },
                    cyan: { bg: 'rgba(6, 182, 212, 0.15)', border: '#06b6d4', text: '#67e8f9', shadow: 'rgba(6, 182, 212, 0.3)' },
                    orange: { bg: 'rgba(249, 115, 22, 0.15)', border: '#f97316', text: '#fdba74', shadow: 'rgba(249, 115, 22, 0.3)' },
                    pink: { bg: 'rgba(236, 72, 153, 0.15)', border: '#ec4899', text: '#f9a8d4', shadow: 'rgba(236, 72, 153, 0.3)' },
                    white: { bg: 'rgba(255, 255, 255, 0.1)', border: '#ffffff', text: '#ffffff', shadow: 'rgba(255, 255, 255, 0.3)' },
                    emerald: { bg: 'rgba(16, 185, 129, 0.15)', border: '#10b981', text: '#6ee7b7', shadow: 'rgba(16, 185, 129, 0.3)' },
                    amber: { bg: 'rgba(245, 158, 11, 0.15)', border: '#f59e0b', text: '#fcd34d', shadow: 'rgba(245, 158, 11, 0.3)' },
                  };

                  const exitColor = exit.color ? colorMap[exit.color.toLowerCase()] : null;

                  return (
                    <Button
                      key={`${scene.id}:${exit.exitIndex}:${exit.text}`}
                      onClick={() => handleExitAction(exit.exitIndex, exit.text)}
                      disabled={isDisabled}
                      className={`w-full pixel-btn justify-start relative overflow-hidden ${
                        exit.isUsed ? 'opacity-50' : ''
                      } ${isCurrentlyLoading ? 'btn-loading' : ''}`}
                      style={exitColor ? {
                        background: exitColor.bg,
                        borderColor: exitColor.border,
                        color: exitColor.text,
                        boxShadow: `0 0 10px ${exitColor.shadow}`,
                      } : undefined}
                    >
                      <ChevronRight className="w-4 h-4 mr-2" />
                      {buttonText}
                      {exit.requiresItem && (
                        <Badge className="ml-2 bg-amber-900/50 text-amber-300">
                          {exit.requiresItem.amount || 1}x {exit.requiresItem.itemName}
                        </Badge>
                      )}
                      {exit.isUsed && (
                        <Badge className="ml-2 bg-zinc-700 text-zinc-400">Used</Badge>
                      )}
                    </Button>
                  );
                })}
                
                {scene.exits.length === 0 && (
                  <div className="text-center py-8 text-[var(--theme-text-muted)]">
                    <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p style={{ fontFamily: 'var(--theme-font)' }}>THE END</p>
                    <Button
                      onClick={() => {
                        setView('list');
                        setGameData(null);
                      }}
                      variant="outline"
                      className="mt-4 border-[var(--theme-border)]"
                    >
                      Return to Menu
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* History Log */}
            <details className="pixel-border bg-[var(--theme-card)]">
              <summary className="p-3 cursor-pointer text-[var(--theme-text-muted)] text-sm">
                History ({state.history.length} entries)
              </summary>
              <div className="history-log mx-3 mb-3">
                {state.history.slice().reverse().map((entry, i) => (
                  <div key={i} className="history-entry">
                    <span className="history-time">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="history-action">{entry.action}</span>
                    {formatHistoryDetails(entry) && (
                      <span className="text-[var(--theme-text-muted)]">- {formatHistoryDetails(entry)}</span>
                    )}
                    {entry.roll?.critical && (
                      <span className={entry.roll.critical === 'success' ? 'text-emerald-400' : 'text-red-400'}>
                        {' '}
                        [{getRollOutcomeLabel(entry.roll)}]
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </details>
          </div>
        </main>

        {selectedAdventure && (
          <div className="fixed bottom-4 right-4 z-20 sm:bottom-6 sm:right-6">
            <Button
              onClick={openDmLoginFromGame}
              className="pixel-btn bg-amber-600 text-black shadow-lg hover:bg-amber-500"
              disabled={isLoading}
            >
              <Lock className="w-4 h-4 mr-2" />
              DM Panel
            </Button>
          </div>
        )}

        {/* Footer */}
        <footer className="border-t border-[var(--theme-border)] bg-[var(--theme-base)] py-2 text-center text-[var(--theme-text-muted)] text-xs">
          <FooterVersion label={`Offsession • Scene: ${scene.id}`} />
        </footer>
      </div>
    );
  };

  // Render DM Dashboard View
  const renderDmView = () => {
    if (!dmData) return null;
    
    const { adventure, gameStates, scenes } = dmData;
    const themeClass = `theme-${adventure.theme}`;

    return (
      <div className={`min-h-screen flex flex-col ${themeClass}`}>
        <header className="border-b border-[var(--theme-border)] bg-[var(--theme-base)] py-3">
          <div className="w-full max-w-6xl mx-auto px-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                onClick={() => {
                  setView(gameData ? 'play' : 'list');
                  setDmData(null);
                  if (!gameData) {
                    setSelectedAdventure(null);
                  }
                }}
                variant="ghost"
                className="text-[var(--theme-text-muted)]"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                {gameData ? 'Return to Game' : 'Back'}
              </Button>
              <h1 className="text-lg font-bold" style={{ fontFamily: 'var(--theme-font)' }}>
                DM Dashboard: {adventure.title}
              </h1>
            </div>
            <Button
              onClick={deleteAdventure}
              variant="destructive"
              size="sm"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Adventure
            </Button>
          </div>
        </header>

        <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-6">
          <Tabs defaultValue="sessions" className="space-y-4">
            <TabsList className="bg-[var(--theme-base)] border-[var(--theme-border)]">
              <TabsTrigger value="sessions">Sessions</TabsTrigger>
              <TabsTrigger value="flowchart">Flowchart</TabsTrigger>
              <TabsTrigger value="yaml">YAML</TabsTrigger>
            </TabsList>

            <TabsContent value="sessions" className="space-y-4">
              <Card className="bg-[var(--theme-card)] border-[var(--theme-border)]">
                <CardHeader>
                  <CardTitle>Active Sessions</CardTitle>
                </CardHeader>
                <CardContent>
                  {gameStates.length === 0 ? (
                    <p className="text-[var(--theme-text-muted)]">No active sessions.</p>
                  ) : (
                    <div className="space-y-2">
                      {gameStates.map(gs => (
                        <div 
                          key={gs.id}
                          className="flex items-center justify-between p-3 border border-[var(--theme-border)] rounded"
                        >
                          <div>
                            <p className="font-mono text-sm">{gs.id}</p>
                            <p className="text-sm text-[var(--theme-text-muted)]">
                              Scene: {gs.currentSceneId} • {gs.historyLength} actions
                            </p>
                            <p className="text-xs text-[var(--theme-text-muted)]">
                              Updated: {new Date(gs.updatedAt).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              onClick={() => loadDmSessionDetail(gs.id)}
                              variant="outline"
                              size="sm"
                              className="border-[var(--theme-border)]"
                              disabled={isLoading}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              onClick={() => deleteSession(gs.id)}
                              variant="destructive"
                              size="sm"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="flowchart" className="space-y-4">
              <Card className="bg-[var(--theme-card)] border-[var(--theme-border)]">
                <CardHeader>
                  <CardTitle>Scene Flowchart</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <div className="flex flex-wrap gap-4">
                      {scenes.map((scene, i) => (
                        <div 
                          key={scene.id}
                          className="pixel-border p-4 bg-[var(--theme-base)] min-w-[150px] text-center"
                        >
                          <div className="text-xs text-[var(--theme-text-muted)]">Scene {i + 1}</div>
                          <div className="font-bold">{scene.title}</div>
                          <div className="text-xs text-[var(--theme-text-muted)]">id: {scene.id}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="yaml" className="space-y-4">
              <Card className="bg-[var(--theme-card)] border-[var(--theme-border)]">
                <CardHeader>
                  <CardTitle>Adventure YAML</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-sm font-mono overflow-x-auto p-4 bg-[var(--theme-base)] rounded border border-[var(--theme-border)]">
                    {adventure.yamlContent}
                  </pre>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    );
  };

  return (
    <>
      {view === 'list' && renderListView()}
      {view === 'create' && renderCreateView()}
      {view === 'play' && renderPlayView()}
      {view === 'dm' && renderDmView()}

      {/* DM Login Modal */}
      <Dialog open={dmLoginModal} onOpenChange={setDmLoginModal}>
        <DialogContent className="bg-zinc-900 border-zinc-700">
          <DialogHeader>
            <DialogTitle>DM Access</DialogTitle>
            <DialogDescription>
              Enter the DM password for "{selectedAdventure?.title}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              type="password"
              value={dmPassword}
              onChange={(e) => setDmPassword(e.target.value)}
              className="bg-zinc-800 border-zinc-700"
              onKeyDown={(e) => e.key === 'Enter' && handleDmLogin()}
            />
            {validationErrors.length > 0 && (
              <p className="text-sm text-red-400">{validationErrors[0]}</p>
            )}
            <Button
              onClick={handleDmLogin}
              className="w-full bg-amber-600 hover:bg-amber-500"
              disabled={isLoading || !dmPassword}
            >
              Enter DM Dashboard
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!dmSessionDetail} onOpenChange={(open) => !open && setDmSessionDetail(null)}>
        <DialogContent className="max-w-5xl bg-zinc-950 border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle>Session Timeline</DialogTitle>
            <DialogDescription>
              {dmSessionDetail ? `Session ${dmSessionDetail.sessionId} • Current scene ${dmSessionDetail.currentSceneId}` : 'Detailed session history'}
            </DialogDescription>
          </DialogHeader>
          {dmSessionDetail && (
            <div className="max-h-[75vh] space-y-4 overflow-y-auto pr-2">
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4 text-sm text-zinc-300">
                Updated {new Date(dmSessionDetail.updatedAt).toLocaleString()} • {dmSessionDetail.history.length} timeline entries
              </div>
              {dmSessionDetail.history.slice().reverse().map((entry, index) => (
                <div key={`${entry.timestamp}-${index}`} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-zinc-100">{entry.action}</p>
                      <p className="text-xs text-zinc-400">
                        {new Date(entry.timestamp).toLocaleString()} • Scene {entry.sceneId}
                      </p>
                    </div>
                    {entry.roll?.critical && (
                      <Badge className={entry.roll.critical === 'success' ? 'bg-emerald-900 text-emerald-300' : 'bg-rose-900 text-rose-300'}>
                        {getRollOutcomeLabel(entry.roll)}
                      </Badge>
                    )}
                  </div>

                  {entry.details && (
                    <p className="text-sm text-zinc-300">{entry.details}</p>
                  )}

                  {entry.roll && (
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3 text-sm">
                        <p className="text-xs uppercase tracking-wide text-zinc-500">Roll</p>
                        <p className="font-mono text-zinc-100">{entry.roll.notation}</p>
                        <p className="text-zinc-300">Raw rolls: {entry.roll.rolls.join(', ')}</p>
                        {entry.roll.keptRolls?.length ? <p className="text-zinc-300">Kept: {entry.roll.keptRolls.join(', ')}</p> : null}
                        {entry.roll.droppedRolls?.length ? <p className="text-zinc-400">Dropped: {entry.roll.droppedRolls.join(', ')}</p> : null}
                        <p className="text-zinc-300">Modifier: {entry.roll.modifier >= 0 ? '+' : ''}{entry.roll.modifier}</p>
                        <p className="text-zinc-100">Total: {entry.roll.total}</p>
                        <p className={entry.roll.success ? 'text-emerald-300' : 'text-rose-300'}>{getRollOutcomeLabel(entry.roll)}</p>
                      </div>
                      <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3 text-sm">
                        <p className="text-xs uppercase tracking-wide text-zinc-500">Roll Context</p>
                        <p className="text-zinc-300">DC: {entry.roll.dc ?? 'n/a'}</p>
                        <p className="text-zinc-300">Kept d20: {entry.roll.keptD20 ?? 'n/a'}</p>
                        <p className="text-zinc-300">Bonus: {entry.roll.appliedBonus ?? 0}</p>
                        <p className="text-zinc-300">Bonus stage: {entry.roll.bonusStage ?? 'none'}</p>
                        <p className="text-zinc-300">Bonus item: {entry.roll.bonusItemName ?? 'none'}</p>
                        <p className="text-zinc-300">Outcome reason: {entry.roll.successReason ?? 'n/a'}</p>
                      </div>
                    </div>
                  )}

                  {entry.item && (
                    <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3 text-sm text-zinc-300">
                      Item: {entry.item.name} • {entry.item.type}
                      {entry.item.value ? ` • Value ${entry.item.value}` : ''}
                      {entry.item.bonusTiming ? ` • Timing ${entry.item.bonusTiming}` : ''}
                    </div>
                  )}

                  {entry.snapshot && (
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3 text-sm">
                        <p className="text-xs uppercase tracking-wide text-zinc-500">Snapshot</p>
                        <p className="text-zinc-300">Scene: {entry.snapshot.currentSceneId}</p>
                        <p className="text-zinc-300">Completed: {entry.snapshot.completed ? 'yes' : 'no'}</p>
                        <p className="text-zinc-300">Used exits: {entry.snapshot.usedExits.length ? entry.snapshot.usedExits.join(', ') : 'none'}</p>
                      </div>
                      <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3 text-sm">
                        <p className="text-xs uppercase tracking-wide text-zinc-500">Counters</p>
                        <pre className="whitespace-pre-wrap break-words text-xs text-zinc-300">{JSON.stringify(entry.snapshot.counters, null, 2)}</pre>
                        <p className="mt-3 text-xs uppercase tracking-wide text-zinc-500">Inventory</p>
                        <pre className="whitespace-pre-wrap break-words text-xs text-zinc-300">{JSON.stringify(entry.snapshot.inventory, null, 2)}</pre>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dice Roll Modal */}
      {diceModal && (
        <div className="dice-modal-overlay" onClick={() => !diceModal.result && !diceModal.isRolling && setDiceModal(null)}>
          <div className={`dice-modal pixel-border-clippy ${diceModal.isRolling ? 'suspense-buildup' : ''}`} onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-2" style={{ fontFamily: 'var(--theme-font)' }}>
              {diceModal.gateText}
            </h3>
            
            {!diceModal.result ? (
              <>
                {/* Dice Rolling Animation */}
                {diceModal.isRolling ? (
                  <div className="py-8 text-center">
                    <div className="dice-rolling inline-block mb-4">
                      <Dices className="w-16 h-16 text-[var(--theme-accent)]" />
                    </div>
                    <p className="text-[var(--theme-text-muted)] animate-pulse">Rolling dice...</p>
                  </div>
                ) : (
                  <>
                    {diceModal.notice && (
                      <div className="mb-4 rounded-lg border border-emerald-600/40 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-300">
                        {diceModal.notice}
                      </div>
                    )}

                    {/* Dice Buttons */}
                    <div className="mb-4">
                      <label className="text-xs text-[var(--theme-text-muted)] mb-2 block text-center">
                        Click to add dice • Right-click to remove
                      </label>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {[
                          { sides: 4, label: 'd4', color: '#ef4444' },
                          { sides: 6, label: 'd6', color: '#f97316' },
                          { sides: 8, label: 'd8', color: '#eab308' },
                          { sides: 10, label: 'd10', color: '#22c55e' },
                          { sides: 12, label: 'd12', color: '#3b82f6' },
                          { sides: 20, label: 'd20', color: '#8b5cf6' },
                          { sides: 100, label: 'd100', color: '#ec4899' },
                        ].map((dice) => {
                          const count = getDiceCount(dice.sides);
                          return (
                            <button
                              key={dice.sides}
                              onClick={() => addDiceToPool(dice.sides)}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                removeDiceFromPool(dice.sides);
                              }}
                              className={`dice-type-btn ${count > 0 ? 'selected' : ''}`}
                              style={{ 
                                '--dice-color': dice.color,
                                borderColor: count > 0 ? dice.color : 'var(--theme-border)',
                                color: count > 0 ? dice.color : 'var(--theme-text)',
                                boxShadow: count > 0 ? `0 0 15px ${dice.color}40` : 'none'
                              } as React.CSSProperties}
                            >
                              {dice.label}
                              {count > 0 && (
                                <span className="dice-count" style={{ background: dice.color }}>
                                  {count}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    
                    {/* Modifier Buttons */}
                    <div className="mb-3">
                      <label className="text-xs text-[var(--theme-text-muted)] mb-1 block text-center">Modifiers ({diceModal.modifier >= 0 ? '+' : ''}{diceModal.modifier})</label>
                      <div className="flex gap-2 justify-center">
                        <button 
                          onClick={() => addModifier(-5)}
                          className="modifier-btn negative"
                        >-5</button>
                        <button 
                          onClick={() => addModifier(-1)}
                          className="modifier-btn negative"
                        >-1</button>
                        <button 
                          onClick={() => addModifier(1)}
                          className="modifier-btn positive"
                        >+1</button>
                        <button 
                          onClick={() => addModifier(5)}
                          className="modifier-btn positive"
                        >+5</button>
                      </div>
                    </div>
                    
                    {/* Advantage/Disadvantage Toggle */}
                    <div className="mb-4">
                      <label className="text-xs text-[var(--theme-text-muted)] mb-1 block text-center">Roll Type</label>
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => setDiceModal(prev => prev ? { ...prev, advantage: 'none' } : null)}
                          className={`roll-toggle ${diceModal.advantage === 'none' ? 'active' : ''}`}
                        >
                          Normal
                        </button>
                        <button
                          onClick={() => setDiceModal(prev => prev ? { ...prev, advantage: 'advantage' } : null)}
                          className={`roll-toggle advantage ${diceModal.advantage === 'advantage' ? 'active' : ''}`}
                        >
                          Advantage
                        </button>
                        <button
                          onClick={() => setDiceModal(prev => prev ? { ...prev, advantage: 'disadvantage' } : null)}
                          className={`roll-toggle disadvantage ${diceModal.advantage === 'disadvantage' ? 'active' : ''}`}
                        >
                          Disadv
                        </button>
                      </div>
                    </div>
                    
                    {/* Preview - Click to Edit - BIG AND PROMINENT */}
                    <div
                      className="text-center mb-4 p-4 bg-[var(--theme-base)] rounded-lg border-2 border-[var(--theme-border)] cursor-pointer hover:border-[var(--theme-accent)] transition-all hover:shadow-lg hover:shadow-[var(--theme-accent)]/20"
                      onClick={() => setDiceModal(prev => prev ? { ...prev, isEditing: !prev.isEditing } : null)}
                    >
                      <p className="text-xs text-[var(--theme-text-muted)] mb-2 uppercase tracking-wider">
                        Roll Preview {diceModal.isEditing ? '✏️ Editing' : '👆 Click to edit'}
                      </p>
                      {selectedPreRollBonusItem && (
                        <div className="mb-3 flex justify-center">
                          <span className="inline-flex items-center gap-2 rounded-full border border-blue-500/60 bg-blue-950/70 px-3 py-1 text-xs font-semibold text-blue-200 shadow-[0_0_18px_rgba(59,130,246,0.18)]">
                            <Sparkles className="h-3.5 w-3.5" />
                            Pre-roll bonus: {selectedPreRollBonusItem.name} (+{selectedPreRollBonusItem.value})
                          </span>
                        </div>
                      )}
                      {diceModal.isEditing ? (
                        <input
                          type="text"
                          value={diceModal.customExpression || buildDiceNotation(diceModal.dicePool, diceModal.modifier, diceModal.advantage)}
                          onChange={(e) => setDiceModal(prev => prev ? { ...prev, customExpression: e.target.value } : null)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              setDiceModal(prev => prev ? { ...prev, isEditing: false } : null);
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full bg-transparent border-b-2 border-[var(--theme-accent)] text-center outline-none text-2xl font-bold"
                          style={{ fontFamily: 'var(--theme-font)' }}
                          autoFocus
                        />
                      ) : (
                        <p
                          className="text-2xl font-bold glow-text"
                          style={{ fontFamily: 'var(--theme-font)' }}
                        >
                          {buildDiceNotation(diceModal.dicePool, diceModal.modifier, diceModal.advantage)}
                        </p>
                      )}
                    </div>

                    {gameData && (
                      <div className="mb-4 space-y-2 border-t border-[var(--theme-border)] pt-4">
                        <p className="text-xs text-[var(--theme-text-muted)]">Pre-roll bonus items</p>
                        <div className="space-y-2">
                          {Object.entries(gameData.state.inventory).map(([itemId, count]) => {
                            const item = gameData.inventory[itemId];
                            if (!item || count <= 0 || item.type !== 'bonus') return null;
                            if (item.bonus_timing === 'after') return null;

                            const selected = diceModal.selectedPreRollBonusItemId === itemId;
                            return (
                              <Button
                                key={itemId}
                                onClick={() => togglePreRollBonus(itemId)}
                                variant="outline"
                                className={`w-full justify-between border-blue-600 hover:bg-blue-900/20 ${selected ? 'bg-blue-950/40 text-blue-300' : 'text-blue-400'}`}
                              >
                                <span className="flex items-center gap-2">
                                  <Sparkles className="w-4 h-4" />
                                  {item.name} (+{item.value})
                                </span>
                                <span className="text-xs uppercase tracking-wide">{getBonusTimingLabel(item)}</span>
                              </Button>
                            );
                          })}
                        </div>
                        {diceModal.selectedPreRollBonusItemId && gameData.inventory[diceModal.selectedPreRollBonusItemId] && (
                          <p className="text-xs text-blue-300">
                            Selected: {gameData.inventory[diceModal.selectedPreRollBonusItemId].name} adds +{gameData.inventory[diceModal.selectedPreRollBonusItemId].value} before the roll.
                          </p>
                        )}
                      </div>
                    )}
                    
                    <div className="flex gap-2">
                      <Button
                        onClick={rollDice}
                        className="flex-1 pixel-btn"
                        disabled={isLoading}
                      >
                        <Dices className="w-4 h-4 mr-2" />
                        Roll!
                      </Button>
                      <Button
                        onClick={() => setDiceModal(null)}
                        variant="outline"
                        className="border-[var(--theme-border)]"
                      >
                        Cancel
                      </Button>
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
                {diceModal.afterBonusRevealResult && diceModal.afterBonusRevealItemId && gameData?.inventory[diceModal.afterBonusRevealItemId] ? (
                  <div className="after-bonus-screen">
                    <div className="after-bonus-screen__header">
                      <p className="after-bonus-screen__eyebrow">Bonus Applied</p>
                      <h4 className="after-bonus-screen__title">
                        {gameData.inventory[diceModal.afterBonusRevealItemId].name}
                      </h4>
                      <p className="after-bonus-screen__subtitle">
                        The bonus has been committed and the updated outcome is ready.
                      </p>
                    </div>

                    <div className="after-bonus-screen__math">
                      <div className="after-bonus-chip">
                        <span className="after-bonus-chip__label">Original</span>
                        <span className="after-bonus-chip__value">{diceModal.result?.total}</span>
                      </div>
                      <div className="after-bonus-screen__operator">+</div>
                      <div className="after-bonus-chip after-bonus-chip--accent">
                        <span className="after-bonus-chip__label">Bonus</span>
                        <span className="after-bonus-chip__value">{diceModal.afterBonusRevealResult.appliedBonus ?? 0}</span>
                      </div>
                      <div className="after-bonus-screen__operator">=</div>
                      <div className="after-bonus-chip after-bonus-chip--final">
                        <span className="after-bonus-chip__label">Final</span>
                        <span className="after-bonus-chip__value">{diceModal.afterBonusRevealResult.total}</span>
                      </div>
                    </div>

                    <div className={`dice-result ${diceModal.afterBonusRevealResult.success ? 'success dice-glow-success' : 'failure dice-glow-failure'} ${diceModal.afterBonusRevealResult.critical === 'success' ? 'critical-success-burst' : ''} ${diceModal.afterBonusRevealResult.critical === 'failure' ? 'critical-failure-shatter' : ''} dice-reveal`}>
                      {diceModal.afterBonusRevealResult.total}
                    </div>

                    <p className="text-center text-sm text-[var(--theme-text)]/90">
                      Rolls: {renderRollBreakdown(diceModal.afterBonusRevealResult)}
                    </p>

                    <div className="after-bonus-screen__verdict">
                      {diceModal.afterBonusRevealResult.success ? (
                        <span className="text-emerald-400 font-bold">✓ {getRollOutcomeLabel(diceModal.afterBonusRevealResult)}</span>
                      ) : (
                        <span className="text-red-400 font-bold">✗ {getRollOutcomeLabel(diceModal.afterBonusRevealResult)}</span>
                      )}
                    </div>

                    {diceModal.afterBonusRevealResult.critical === 'success' && (
                      <p className="text-center mb-4 text-amber-300 font-semibold critical-success-copy">
                        Natural 20. Automatic success.
                      </p>
                    )}
                    {diceModal.afterBonusRevealResult.critical === 'failure' && (
                      <p className="text-center mb-4 text-rose-300 font-semibold critical-failure-copy">
                        Natural 1. Automatic failure. Only reroll items can change the outcome.
                      </p>
                    )}

                    <Button
                      onClick={continueFromDiceModal}
                      className="w-full mt-2 border border-blue-500 bg-blue-600 text-white hover:bg-blue-500"
                      disabled={isLoading}
                    >
                      Continue
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className={`dice-result ${activeDiceResult?.success ? 'success dice-glow-success' : 'failure dice-glow-failure'} ${activeDiceResult?.critical === 'success' ? 'critical-success-burst' : ''} ${activeDiceResult?.critical === 'failure' ? 'critical-failure-shatter' : ''} dice-reveal`}>
                      {activeDiceResult?.total}
                    </div>
                    {activeDiceResult?.bonusStage === 'before' && (activeDiceResult?.appliedBonus ?? 0) > 0 && (
                      <div className="mb-3 flex justify-center">
                        <span className="inline-flex items-center gap-2 rounded-full border border-blue-500/60 bg-blue-950/70 px-3 py-1 text-xs font-semibold text-blue-200 shadow-[0_0_18px_rgba(59,130,246,0.18)]">
                          <Sparkles className="h-3.5 w-3.5" />
                          Applied before roll: {appliedPreRollBonusName ?? 'Bonus item'} {activeDiceResult.bonusNotation ? `(${activeDiceResult.bonusNotation} = +${activeDiceResult.appliedBonus ?? 0})` : `(+${activeDiceResult.appliedBonus ?? 0})`}
                        </span>
                      </div>
                    )}
                    <p className="text-center text-sm mb-2">
                      Rolls: {renderRollBreakdown(activeDiceResult)}
                    </p>
                    <p className="text-center mb-2">
                      {activeDiceResult?.success ? (
                        <span className="text-emerald-400 font-bold">✓ {getRollOutcomeLabel(activeDiceResult)}</span>
                      ) : (
                        <span className="text-red-400 font-bold">✗ {getRollOutcomeLabel(activeDiceResult!)}</span>
                      )}
                    </p>
                    {activeDiceResult?.critical === 'success' && (
                      <p className="text-center mb-4 text-amber-300 font-semibold critical-success-copy">
                        Natural 20. Automatic success.
                      </p>
                    )}
                    {activeDiceResult?.critical === 'failure' && (
                      <p className="text-center mb-4 text-rose-300 font-semibold critical-failure-copy">
                        Natural 1. Automatic failure. Only reroll items can change the outcome.
                      </p>
                    )}

                    {diceModal.showReroll && gameData && (
                      <div className="border-t border-[var(--theme-border)] pt-4 space-y-2">
                        <p className="text-xs text-[var(--theme-text-muted)]">Use items:</p>
                        {Object.entries(gameData.state.inventory).map(([itemId, count]) => {
                          const item = gameData.inventory[itemId];
                          if (!item || count <= 0) return null;

                          if (item.type === 'reroll') {
                            return (
                              <Button
                                key={itemId}
                                onClick={() => rerollDice(itemId)}
                                variant="outline"
                                className="w-full border-emerald-600 text-emerald-400 hover:bg-emerald-900/30"
                              >
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Use {item.name} (Reroll)
                              </Button>
                            );
                          }

                          if (item.type === 'bonus') {
                            const disabledForTiming = item.bonus_timing === 'before';
                            const disabledForCritical = diceModal.result?.critical === 'failure';
                            const isDisabled = disabledForTiming || disabledForCritical;

                            return (
                              <Button
                                key={itemId}
                                onClick={() => applyPostRollBonus(itemId)}
                                variant="outline"
                                className="w-full border-blue-600 text-blue-400 hover:bg-blue-900/30 disabled:opacity-50"
                                disabled={isDisabled}
                              >
                                <Sparkles className="w-4 h-4 mr-2" />
                                Use {item.name} (+{item.value})
                                <span className="ml-auto text-xs uppercase tracking-wide">{getBonusTimingLabel(item)}</span>
                              </Button>
                            );
                          }

                          return null;
                        })}
                      </div>
                    )}

                    <Button
                      onClick={continueFromDiceModal}
                      className="w-full mt-4 pixel-btn"
                      disabled={isLoading}
                    >
                      Continue
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
