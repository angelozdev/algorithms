import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BookOpen, Circle, CircleCheck, Megaphone, Pause, Play, TriangleAlert } from "lucide-react";
import type { AnnouncementJson, TodayItem, TodayJson } from "../../server/types.ts";
import { ackAnnouncement, keys, pauseStudy, resumeStudy, type TodayData, todayQuery } from "../api.ts";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert.tsx";
import { Badge } from "../components/ui/badge.tsx";
import { Button } from "../components/ui/button.tsx";
import { Skeleton } from "../components/ui/skeleton.tsx";
import { listLabel, PATTERN_LABELS, phaseLabel } from "../lib/labels.ts";
import { targetLink } from "../links.ts";
import { SectionTitle } from "./SectionTitle.tsx";

const KIND_LABEL: Record<TodayItem["kind"], string> = { continue: "Continue", review: "Review", new: "New", concept: "Concept", exam: "Exam" };
const MODE_LABEL: Record<TodayJson["mode"], string | null> = { normal: null, return: "Welcome back", "catch-up": "Catch-up day" };

/** The announcement as one sentence (spec §6.1: the message is rendered from the rows it references). */
export function announcementText(announcement: AnnouncementJson): string {
  const p = announcement.payload as Record<string, unknown>;
  const phase = (value: unknown) => phaseLabel(String(value));
  switch (announcement.key) {
    case "coach-started":
      return `The coach started you on ${listLabel(String(p.preset))}, at phase ${phase(p.phase)}.`;
    case "phase-advanced":
      return `New phase: ${phase(p.to)}. You finished ${phase(p.from)}.`;
    case "phase-set":
      return `Phase set to ${phase(p.to)}.`;
    case "curriculum-switched": {
      const to = p.to as { preset: string; phase: string };
      return `Switched to ${listLabel(to.preset)}: phase ${phase(to.phase)}.`;
    }
    case "welcome-back":
      return `Welcome back after ${String(p.daysAway)} days! Today starts with the reviews you are most likely to remember.`;
  }
}

/** The engine's reason with pattern slugs as their names: "block 2/3 · arrays-hashing" → "block 2/3 · Arrays & hashing". */
export function reasonText(reason: string): string {
  return reason.replace(/[a-z0-9]+(?:-[a-z0-9]+)*/g, (word) => PATTERN_LABELS[word] ?? word);
}

function AnnouncementBanner({ announcement, onAck, busy }: { announcement: AnnouncementJson; onAck(id: number): void; busy: boolean }) {
  return (
    <Alert variant="success" role="status" className="mb-2">
      <Megaphone aria-hidden />
      <AlertDescription className="flex items-center gap-2">
        <span className="flex-1 text-foreground">{announcementText(announcement)}</span>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => onAck(announcement.id)}>
          Got it
        </Button>
      </AlertDescription>
    </Alert>
  );
}

/** Where a row leads: problems and exercises to their page (reviews and exams show the Start review gate there). */
function ItemTitle({ item }: { item: TodayItem }) {
  const label = `${item.id} ${item.title}`;
  if (item.missing) {
    return (
      <span className="font-medium">
        {item.title} <span className="font-normal text-muted-foreground">· not in the repo yet: ask Claude to create it</span>
      </span>
    );
  }
  if (item.kind === "concept") {
    return (
      <Link to="/c/$slug" params={{ slug: item.id }} aria-label={label} className="font-medium hover:text-primary">
        {item.title}
      </Link>
    );
  }
  return (
    <Link {...targetLink(item.id)} aria-label={label} className="font-medium hover:text-primary">
      {item.title}
    </Link>
  );
}

function TodayRow({ item }: { item: TodayItem }) {
  const Done = item.done ? CircleCheck : item.kind === "concept" ? BookOpen : Circle;
  return (
    <li className="flex items-center gap-3 border-b py-1.5 last:border-b-0">
      <span role="img" aria-label={item.done ? "Done" : "To do"} className={item.done ? "text-success" : "text-muted-foreground"}>
        <Done aria-hidden className="size-4" />
      </span>
      <Badge variant={item.kind === "review" || item.kind === "exam" ? "warning" : "outline"} className="w-16">
        {KIND_LABEL[item.kind]}
      </Badge>
      <span className="font-mono text-xs text-muted-foreground">{item.kind === "concept" ? "" : item.id}</span>
      <ItemTitle item={item} />
      <span className="ml-auto text-xs text-muted-foreground">{reasonText(item.reason)}</span>
      <span className="w-14 text-right font-mono text-xs text-muted-foreground">{item.minutes} min</span>
    </li>
  );
}

