## Short Term Memory

- GitNexus repo used: `offsession`.
- Useful GitNexus confirmations:
  - `validateAdventureYamlContent` is called by `POST /api/adventures` and `POST /api/adventures/validate`.
  - `parseAdventureYaml` is called by runtime/read endpoints for adventures, gameplay, and the DM dashboard.
  - `createGameStateSnapshot` is reached from game start history creation and session history append logic.
  - `sendAdventureNotification` is called from adventure create, game start, and game session POST completion flow.
- Broad `gitnexus_query` searches were somewhat noisy for architecture discovery in this repo; direct file reads were needed to verify stable facts before writing durable memory.
- Environment note: the global `/memories` mount is not writable here, so project-memory notes were written to the repo-local fallback at `memories/repo` and `memories/session`.
- Follow-up completed: `src/app/api/adventures/[id]/route.ts` DELETE now verifies `adminPassword` and has regression coverage for missing, invalid, and valid password cases.
