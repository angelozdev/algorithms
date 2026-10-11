---
slug: maps-and-sets
title: Maps and sets
requires: [big-o, arrays-and-strings]
related: [hash-map]
---
# Maps and sets

## Intuition

A **map** (Python `dict`, TypeScript `Map`) is the channel strip of a mixing console 🎚️: every fader has a label (`"vocals"`, `"kick"`), and you reach a fader by its **label**, not by counting positions. Labels are unique; asking for one is O(1) on average, however many channels there are. You already use the idea in frontend code: feature flags, `localStorage`, a `usersById` lookup.

A **set** (Python `set`, TypeScript `Set`) is the guest list at the door 🎟️: a name is on it or it is not. No duplicates, and "is this name on the list?" is also O(1) on average. That is the big difference with a list, where `x in my_list` reads the list from the start.

This note is about **using** them fluently in both languages: creating, reading safely, updating, deleting, iterating, combining sets, and choosing keys. *Why* the lookup is O(1) (hashing, buckets and collisions), and the problem patterns built on it, come with the [hash map](../hash-map/README.md) concept.

## Diagram

A map from channel to volume:

```
volumes = { "vocals": 7, "kick": 9 }

volumes["bass"] = 5        insert     { vocals: 7, kick: 9, bass: 5 }
volumes["kick"] = 6        overwrite  { vocals: 7, kick: 6, bass: 5 }
volumes.pop("vocals")      delete     { kick: 6, bass: 5 }
"kick" in volumes          → True     (looks at the KEYS)
6 in volumes               → False    (6 is a value, not a key)
volumes.get("pads", 0)     → 0        (a default instead of a KeyError)
```

Two sets and the three regions between them:

```
a = {"red", "green", "blue"}        b = {"blue", "black"}

   only in a        in both        only in b
 ┌────────────┐   ┌────────┐   ┌───────────┐
 │ red  green │   │  blue  │   │   black   │
 └────────────┘   └────────┘   └───────────┘
     a - b           a & b         b - a          a | b = all four colors
```

## Signals

- "Look up by name / id / key": a map instead of searching a list
- "Unique", "distinct", "remove duplicates": a set
- "Is x one of these?", asked many times: a set (O(1)) instead of `in list` (O(n))
- "In both", "in either", "in one but not the other": set operations
- A key made of several parts (a cell `(row, col)`, a pair of names): a composite key

## When it fails

- **Reading a missing key:** Python's `d["x"]` raises `KeyError`; use `d.get("x", default)` or check `"x" in d` first. TypeScript's `m.get("x")` returns `undefined`.
- **Changing a dict while you loop over it:** Python raises `RuntimeError`. Loop over `list(d)` (a copy of the keys) when you need to delete.
- **Keys must be immutable in Python:** a `list` cannot be a key or a set element; a `tuple` can: `seen.add((row, col))`.
- **TypeScript compares object keys by identity:** `new Set([[0, 1]]).has([0, 1])` is `false`, because they are two different arrays. Build a string key: `` `${row},${col}` ``.
- **Plain objects are not maps:** `{}` turns every key into a string and already "has" keys such as `"constructor"`; setting `obj["__proto__"]` does not even store a value. Use `Map` and `Set` for data.
- **Order:** both languages iterate in **insertion** order, never in sorted order. Sort the keys when the output must be sorted.

## Typical complexity

| Operation | Python | TypeScript | Average cost |
|---|---|---|---|
| insert or overwrite | `d[k] = v` | `m.set(k, v)` | O(1) |
| read | `d[k]`, `d.get(k, default)` | `m.get(k)` | O(1) |
| delete | `d.pop(k, None)`, `del d[k]` | `m.delete(k)` | O(1) |
| membership | `k in d`, `x in s` | `m.has(k)`, `s.has(x)` | O(1) |
| size | `len(d)` | `m.size` | O(1) |
| build a set from n items | `set(items)` | `new Set(items)` | O(n) |
| intersection / union / difference | `a & b`, `a \| b`, `a - b` | filter over one set, `has` on the other | O(size of the sets) |

Worst cases can be O(n) per operation, but with the built-in types you can count on O(1).

## Template

Python:

```python
volumes: dict[str, int] = {}
volumes["kick"] = 9                 # insert or overwrite
volumes.get("snare", 0)             # 0: a default for a missing key
volumes.pop("kick", None)           # delete if present, no error otherwise

for channel, volume in volumes.items():   # keys and values, in insertion order
    print(channel, volume)

a = {"red", "green", "blue"}
b = {"blue", "black"}
a & b, a | b, a - b                 # intersection, union, difference
sorted(a)                           # a list, in alphabetical order

visited: set[tuple[int, int]] = set()
visited.add((2, 3))                 # a tuple key: (row, col)
(2, 3) in visited                   # True
```

TypeScript:

```ts
const volumes = new Map<string, number>();
volumes.set("kick", 9); // insert or overwrite
volumes.get("snare") ?? 0; // 0: a default for a missing key
volumes.delete("kick"); // false when it was not there; no error either way

for (const [channel, volume] of volumes) console.log(channel, volume); // insertion order

const a = new Set(["red", "green", "blue"]);
const b = new Set(["blue", "black"]);
const both = [...a].filter((x) => b.has(x)); // intersection
const either = new Set([...a, ...b]); // union
const onlyA = [...a].filter((x) => !b.has(x)); // difference
[...a].sort(); // an array, in alphabetical order

const visited = new Set<string>();
visited.add(`${2},${3}`); // a string key for (row, col)
visited.has("2,3"); // true
```

Node 22+ also has `a.intersection(b)`, `a.union(b)` and `a.difference(b)`, but this repo's TypeScript settings (`lib: ES2023`) do not declare them yet: use the filter form.

## Exercises

<!-- auto:exercises -->
- [01 · Settings](exercises/01-settings/README.md)
- [02 · Lineups](exercises/02-lineups/README.md)
- [03 · Robot trail](exercises/03-robot-trail/README.md)
<!-- /auto -->

## Quick checks

1. Why is `x in my_set` O(1) on average while `x in my_list` is O(n)? What does that mean inside a loop over 10⁵ items?
2. In Python, `"kick" in volumes` is `True` and `9 in volumes` is `False`, although 9 is stored. Why?
3. Why can't a Python `list` be a set element, and what do you use instead for a pair `(row, col)`? What about TypeScript?
4. You need the keys of a map in alphabetical order. Is the map's own order enough?

## My explanation

<!-- Write this yourself, in your own words. Claude never fills this section. -->

## Problems

<!-- auto:problems -->
_No problems yet._
<!-- /auto -->
