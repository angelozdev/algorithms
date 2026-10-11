# coach — worked examples

Each example is a real shape of `pnpm -s today --json` (a test checks them against the CLI) and an outline of the answer. Write the answer in Spanish; the quoted phrases are the tone to aim for, not a script.

## 1. The repo still has progress from before the coach

```json
{ "initialized": false, "next": "migrate" }
```

- Say there is nothing to plan until the old progress moves into `.study/`, and that only the user runs that move.
- The steps: stop `pnpm play` and `pnpm watch`; `pnpm study migrate --dry-run` and read it; `pnpm study migrate`; review `git status` and commit what it strips.
- End with "Cuando termines, pregúntame otra vez «¿qué me toca hoy?» 🚀".

## 2. First use: the coach has not started

```json
{
  "initialized": true,
  "started": false,
  "date": "2026-10-05",
  "paused": null,
  "phase": null,
  "announcements": [],
  "mode": "normal",
  "items": [],
  "backlog": { "waiting": 0, "days": 0 },
  "budget": { "minutes": 45, "planned": 0 }
}
```

- Run `pnpm -s study curriculum --json` first.
- One message with the three questions: minutes a day ("¿Cuántos minutos al día? Si te da igual, arrancamos con 45"), Python or TypeScript, and the list (Grind 75 recommended: it is the one already imported).
- After the answers: `pnpm -s study init --minutes <n> --lang <lang>`, `pnpm -s study curriculum set <preset> --json`, then `pnpm -s today --json --refresh` (example 3).

## 3. Day one of phase 0

```json
{
  "initialized": true,
  "started": true,
  "date": "2026-10-05",
  "paused": null,
  "phase": { "id": "bases", "since": "2026-10-05T14:00:00.000Z", "preset": "grind-75", "progress": { "done": 0, "total": 5 }, "list": null, "expansion": null },
  "announcements": [{ "id": 1, "key": "coach-started", "at": "2026-10-05T14:00:00.000Z", "payload": { "preset": "grind-75", "phase": "bases" } }],
  "mode": "normal",
  "items": [{ "kind": "concept", "id": "big-o", "title": "Big-O", "minutes": 20, "reason": "bases 1/5", "done": false, "missing": false }],
  "backlog": { "waiting": 0, "days": 0 },
  "budget": { "minutes": 45, "planned": 20 }
}
```

- The welcome (`coach-started`): Grind 75, phase 0, what the phases are in two lines. Then `pnpm -s study ack 1`.
- "Fase 0 · Bases — 0/5".
- "📚 Concepto · Big-O (big-o) · 20 min · base 1 de 5": read `concepts/big-o/README.md`, do its three exercises (`pnpm play big-o/01`…), write "My explanation", then "revisa mi explicación".
- "Hoy: 20 de 45 minutos".

## 4. A normal day in phase 1

```json
{
  "initialized": true,
  "started": true,
  "date": "2026-11-02",
  "paused": null,
  "phase": { "id": "learn", "since": "2026-10-12T15:00:00.000Z", "preset": "grind-75", "progress": { "done": 9, "total": 75 }, "list": { "list": "grind-75", "imported": 75, "size": 75 }, "expansion": null },
  "announcements": [],
  "mode": "normal",
  "items": [
    { "kind": "continue", "id": "lc-0020", "title": "Valid Parentheses", "minutes": 15, "reason": "in progress · stack", "done": false, "missing": false },
    { "kind": "review", "id": "lc-0001", "title": "Two Sum", "minutes": 9, "reason": "due 2 days ago", "done": true, "missing": false },
    { "kind": "new", "id": "lc-0232", "title": "Implement Queue using Stacks", "minutes": 15, "reason": "block 2/3 · stack", "done": false, "missing": false }
  ],
  "backlog": { "waiting": 0, "days": 0 },
  "budget": { "minutes": 45, "planned": 39 }
}
```

- "Fase 1 · Aprender la lista — 9/75 (Grind 75)".
- "▶️ Sigue · Valid Parentheses (lc-0020) · 15 min · en curso".
- "🔁 Repaso · Two Sum (lc-0001) · 9 min · tocaba hace 2 días ✅".
- "✨ Nuevo · Implement Queue using Stacks (lc-0232) · 15 min · bloque 2 de 3 · Stack": a block item names its pattern.
- "Hoy: 39 de 45 minutos", and the first action: `pnpm play lc-0020`.

## 5. Back after a break

```json
{
  "initialized": true,
  "started": true,
  "date": "2026-11-20",
  "paused": null,
  "phase": { "id": "learn", "since": "2026-10-12T15:00:00.000Z", "preset": "grind-75", "progress": { "done": 14, "total": 75 }, "list": { "list": "grind-75", "imported": 75, "size": 75 }, "expansion": null },
  "announcements": [{ "id": 7, "key": "welcome-back", "at": "2026-11-20T13:30:00.000Z", "payload": { "date": "2026-11-20", "daysAway": 9 } }],
  "mode": "return",
  "items": [
    { "kind": "review", "id": "lc-0704", "title": "Binary Search", "minutes": 9, "reason": "due 6 days ago", "done": false, "missing": false },
    { "kind": "review", "id": "lc-0217", "title": "Contains Duplicate", "minutes": 9, "reason": "due 4 days ago", "done": false, "missing": false },
    { "kind": "new", "id": "lc-0242", "title": "Valid Anagram", "minutes": 15, "reason": "mix · arrays-hashing", "done": false, "missing": false }
  ],
  "backlog": { "waiting": 6, "days": 2 },
  "budget": { "minutes": 45, "planned": 33 }
}
```

- The welcome back first: "¡9 días! Bienvenido de vuelta 💛". No guilt; the phase is still 1.
- Today opens with quick wins: the reviews they are most likely to remember.
- "✨ Nuevo · Valid Anagram (lc-0242) · 15 min · práctica mezclada": a mixed item never names its pattern.
- "6 repasos más esperan; los reparto en los próximos 2 días".
- Then `pnpm -s study ack 7`.

## 6. Phase 3 begins: choose the list to expand with

```json
{
  "initialized": true,
  "started": true,
  "date": "2027-03-01",
  "paused": null,
  "phase": { "id": "expand", "since": "2027-03-01T14:10:00.000Z", "preset": "grind-75", "progress": { "done": 0, "total": 20 }, "list": null, "expansion": { "list": null, "choices": ["grind-169", "neetcode-150"] } },
  "announcements": [{ "id": 12, "key": "phase-advanced", "at": "2027-03-01T14:10:00.000Z", "payload": { "from": "master", "to": "expand" } }],
  "mode": "normal",
  "items": [{ "kind": "review", "id": "lc-0056", "title": "Merge Intervals", "minutes": 21, "reason": "due today", "done": false, "missing": false }],
  "backlog": { "waiting": 0, "days": 0 },
  "budget": { "minutes": 45, "planned": 21 }
}
```

- Celebrate: "¡Dominaste Grind 75! 🥳 Fase 3 · Ampliar". Then `pnpm -s study ack 12`.
- Ask: "¿ampliamos con Grind 169 o NeetCode 150?", with one line on each.
- After the answer: `pnpm -s study curriculum expand <list> --json`, then `pnpm -s today --json --refresh`. With `imported: 0`, offer the import (SKILL.md §8); until then the plan holds reviews only.
