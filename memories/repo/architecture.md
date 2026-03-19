## Core Memories

- App shape: Next.js 16 App Router app with a single client-heavy UI entry in `src/app/page.tsx` and server routes under `src/app/api/**`.
- Adventure YAML is the source of truth. `src/lib/adventure-utils.ts` centralizes YAML parsing, schema validation, graph analysis, password hashing, and runtime condition evaluation.
- Validation split: `validateAdventureYamlContent` is used by adventure creation and the explicit validation endpoint; `parseAdventureYaml` is used by runtime and read APIs once YAML is already stored.
- Persistence uses Prisma + SQLite. `Adventure` stores title, theme, YAML, admin password hash, and optional player password hash. `GameState` stores current scene plus JSON-serialized counters, inventory, used exits, and history.
- Prisma schema sets `GameState.adventure` with `onDelete: Cascade`, so deleting an adventure removes all saved sessions.
- Game start flow in `src/app/api/game/route.ts` resumes the first existing session for `meta.one_shot` adventures instead of creating duplicate sessions.
- Session progression in `src/app/api/game/[sessionId]/route.ts` encodes unresolved failed gate state into `usedExits` with the `__pending_gate__:` prefix so rerolls and after-roll bonuses survive round trips.
- History snapshots come from `createGameStateSnapshot` in `src/lib/game-state.ts`; snapshots are attached when sessions start and when route handlers append transition or roll history.
- Theme definitions live in `src/lib/themes.ts`; `getTheme` falls back to `neon-mana-circuit` when an unknown theme id is requested.
