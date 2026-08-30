import { LegalPageShell } from "./LegalPageShell";
import { PolicyNotes } from "./PolicyNotes";
import { PolicySections } from "./PolicySections";
import type { PolicyPageContent } from "./types";

/**
 * A whole policy page — shipping, returns, terms, privacy or cookies — built
 * from its content module.
 *
 * All five had byte-identical markup in the SPA and differed only in copy, the
 * heading icon and whether they carried a "Last updated" line, so the route
 * files are left holding metadata and structured data alone.
 *
 * FAQ deliberately does not go through here: its card list uses different
 * classes and its closing note has no icon.
 */
export function PolicyPage({ content }: { content: PolicyPageContent }) {
  return (
    <LegalPageShell header={content.header}>
      <PolicySections sections={content.sections} />
      <PolicyNotes notes={content.notes} />
    </LegalPageShell>
  );
}
