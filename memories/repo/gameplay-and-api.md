## Knoladge Base

- Public adventure metadata route `GET /api/adventures/[id]` parses stored YAML to expose `meta` and a scene summary while hiding password hashes behind `requiresPlayerPassword`.
- Adventure deletion now verifies the provided admin password against `adminPasswordHash` before calling Prisma delete; cascade deletion still removes related `GameState` rows.
- DM dashboard route `POST /api/adventures/[id]/dm` verifies the admin password, returns all sessions for the adventure, and can include normalized history for a requested `sessionId`.
- Protected player flow: `POST /api/game` and `GET /api/game/[sessionId]` both enforce `playerPassword` when `playerPasswordHash` exists.
- Validation reports include graph metadata: total scenes, reachable scenes, unreachable scenes, terminal scenes, dead ends, and a `completable` flag.
- Scene entry can mutate inventory through `add_items` and `remove_items`; exit usage can also apply counter, item, and currency effects.
- Bonus items support `bonus_timing` of `before`, `after`, or `both`. After-roll bonuses apply to the existing failed roll, but critical failures can only be answered with reroll items.
- A failed gated roll does not always resolve immediately. The session route can park the failure as pending so the client may use a reroll item, apply an after-roll bonus, or continue to the failure path.
- Discord notifications are server-only. `sendAdventureNotification` is called for adventure creation, fresh session start, and session completion when the new scene has no exits.
