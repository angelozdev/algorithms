---
id: arrays-and-strings/02
title: Letter shift
concept: arrays-and-strings
---
# Letter shift

## Statement

To keep tonight's setlist secret 🤫, shift every letter of `text` forward by `k` places in the alphabet, wrapping around after `z` (with `k = 1`, `z` becomes `a`). Uppercase letters stay uppercase and lowercase letters stay lowercase. Every other character (digits, spaces, punctuation) stays as it is. Return the shifted text.

**Examples**

- `text = "abc xyz", k = 1` → `"bcd yza"`
- `text = "Hello, World!", k = 3` → `"Khoor, Zruog!"`
- `text = "Zz9", k = 27` → `"Aa9"`

**Constraints:** `0 <= text.length <= 10^5` · `text` has printable ASCII characters only (codes 32 to 126) · `0 <= k <= 10^9`
