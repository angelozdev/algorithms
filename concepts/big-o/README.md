---
slug: big-o
title: Big-O
requires: []
related: [recursion, sorting]
---
# Big-O

## Intuition

Your IoT dashboard is snappy with 10 sensors. Then a client plugs in 10,000, and the page freezes 🥶. The code did not change; the **input grew**. Big-O is the habit of asking, before you run anything: *if the input doubles, what happens to the work?*

Think of a band rehearsing a setlist 🎸. Playing every song once grows with the number of songs: twice the songs, twice the time. Having **every pair of musicians** run a duet grows much faster: twice the musicians, four times the duets. Big-O names that growth: O(n) for the first, O(n²) for the second. It ignores the tempo (constants such as "each song takes 4 minutes") and keeps only the shape of the curve, because for large inputs the shape is what decides whether your code finishes.

Three counting rules cover most code:
- **Steps in a row add up** ➕: a loop over n, then another loop over n, is n + n = O(n).
- **Steps inside steps multiply** ✖️: a loop over n inside a loop over n is n × n = O(n²).
- **Halving gives a logarithm** ✂️: cutting n in half until 1 is left takes about log₂ n steps. log₂ of 1,000,000 is only about 20.

## Diagram

How the work grows (rounded) as n grows:

```
n             O(1)   O(log n)   O(n)        O(n log n)    O(n²)            O(2ⁿ)
10            1      3          10          33            100              1,024
1,000         1      10         1,000       9,966         1,000,000        ≈ 10³⁰¹  💥
1,000,000     1      20         1,000,000   19,931,569    10¹²  💥          —
```

Counting the steps of nested loops:

```
for i in range(n):          ← the outer body runs n times
    for j in range(n):      ← for EACH i, this body runs n times
        work()              → work() runs n × n = n² times

size = n
while size > 1:             ← n, n/2, n/4, … 2: about log₂ n rounds
    size = size // 2
```

## Signals

- The statement gives **constraints** such as `n <= 10^5`: they tell you which growth will fit in time (see the table below)
- "Correct on the examples, but it times out"
- A loop inside a loop, or a function that loops (`x in my_list`, `includes`, `indexOf`, `slice`) called inside a loop
- Something is cut in half again and again
- A function that calls itself more than once

## When it fails

- **Big-O hides constants.** O(n) with a heavy step (a network call, a 50 ms render) can lose to O(n log n) with tiny steps. For small n, the "worse" algorithm is often faster.
- **Average is not worst case.** Some operations are O(1) on average but O(n) in rare bad cases.
- **Hidden loops count.** `if x in my_list:` looks like one line, but it scans the list: inside a loop over n items it makes the whole thing O(n²). The same goes for `list.pop(0)`, `nums.shift()`, slicing, and copying with `[...nums]`.
- **Python is slower per step than TypeScript.** The same O(n) loop can take ten times longer in Python. Big-O tells you the shape, not the seconds.

## Typical complexity

The rule of thumb: a judge runs roughly 10⁸ simple steps per second. So the constraints suggest a target:

| Largest n | Growth that usually fits | Typical example |
|---|---|---|
| ≤ 10 | O(n!) | every ordering of the items |
| ≤ 20 | O(2ⁿ) | every subset of the items |
| ≤ 500 | O(n³) | three nested loops |
| ≤ 10⁴ | O(n²) | two nested loops |
| ≤ 10⁶ | O(n log n) | sorting, then one pass |
| ≤ 10⁸ | O(n) | one pass |
| larger | O(log n) or O(1) | halving, or a formula |

**Space** counts the same way: the extra memory your code allocates (a copy of the input is O(n), a few variables are O(1)).

## Template

A doubling experiment: run your function on n, 2n, 4n… and look at how the time grows. About ×2 per doubling means O(n), about ×4 means O(n²), and about ×1 means O(log n) or O(1).

Python:

```python
import time

def measure(f, sizes):
    previous = None
    for n in sizes:
        data = list(range(n))
        start = time.perf_counter()
        f(data)
        elapsed = time.perf_counter() - start
        growth = f"×{elapsed / previous:.1f}" if previous else ""
        print(f"n={n:>9,}  {elapsed * 1000:9.2f} ms  {growth}")
        previous = elapsed

def total(items: list[int]) -> int:  # one pass: O(n)
    result = 0
    for x in items:
        result += x
    return result

measure(total, [250_000, 500_000, 1_000_000, 2_000_000])
```

TypeScript:

```ts
function measure(f: (data: number[]) => unknown, sizes: number[]): void {
  let previous = 0;
  for (const n of sizes) {
    const data = Array.from({ length: n }, (_, i) => i);
    const start = performance.now();
    f(data);
    const elapsed = performance.now() - start;
    const growth = previous ? `×${(elapsed / previous).toFixed(1)}` : "";
    console.log(`n=${n.toLocaleString().padStart(9)}  ${elapsed.toFixed(2).padStart(9)} ms  ${growth}`);
    previous = elapsed;
  }
}

function total(items: number[]): number { // one pass: O(n)
  let result = 0;
  for (const x of items) result += x;
  return result;
}

measure(total, [250_000, 500_000, 1_000_000, 2_000_000]);
```

Tiny inputs are noisy (a few microseconds): use sizes large enough to take a few milliseconds.

## Exercises

<!-- auto:exercises -->
- [01 · Pair ticks](exercises/01-pair-ticks/README.md)
- [02 · Halving ticks](exercises/02-halving-ticks/README.md)
- [03 · Fits the budget](exercises/03-fits-budget/README.md)
<!-- /auto -->

## Quick checks

1. A loop over n items, followed by a separate loop over the same n items: what is the total, in Big-O? And if the second loop sits *inside* the first?
2. Why is `if x in my_list:` inside a `for` loop over n items O(n²), and not O(n)?
3. A statement says `1 <= n <= 10^5`. Is an O(n²) solution likely to finish in time? Why?
4. Big-O turns 3n + 5 steps into O(n). Why is it fine to drop the 3 and the 5, and when could they still matter?

## My explanation

<!-- Write this yourself, in your own words. Claude never fills this section. -->

## Problems

<!-- auto:problems -->
_No problems yet._
<!-- /auto -->
