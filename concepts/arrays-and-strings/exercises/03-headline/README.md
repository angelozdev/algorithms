---
id: arrays-and-strings/03
title: Headline case
concept: arrays-and-strings
---
# Headline case

## Statement

A chart title arrives messy from an IoT device 📟. Its words are separated by one or more spaces, and there may be spaces at the start and at the end. Return the words joined by single spaces, each one with its first character in uppercase and the rest in lowercase. A first character that is a digit stays as it is.

**Examples**

- `text = "  live   SENSOR data "` → `"Live Sensor Data"`
- `text = "iOT"` → `"Iot"`
- `text = "   "` → `""`

**Constraints:** `0 <= text.length <= 10^4` · `text` has English letters, digits and spaces only
