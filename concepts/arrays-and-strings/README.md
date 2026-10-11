---
slug: arrays-and-strings
title: Arrays and strings
requires: [big-o]
related: [two-pointers]
---
# Arrays and strings

## Intuition

An **array** (a Python `list`, a TypeScript `number[]`) is a row of numbered seats in a concert hall 🎭. Seat 57? Walk straight to it: reading or writing `nums[57]` costs the same as `nums[0]`, O(1). Adding a seat at the **end** is cheap too. But squeezing a new seat in at the **front** means every person stands up and moves one seat to the right: O(n).

A **string** is a row of characters, with one twist: in both Python and TypeScript it is **immutable** 🔒. Like a printed setlist, you never edit it in place: "changing" one letter builds a brand-new string. So build text from pieces (a list of parts, then one `join`) instead of gluing it together character by character.

Every character also has a **number**, its code, the way every key on a MIDI keyboard has a note number 🎹: `"a"` is 97, `"b"` is 98, … `"z"` is 122, and `"A"` is 65. Arithmetic on letters is arithmetic on those codes.

And a **grid** (a list of rows) is your dashboard layout 📊: `grid[row][col]`, rows first. Reading it "row by row" means left to right, top to bottom, like reading a page.

## Diagram

Indexes and slices:

```
index:     0    1    2    3    4
nums  = [ 10 , 20 , 30 , 40 , 50 ]
         ↑                      ↑
       nums[0]          nums[-1] (Python) / nums.at(-1) (TS)

nums[1:4]        → [20, 30, 40]   start included, end excluded — and it is a COPY
nums.slice(1, 4) → [20, 30, 40]   the same in TypeScript
```

A grid, row by row:

```
grid = [[1, 2, 3],        grid[0] → [1, 2, 3]     (a whole row)
        [4, 5, 6]]        grid[1][2] → 6          (row 1, column 2)

reading order: 1 → 2 → 3 → 4 → 5 → 6
```

Characters and codes:

```
"a"  97      "b"  98      …      "z"  122
"A"  65      "B"  66      …      "Z"   90
" "  32      "0"  48      "!"    33

ord("c") - ord("a")  → 2         "c".charCodeAt(0) - "a".charCodeAt(0)  → 2
chr(97 + 2)          → "c"       String.fromCharCode(97 + 2)            → "c"
```

## Signals

- "The element at position i", "the first k", "from index i to j": indexes and slices
- "Return a new array/string where each …": build the result in a list, then return it (or `join` it)
- "Letters", "uppercase/lowercase", "shift", "alphabet position": character codes
- "A grid", "a matrix", "rows and columns": nested lists, `grid[r][c]`
- "In place": you must change the given array instead of building a new one

## When it fails

- **Gluing strings in a loop:** `s = s + piece` can copy the whole string every time. Collect the pieces in a list and `"".join(pieces)` / `pieces.join("")` once.
- **Slices are copies:** `nums[1:]` inside a loop over `nums` turns O(n) into O(n²).
- **The shared-row trap:** in Python, `[[0] * 3] * 2` makes two references to *the same* row; changing one changes both. Use `[[0] * 3 for _ in range(2)]`. TypeScript's `new Array(2).fill([])` has the same trap: use `Array.from({ length: 2 }, () => [])`.
- **Off by one:** `range(a, b)` and `slice(a, b)` stop **before** `b`.
- **Negative indexes:** Python's `nums[-1]` is the last element; in TypeScript `nums[-1]` is `undefined`. Use `nums.at(-1)`.
- **Mixing types:** `"a" + 1` is `"a1"` in TypeScript and a `TypeError` in Python.

## Typical complexity

| Operation | Python | TypeScript | Cost |
|---|---|---|---|
| read or write by index | `nums[i]` | `nums[i]` | O(1) |
| add or remove at the end | `append`, `pop()` | `push`, `pop()` | O(1) (amortized) |
| add or remove at the front | `insert(0, x)`, `pop(0)` | `unshift`, `shift` | O(n) |
| search for a value | `x in nums`, `index` | `includes`, `indexOf` | O(n) |
| slice of length k | `nums[a:b]` | `slice(a, b)` | O(k) |
| join pieces of total length L | `"".join(parts)` | `parts.join("")` | O(L) |
| length | `len(s)` | `s.length` | O(1) |

## Template

Python:

```python
nums = [3, 1, 4]

for i, x in enumerate(nums):        # index and value together
    print(i, x)

doubled = []                        # build a new list
for x in nums:
    doubled.append(x * 2)

words = "  turn   up   music ".split()        # ["turn", "up", "music"]: split() with no argument skips runs of spaces
sizes = "-".join(str(len(w)) for w in words) # "4-2-5": each word's length, joined

rows, cols = 2, 3
grid = [[0] * cols for _ in range(rows)]    # each row is its own list
grid[1][2] = 7

position = ord("d") - ord("a")      # 3: the letter's place in the alphabet
letter = chr(ord("a") + position)   # "d" again
```

TypeScript:

```ts
const nums = [3, 1, 4];

nums.forEach((x, i) => console.log(i, x)); // index and value together

const doubled: number[] = []; // build a new array
for (const x of nums) doubled.push(x * 2);

const words = "  turn   up   music ".trim().split(/\s+/); // ["turn", "up", "music"]
const sizes = words.map((w) => String(w.length)).join("-"); // "4-2-5": each word's length, joined

const rows = 2;
const cols = 3;
const grid = Array.from({ length: rows }, () => new Array<number>(cols).fill(0)); // each row is its own array
grid[1][2] = 7;

const position = "d".charCodeAt(0) - "a".charCodeAt(0); // 3
const letter = String.fromCharCode("a".charCodeAt(0) + position); // "d" again
```

One TypeScript catch: `"".trim().split(/\s+/)` returns `[""]`, not `[]`.

## Exercises

<!-- auto:exercises -->
- [01 · Regroup](exercises/01-regroup/README.md)
- [02 · Letter shift](exercises/02-letter-shift/README.md)
- [03 · Headline case](exercises/03-headline/README.md)
<!-- /auto -->

## Quick checks

1. Why does adding at the front (`insert(0, x)`, `unshift`) cost O(n), while adding at the end costs O(1)?
2. What goes wrong with `grid = [[0] * 3] * 2` after `grid[0][0] = 5`?
3. A grid has `cols` columns and you number its cells 0, 1, 2… row by row. In which row and column does cell number `k` sit?
4. Strings are immutable. What does that mean for code that changes one letter of a long string a thousand times?

## My explanation

<!-- Write this yourself, in your own words. Claude never fills this section. -->

## Problems

<!-- auto:problems -->
_No problems yet._
<!-- /auto -->
