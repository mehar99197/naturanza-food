/**
 * `adminAPI` — the single object the admin dashboard imports.
 *
 * The source declares all of this inline as one ~480-line literal. Splitting it
 * by concern keeps every file readable while the composed surface stays exactly
 * what call sites expect, method names included.
 */

import { adminCommerceEndpoints } from "./admin-commerce";
import { adminManagementEndpoints } from "./admin-management";
import { adminModerationEndpoints } from "./admin-moderation";
import { adminSessionEndpoints } from "./admin-session";
import { adminUserEndpoints } from "./admin-users";
import { adminNotificationEndpoints } from "./notifications";

export const adminAPI = {
  ...adminSessionEndpoints,
  ...adminUserEndpoints,
  ...adminCommerceEndpoints,
  ...adminModerationEndpoints,
  // `adminManagementEndpoints` owns the unqualified `changePassword` and
  // `resetPassword` — a super-admin acting on another admin's account. The
  // session module's own recovery calls are named `forgotPassword` and
  // `resetPasswordWithToken` precisely so the two never collide here.
  ...adminManagementEndpoints,
  ...adminNotificationEndpoints,
};