export interface TodayViewProps {
  data: TodayData;
  onAck(id: number): void;
  onPause(): void;
  onResume(): void;
  /** A request is on its way: the buttons wait. */
  busy: boolean;
}

/** The Today section (spec §11): what the coach planned for today, its announcements, and the pause button. */
export function TodayView({ data, onAck, onPause, onResume, busy }: TodayViewProps) {
  let body;
  if (!data.initialized) {
    body = (
      <p className="text-muted-foreground">
        Your progress is not set up yet. Run <code>{data.next === "migrate" ? "pnpm study migrate" : "pnpm study init"}</code>
        {data.next === "migrate" ? " (try --dry-run first) to move the progress in your READMEs to .study/." : ", then ask Claude “¿qué me toca hoy?”."}
      </p>
    );
  } else if (!data.started) {
    body = (
      <p className="text-muted-foreground">
        The coach has not started yet. Ask Claude “¿qué me toca hoy?”, or run <code>pnpm study curriculum set grind-75</code>.
      </p>
    );
  } else {
    const phase = data.phase!;
    const mode = MODE_LABEL[data.mode];
    const partial = phase.list && phase.list.size !== null && phase.list.imported < phase.list.size;
    body = (
      <>
        {data.announcements.map((announcement) => (
          <AnnouncementBanner key={announcement.id} announcement={announcement} onAck={onAck} busy={busy} />
        ))}
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>
            Phase {phaseLabel(phase.id)} · {phase.progress.done}/{phase.progress.total}
          </span>
          {mode && <Badge variant="secondary">{mode}</Badge>}
          <span className="ml-auto">
            {data.budget.planned} of {data.budget.minutes} min
          </span>
          {data.paused ? (
            <Button size="sm" variant="outline" disabled={busy} onClick={onResume}>
              <Play aria-hidden />
              Resume
            </Button>
          ) : (
            <Button size="sm" variant="ghost" disabled={busy} onClick={onPause}>
              <Pause aria-hidden />
              Pause
            </Button>
          )}
        </div>
        {partial && (
          <Alert variant="warning" className="mb-2">
            <TriangleAlert aria-hidden />
            <AlertDescription>
              Only {phase.list!.imported} of the {phase.list!.size} problems of {listLabel(phase.list!.list)} are imported.
            </AlertDescription>
          </Alert>
        )}
        {phase.expansion && phase.expansion.list === null && (
          <p className="mb-2 text-muted-foreground">Choose the list to expand with: ask Claude. Until then, only reviews are planned.</p>
        )}
        {data.paused ? (
          <p className="text-muted-foreground">Paused since {new Date(data.paused.since).toLocaleDateString()}. Due dates wait for you.</p>
        ) : data.items.length === 0 ? (
          <p className="text-muted-foreground">Nothing planned for today.</p>
        ) : (
          <ul aria-label="Today's plan" className="rounded-lg border bg-card px-3">
            {data.items.map((item) => (
              <TodayRow key={`${item.kind}:${item.id}`} item={item} />
            ))}
          </ul>
        )}
        {data.backlog.waiting > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            {data.backlog.waiting} more review(s) wait for the coming days (about {data.backlog.days} day(s)).
          </p>
        )}
      </>
    );
  }
  return (
    <section aria-labelledby="home-today" className="mb-8">
      <SectionTitle id="home-today">Today</SectionTitle>
      {body}
    </section>
  );
}

/** TodayView with its data and buttons; it refetches on the live `progress` event (events.tsx). */
export function TodaySection() {
  const today = useQuery(todayQuery());
  const queryClient = useQueryClient();
  const refresh = () => void queryClient.invalidateQueries({ queryKey: keys.today });
  const ack = useMutation({ mutationFn: ackAnnouncement, onSettled: refresh });
  const pause = useMutation({ mutationFn: pauseStudy, onSettled: refresh });
  const resume = useMutation({ mutationFn: resumeStudy, onSettled: refresh });
  if (today.isPending) return <Skeleton aria-label="Loading today" className="mb-8 h-24" />;
  if (today.isError) {
    return (
      <Alert variant="destructive" className="mb-8">
        <TriangleAlert aria-hidden />
        <AlertTitle>Could not load today's plan</AlertTitle>
        <AlertDescription>{today.error.message}</AlertDescription>
      </Alert>
    );
  }
  return (
    <TodayView
      data={today.data}
      busy={ack.isPending || pause.isPending || resume.isPending}
      onAck={(id) => ack.mutate(id)}
      onPause={() => pause.mutate()}
      onResume={() => resume.mutate()}
    />
  );
}
