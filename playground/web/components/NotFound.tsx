import { Link } from "@tanstack/react-router";

export function NotFound({ message }: { message?: string }) {
  return (
    <main className="mx-auto max-w-md p-10 text-center">
      <h1 className="text-lg font-semibold">Not found</h1>
      <p className="mt-2 text-sm text-neutral-500">{message ?? "This page does not exist."}</p>
      <Link to="/" className="mt-4 inline-block text-sm underline">
        Back to the home page
      </Link>
    </main>
  );
}
