// Single source of truth for staff-admin permissions.
// Used by the sidebar (AdminLayout), route guards (App.jsx),
// the create/edit forms (AddAdminForm, EditPermissionsModal),
// and AdminAuthContext.canAccess.
//
// Every sidebar section that's not Dashboard / Notifications has its own
// permission key, so super admin can grant access to each section
// individually. Permissions are grouped only for the UI — the storage shape
// is still a flat string[] in users.admin_permissions.

export const PERMISSION_LIST = [
  // Catalog
  { id: "manage_products",         label: "Products",         group: "Catalog" },
  { id: "manage_categories",       label: "Categories",       group: "Catalog" },
  { id: "manage_coupons",          label: "Coupons",          group: "Catalog" },
  { id: "manage_reviews",          label: "Reviews",          group: "Catalog" },
  // Orders & Returns
  { id: "manage_orders",           label: "Orders",           group: "Orders & Returns" },
  { id: "manage_returns",          label: "Returns",          group: "Orders & Returns" },
  // Customers & Communications
  { id: "manage_customers",        label: "Customers",        group: "Customers & Communications" },
  { id: "manage_messages",         label: "Messages",         group: "Customers & Communications" },
  { id: "manage_subscribers",      label: "Subscribers",      group: "Customers & Communications" },
  // Reports
  { id: "view_reports",            label: "Reports",          group: "Reports & Analytics" },
  { id: "view_analytics",          label: "Analytics",        group: "Reports & Analytics" },
  // Logistics
  { id: "manage_shipping",         label: "Shipping",         group: "Logistics" },
  { id: "manage_shipping_cities",  label: "Shipping Cities",  group: "Logistics" },
  // Operations
  { id: "manage_payments",         label: "Payments",         group: "Operations" },
  { id: "manage_announcements",    label: "Announcements",    group: "Operations" },
  { id: "manage_blog",             label: "Blog",             group: "Operations" },
  { id: "manage_team",             label: "Team",             group: "Operations" },
];

// Preserve the display order from PERMISSION_LIST when iterating groups.
export const PERMISSION_GROUPS = PERMISSION_LIST.reduce((acc, perm) => {
  const bucket = acc.find((b) => b.name === perm.group);
  if (bucket) {
    bucket.items.push(perm);
  } else {
    acc.push({ name: perm.group, items: [perm] });
  }
  return acc;
}, []);

// Maps each route segment after /admin/ to the permission it needs.
//   undefined → visible to every admin (incl. a staff with zero permissions)
//   null      → super_admin only
//   string    → required permission key (see PERMISSION_LIST)
export const FEATURE_PERMISSIONS = {
  dashboard:         undefined,
  notifications:     undefined,
  products:          "manage_products",
  categories:        "manage_categories",
  coupons:           "manage_coupons",
  reviews:           "manage_reviews",
  orders:            "manage_orders",
  returns:           "manage_returns",
  customers:         "manage_customers",
  messages:          "manage_messages",
  subscribers:       "manage_subscribers",
  reports:           "view_reports",
  analytics:         "view_analytics",
  shipping:          "manage_shipping",
  "shipping-cities": "manage_shipping_cities",
  payments:          "manage_payments",
  announcements:     "manage_announcements",
  blog:              "manage_blog",
  team:              "manage_team",
  admins:            null,
  settings:          null,
  operations:        null,
};

export const featureFromPath = (path) => {
  const cleaned = String(path || "").replace(/^\/admin\//, "").split("/")[0];
  return cleaned || "dashboard";
};
