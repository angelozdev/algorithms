---
id: two-pointers/02
title: Hidden melody
concept: two-pointers
status: todo
hints: 0
solution_revealed: false
solved_in: []
---
# Hidden melody

## Statement

Each lowercase letter is a note 🎵. A `melody` is hidden in a `jam` session if you can delete some notes of `jam` (possibly none) without reordering the rest, and what remains is exactly `melody`. Return `true` if `melody` is hidden in `jam`, and `false` otherwise.

**Examples**

- `melody = "ace", jam = "abcde"` → `true`
- `melody = "aec", jam = "abcde"` → `false` (the notes are there, but not in that order)
- `melody = "", jam = "abc"` → `true`

**Constraints:** `0 <= melody.length, jam.length <= 10^5` · lowercase English letters

## Log

- 2026-09-28 · created
