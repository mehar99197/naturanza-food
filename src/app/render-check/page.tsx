import type { Metadata } from "next";

import { runChecks } from "@/server/diagnostics/checks";

/**
 * Migration diagnostic.
 *
 * It confirms on the real server, without touching a page a customer can reach,
 * that Next renders inside the Express process, reaches MySQL through the pool
 * Express already opened, and that the catalog, blog, pricing and structured-data
 * modules the migrated pages depend on all work against live data.
 *
 * Removed in the final phase, once those facts are no longer in question.
 */
export const metadata: Metadata = {
  title: "Render check",
  robots: { index: false, follow: false },
};

// Always render on request — a cached answer would prove nothing about the
// database at the moment it is read.
export const dynamic = "force-dynamic";

export default async function RenderCheckPage() {
  const checks = await runChecks();
  const failed = checks.filter((check) => !check.ok);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-foreground">Next.js render check</h1>
        <p className="text-sm text-muted-foreground">
          Internal migration diagnostic. Not linked from the site and not indexed.
        </p>
      </header>

      <ul className="flex flex-col gap-2">
        {checks.map((check) => (
          <li
            key={check.label}
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg border border-border bg-card px-4 py-3"
          >
            <span className="text-sm font-medium text-card-foreground">{check.label}</span>
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              {check.value}
              <span
                aria-hidden="true"
                className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                  check.ok ? "bg-primary" : "bg-destructive"
                }`}
              />
              <span className="sr-only">{check.ok ? "passed" : "failed"}</span>
            </span>
          </li>
        ))}
      </ul>

      <p className={`text-sm font-semibold ${failed.length ? "text-destructive" : "text-primary"}`}>
        {failed.length
          ? `${failed.length} of ${checks.length} checks failed.`
          : `All ${checks.length} checks passed.`}
      </p>
    </main>
  );
}
