---
slug: hash-map
title: Hash map
status: learning
requires: []
related: []
---
# Hash map

## Intuition

Think of the coat check at a concert 🎟️. You hand over your coat, you get ticket #42, and at the end of the night the attendant walks straight to hook 42 — nobody searches through every coat. A hash map does the same for data: the **key** is turned into a position (its *hash*), so "is this here?" and "what is stored for this key?" take about the same time whether you stored 10 items or 10 million.

You already use one in frontend code: `usersById[id]` instead of `users.find((u) => u.id === id)`. The `find` walks the whole list every time; the lookup jumps straight to the answer. 🎯

## Diagram

```
put("sol", 5)   hash("sol") % 8 = 6   →  bucket 6: [sol→5]
put("la", 6)    hash("la")  % 8 = 2   →  bucket 2: [la→6]
put("do", 1)    hash("do")  % 8 = 6   →  bucket 6: [sol→5, do→1]   ← collision: both share bucket 6

buckets   0     1     2        3     4     5     6               7
        [   ] [   ] [la→6]  [   ] [   ] [   ] [sol→5, do→1]  [   ]

get("la")  → hash → bucket 2 → found in one step
get("re")  → hash → bucket 4 → empty → "not here", also one step
```

## Signals

- "Have I seen this value before?" (duplicates, the first repeat, pairs)
- "How many times does each … appear?" (frequencies, anagrams, majority)
- "Find two elements that …" where checking every pair would be O(n²)
- "Group the items by …" (same letters, same key)
- A nested loop whose inner loop only *searches* for something

## When it fails

- **Order matters:** a hash map keeps no order by value. "The k-th smallest" or "the next bigger value" needs sorting or a heap, not hashing.
- **Keys must be hashable and stable:** a Python `list` cannot be a key (use a `tuple`); in JavaScript two different arrays `[1, 2]` are two different `Map` keys, so build a string key first.
- **Memory:** you trade space for time. With 10^8 items, the extra O(n) memory may not fit.

## Typical complexity

| Operation | Average | Worst case (many collisions) |
|---|---|---|
| insert / lookup / delete | O(1) | O(n) |
| build from n items | O(n) | O(n²) |
| extra space | O(n) | O(n) |

With the built-in `dict` / `Map` / `Set`, treat single operations as O(1) in practice.

## Template

Counting occurrences — Python:

```python
def count(items: list[str]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for item in items:
        counts[item] = counts.get(item, 0) + 1
    return counts
```

Counting occurrences — TypeScript:

```ts
function count(items: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return counts;
}
```

Membership with a set — Python and TypeScript:

```python
seen: set[str] = set()
seen.add("do")
"do" in seen   # True, O(1) on average
```

```ts
const seen = new Set<string>();
seen.add("do");
seen.has("do"); // true, O(1) on average
```

## Exercises

<!-- auto:exercises -->
- ○ [01 · First repeat](exercises/01-first-repeat/README.md)
- ○ [02 · Most frequent](exercises/02-most-frequent/README.md)
- ○ [03 · Same letters](exercises/03-same-letters/README.md)
<!-- /auto -->

## Quick checks

1. Why is `x in my_list` O(n) but `x in my_set` O(1) on average?
2. You must count how often each word appears in a one-million-word text. What would the keys and the values be?
3. Why can't a Python `list` be a dictionary key, and what would you use instead?
4. Name one problem where a hash map is the *wrong* tool, and say why.

## My explanation

<!-- Write this yourself, in your own words. Claude never fills this section. -->

## Problems

<!-- auto:problems -->
- ✓ [lc-0001 · Two Sum](../../problems/lc-0001-two-sum/README.md)
<!-- /auto -->
