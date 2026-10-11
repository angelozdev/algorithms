import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ellipsis, Eraser, Trash2, Undo2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { ResetAction, TargetData } from "../../server/types.ts";
import { getResetPreview, keys, postReset } from "../api.ts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog.tsx";
import { Button } from "../components/ui/button.tsx";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../components/ui/dropdown-menu.tsx";
import { Input } from "../components/ui/input.tsx";

const EXAM_LOCK = "Exam attempts are kept: only the code can be cleaned.";
const DONE: Record<ResetAction, string> = {
  code: "Code cleaned: the old version is in the history.",
  attempt: "Attempt discarded.",
  all: "Erased: back to its first day.",
};
const count = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** A menu item's label, with the reason it is off under it. */
function ItemText({ text, off }: { text: string; off: string | null }) {
  return (
    <span className="flex flex-col">
      {text}
      {off && <span className="text-[0.625rem] text-muted-foreground">{off}</span>}
    </span>
  );
}

/**
 * The work page's "⋯" menu (item reset spec §5.2): Clean code at once, Discard attempt after a dialog, Erase everything
 * after typing the id. `prepare` saves the editor's text first, so Clean code archives what the user sees.
 */
export function ResetMenu({ target, prepare, onReset }: { target: TargetData; prepare(): Promise<unknown>; onReset(): void }) {
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirm, setConfirm] = useState<"attempt" | "all" | null>(null);
  const [typed, setTyped] = useState("");
  const preview = useQuery({
    queryKey: keys.reset(target.id),
    queryFn: () => getResetPreview(target.id),
    enabled: menuOpen || confirm !== null,
    staleTime: 0,
  });
  const reset = useMutation({
    mutationFn: async (action: ResetAction) => {
      await prepare();
      return postReset(target.id, action);
    },
    onSuccess: ({ action }) => {
      for (const queryKey of [keys.targets, keys.home, keys.today, keys.concepts, keys.reset(target.id)]) void queryClient.invalidateQueries({ queryKey });
      toast(DONE[action]);
      onReset();
    },
    onError: (error) => toast.error(error.message),
  });
  const p = preview.data;
  // "" while the preview loads: off, with no reason yet.
  const discardOff = !p ? "" : p.examLocked ? EXAM_LOCK : p.open ? null : "No attempt is open.";
  const eraseOff = !p ? "" : p.examLocked ? EXAM_LOCK : null;
  const closeDialog = (open: boolean) => {
    if (open) return;
    setConfirm(null);
    setTyped("");
  };
  return (
    <>
      {/* Not modal: a modal menu that opens a dialog can leave pointer-events: none on the body. */}
      <DropdownMenu modal={false} open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Reset options" disabled={reset.isPending}>
            <Ellipsis aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuItem disabled={reset.isPending} onSelect={() => reset.mutate("code")}>
            <Eraser aria-hidden />
            <ItemText text="Clean code" off={null} />
          </DropdownMenuItem>
          <DropdownMenuItem disabled={discardOff !== null || reset.isPending} onSelect={() => setConfirm("attempt")}>
            <Undo2 aria-hidden />
            <ItemText text="Discard attempt" off={discardOff} />
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" disabled={eraseOff !== null || reset.isPending} onSelect={() => setConfirm("all")}>
            <Trash2 aria-hidden />
            <ItemText text="Erase everything" off={eraseOff} />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={confirm === "attempt"} onOpenChange={closeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this attempt?</AlertDialogTitle>
            <AlertDialogDescription>
              You lose {count(p?.open?.hints ?? 0, "hint")} and {p?.open?.minutes ?? 0} min of this attempt. Your code goes to the history and the editor starts with a fresh stub.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={reset.isPending} onClick={() => reset.mutate("attempt")}>
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={confirm === "all"} onOpenChange={closeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Erase {target.id}?</AlertDialogTitle>
            <AlertDialogDescription>
              This erases {count(p?.attempts ?? 0, "attempt")}, {count(p?.hints ?? 0, "hint")}, its review schedule and {count(p?.versions ?? 0, "saved version")}. It cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="flex flex-col gap-1.5">
            <span>
              Type <code className="font-mono">{target.id}</code> to confirm
            </span>
            <Input value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" spellCheck={false} />
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={typed !== target.id || reset.isPending} onClick={() => reset.mutate("all")}>
              Erase
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
