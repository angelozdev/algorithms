---
id: maps-and-sets/01
title: Settings
concept: maps-and-sets
---
# Settings

## Statement

A web app saves user settings as a log of changes ⚙️: change `i` sets the setting `keys[i]` to `values[i]`. An **empty** value means "remove this setting" (removing a setting that is not there does nothing). Apply the changes in order and return the final settings as strings `"<key>=<value>"`, in any order.

**Examples**

- `keys = ["theme","lang","theme"], values = ["dark","es","light"]` → `["theme=light","lang=es"]`
- `keys = ["beta","beta"], values = ["on",""]` → `[]`
- `keys = ["units"], values = [""]` → `[]`

**Constraints:** `0 <= keys.length == values.length <= 10^5` · keys have 1 to 20 characters, values 0 to 20 · both use lowercase and uppercase English letters, digits, `-` and `_`
