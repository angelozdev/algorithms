---
id: maps-and-sets/02
title: Lineups
concept: maps-and-sets
---
# Lineups

## Statement

A festival runs for several days 🎪; `days[d]` lists the bands that play on day `d` (a band may be listed twice on the same day by mistake). Return two lists: the bands that play on **every** day, and the bands that play on **exactly one** day. Sort each list alphabetically, in plain character order (`-` comes before every letter, so `b-side` comes before `ba`).

**Examples**

- `days = [["muse","blur"],["blur","oasis"],["blur","muse","muse"]]` → `[["blur"],["oasis"]]` (`muse` plays on two days)
- `days = [["a-ha"]]` → `[["a-ha"],["a-ha"]]`
- `days = [["x","y"],[]]` → `[[],["x","y"]]`

**Constraints:** `1 <= days.length <= 50` · `0 <= days[d].length <= 1000` · band names have 1 to 20 characters: lowercase English letters and `-`
