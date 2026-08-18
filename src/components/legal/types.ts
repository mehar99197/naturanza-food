/**
 * Shapes for the static support/legal pages (FAQ, shipping, returns, terms,
 * privacy, cookies).
 *
 * The SPA versions were six near-identical files that each rebuilt the same
 * heading block, the same white card list and the same green note panel around
 * their own copy. Splitting the copy (these types, plus one `content` module per
 * page) from the markup (LegalPageShell / PolicySections / PolicyNotes) means a
 * wording change touches one array of strings and nothing else.
 *
 * `Icon` is capitalised because it is rendered as a component. lucide-react's
 * icons are plain SVG components with no hooks, so they render inside Server
 * Components — which is why these content modules can hold them directly and
 * every one of these pages still ships zero JavaScript.
 */

import type { LucideIcon } from "lucide-react";

/** The centred heading block every one of these pages opens with. */
export interface LegalHeader {
  Icon: LucideIcon;
  /** Small uppercase kicker above the title — "Support", "Legal", "Security". */
  eyebrow: string;
  title: string;
  intro: string;
  /**
   * Rendered verbatim, including the "Last updated: " prefix, because the
   * source hardcoded the whole sentence. Absent on FAQ, shipping and returns,
   * which never carried one.
   */
  lastUpdated?: string;
}

/** One white card: a bold question/heading over a paragraph of prose. */
export interface PolicySection {
  title: string;
  content: string;
}

/** One row of the green panel that closes each policy page. */
export interface PolicyNote {
  Icon: LucideIcon;
  text: string;
}

/** Everything a policy page renders. FAQ has its own list markup, so not this. */
export interface PolicyPageContent {
  header: LegalHeader;
  sections: readonly PolicySection[];
  notes: readonly PolicyNote[];
}

/** One FAQ entry. Also the input to the FAQPage structured data. */
export interface FaqEntry {
  question: string;
  answer: string;
}
