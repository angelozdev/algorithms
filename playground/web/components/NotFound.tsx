import { Link } from "@tanstack/react-router";
import { SearchX } from "lucide-react";

export function NotFound({ message }: { message?: string }) {
  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-2 p-10 text-center">
      <SearchX aria-hidden className="size-8 text-muted-foreground" />
      <h1 className="text-lg font-semibold">Not found</h1>
      <p className="text-sm text-muted-foreground">{message ?? "This page does not exist."}</p>
      <Link to="/" className="mt-2 text-sm text-primary underline underline-offset-2">
        Back to Algorithms
      </Link>
    </main>
  );
}
