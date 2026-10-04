import { type Difficulty, difficultyLabel, difficultyOf } from "../lib/labels.ts";
import { Badge } from "./ui/badge.tsx";

const VARIANT: Record<Difficulty, "success" | "warning" | "destructive"> = { easy: "success", medium: "warning", hard: "destructive" };

export function DifficultyBadge({ difficulty }: { difficulty: string | null }) {
  const known = difficultyOf(difficulty);
  if (!known) return null;
  return <Badge variant={VARIANT[known]}>{difficultyLabel(known)}</Badge>;
}
