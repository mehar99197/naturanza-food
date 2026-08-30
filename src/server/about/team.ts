import "server-only";

import type { TeamMember } from "@/components/about/types";
import { queryRows } from "@/server/db/query";

/**
 * The team roster shown on the About page.
 *
 * Same query as the public `GET /api/team` handler in `backend/routes/team.js`,
 * down to the column list and the sort: `is_active` filters out members an
 * admin has hidden, and `sort_order` is the order the admin arranged them in,
 * with `id` breaking ties so two members sharing a sort position never swap
 * places between renders.
 *
 * Named columns rather than `SELECT *` because the table also carries
 * timestamps the page never shows.
 */
export const listActiveTeamMembers = async (): Promise<TeamMember[]> =>
  queryRows<TeamMember>(
    `SELECT id, name, role, image, bio
       FROM team_members
      WHERE is_active = TRUE
      ORDER BY sort_order ASC, id ASC`,
  );
