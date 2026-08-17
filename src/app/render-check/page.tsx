import type { Metadata } from "next";

import { queryScalar } from "@/server/db/query";

/**
 * Phase 1 proving route.
 *
 * It exists to confirm four things on the real server after a deploy, without
 * touching any page a customer can reach: Next renders inside the Express
 * process, it reaches MySQL through the pool Express already opened, the shared
 * Tailwind theme resolves, and the deploy pipeline builds .next at all.
 *
 * It is removed in the final phase once those facts are no longer in question.
 */
export const metadata: Metadata = {
  title: "Render check",
  robots: { index: false, follow: false },
};

// Always render on request — a cached answer would prove nothing about the
// database connection at the moment it is read.
export const dynamic = "force-dynamic";

type Check = { label: string; value: string; ok: boolean };

const runChecks = async (): Promise<Check[]> => {
  const checks: Check[] = [
    { label: "Server rendering", value: "React Server Component rendered", ok: true },
  ];

  try {
    const version = await queryScalar<string>("SELECT VERSION() AS v");
    const productCount = await queryScalar<number>(
      "SELECT COUNT(*) AS c FROM products WHERE is_active = 1 AND deleted_at IS NULL",
    );
    checks.push(
      { label: "Database pool", value: `MySQL ${version ?? "unknown"}`, ok: Boolean(version) },
      { label: "Catalog read", value: `${productCount ?? 0} active products`, ok: productCount !== null },
    );
  } catch (error) {
    // Surface the failure on the page rather than throwing: this route's job is
    // to report status, and a 500 would hide which check failed.
    checks.push({
      label: "Database pool",
      value: error instanceof Error ? error.message : "unknown error",
      ok: false,
    });
  }

  return checks;
};

export default async function RenderCheckPage() {
  const checks = await runChecks();
  const allPassed = checks.every((check) => check.ok);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-foreground">Next.js render check</h1>
        <p className="text-sm text-muted-foreground">
          Internal diagnostic for the migration. Not linked from the site and not indexed.
        </p>
      </header>

      <ul className="flex flex-col gap-2">
        {checks.map((check) => (
          <li
            key={check.label}
            className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3"
          >
            <span className="text-sm font-medium text-card-foreground">{check.label}</span>
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              {check.value}
              <span
                aria-hidden="true"
                className={`inline-block h-2 w-2 rounded-full ${check.ok ? "bg-primary" : "bg-destructive"}`}
              />
              <span className="sr-only">{check.ok ? "passed" : "failed"}</span>
            </span>
          </li>
        ))}
      </ul>

      <p className={`text-sm font-semibold ${allPassed ? "text-primary" : "text-destructive"}`}>
        {allPassed ? "All checks passed." : "One or more checks failed."}
      </p>
    </main>
  );
}
