/**
 * Heuristic: does any of the signed-in roles look like an admin/management/staff role that should
 * see the Phase 2 management tools? Role names are configurable (RBAC is data-driven), so this is a
 * best-effort match on common substrings to decide what to *offer* in the menu — never what is
 * *allowed*. The backend permission gate is the real authority on every call, so a false positive
 * here just means a menu entry whose screens' actions the server will reject (Req 4.1); a resident
 * with no admin role simply doesn't see the section.
 */
export function hasAdminRole(roles: readonly string[]): boolean {
  return roles.some((role) => {
    const r = role.toLowerCase();
    return (
      r.includes('admin') ||
      r.includes('manager') ||
      r.includes('management') ||
      r.includes('staff') ||
      r.includes('operator') ||
      r.includes('committee')
    );
  });
}
