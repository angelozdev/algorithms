# AGENTS.md - Guidelines for AI Coding Agents

This document provides instructions for AI coding agents working in this multi-language algorithms repository containing LeetCode solutions and data structures in TypeScript, Rust, Python, and Swift.

## Repository Structure

```
algorithms/
├── python/          # Python 3.13+ solutions
├── rust/            # Rust 2021 edition solutions  
├── swift/           # Swift solutions
└── ts/src/          # TypeScript solutions
    ├── leetcode/         # LeetCode solutions
    └── data-structures/  # Reusable data structures with tests
```

## Build, Test, and Lint Commands

### TypeScript (working directory: `ts/`)
| Command | Description |
|---------|-------------|
| `pnpm dev` | Watch mode on `./src/index.ts` |
| `pnpm run tsx <file>` | Run a specific file |
| `npx vitest` | Run all tests |
| `npx vitest <pattern>` | Run single test (e.g., `npx vitest ring-buffer`) |

### Rust (working directory: `rust/`)
| Command | Description |
|---------|-------------|
| `cargo run --bin <name>` | Run specific binary (e.g., `cargo run --bin 1_two_sum`) |
| `cargo test` | Run all tests |
| `cargo test <name>` | Run single test (e.g., `cargo test two_sum`) |
| `cargo fmt` | Format code |
| `cargo clippy` | Lint code |

### Python (working directory: `python/`)
| Command | Description |
|---------|-------------|
| `python <file>` | Run a file (tests run via `if __name__ == "__main__"`) |
| `ruff check .` | Lint all files |
| `ruff format .` | Format all files |

### Swift (working directory: `swift/`)
| Command | Description |
|---------|-------------|
| `swift <file>` | Run a Swift file directly |

## File Naming Convention

All files: `{problem_number}_{problem_name_snake_case}.{ext}`
Examples: `1_two_sum.ts`, `9_palindrome_number.py`, `2807_insert_greatest_common_divisors.swift`

## Code Style Guidelines

### TypeScript
```typescript
import { log } from "console";
import assert from "node:assert";

export default function twoSum(nums: number[], target: number): number[] {
  const map = new Map<number, number>();
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (map.has(complement)) return [map.get(complement)!, i];
    map.set(nums[i], i);
  }
  throw new Error("No solution found");
}
```
- `export default` for main solution functions
- Explicit type annotations on all parameters and returns
- camelCase for functions/variables, PascalCase for classes/types
- `throw new Error()` for exceptional cases; `!` for guaranteed non-null
- Vitest for data structures (`*.test.ts`), inline `assert` for algorithms

### Python
```python
class Solution:
    def twoSum(self, nums: list[int], target: int) -> list[int]:
        seen: dict[int, int] = {}
        for i, num in enumerate(nums):
            complement = target - num
            if complement in seen:
                return [seen[complement], i]
            seen[num] = i
        raise ValueError("No solution found")

if __name__ == "__main__":
    s = Solution()
    assert s.twoSum([2, 7, 11, 15], 9) == [0, 1]
```
- Uses Ruff with line-length 88, Python 3.13+
- Modern type hints: `list[int]`, `dict[str, int]` (NOT `List`, `Dict`)
- camelCase for methods (LeetCode style), snake_case for local variables
- Test with `assert` in `if __name__ == "__main__"` block

### Rust
```rust
pub fn two_sum(nums: &[i32], target: i32) -> Option<(usize, usize)> {
    use std::collections::HashMap;
    let mut seen: HashMap<i32, usize> = HashMap::new();
    for (i, &num) in nums.iter().enumerate() {
        if let Some(&j) = seen.get(&(target - num)) {
            return Some((j, i));
        }
        seen.insert(num, i);
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn test_two_sum() {
        assert_eq!(two_sum(&[2, 7, 11, 15], 9), Some((0, 1)));
    }
}
```
- snake_case for functions/variables, PascalCase for types/structs
- Return `Option<T>` or `Result<T, E>` for fallible operations
- Use `&[T]` slice references for array parameters
- Prefer iterators over manual loops

### Swift
```swift
class Solution {
    func twoSum(_ nums: [Int], _ target: Int) -> [Int] {
        var seen: [Int: Int] = [:]
        for (i, num) in nums.enumerated() {
            if let j = seen[target - num] { return [j, i] }
            seen[num] = i
        }
        return []
    }
}
```
- camelCase for functions/variables, PascalCase for classes
- Use `if let` for optional unwrapping
- Range syntax: `0 ..< n` (spaces around operator)

## General Guidelines

1. **Prefer editing existing files** over creating new ones
2. **Follow existing patterns** in the codebase
3. **Run tests** after changes: `npx vitest` (TS), `cargo test` (Rust), `python <file>` (Python)
4. **Format code** before committing: `ruff format .` (Python), `cargo fmt` (Rust)
5. **Add inline tests** for new algorithm solutions
6. **Use strong typing** - no `any` in TypeScript, explicit types everywhere

## Adding New Solutions

1. Create file with correct naming: `{number}_{name}.{ext}`
2. Follow the language-specific structure above
3. Add test cases (inline or in test module)
4. Verify solution runs without errors

## Common Patterns

**LeetCode Solution Structure:**
- Python/Swift: `class Solution` wrapper with methods
- TypeScript: `export default function`
- Rust: Standalone `pub fn` or `impl Solution`

**Testing Approach:**
- TypeScript data structures: Vitest (`describe`/`it`/`expect`)
- TypeScript algorithms: inline `assert` or `console.log`
- Python: `assert` in `if __name__ == "__main__"` block
- Rust: `#[cfg(test)] mod tests` with `#[test]` functions
- Swift: Print statements for manual verification
