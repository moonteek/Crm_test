import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySession } from "./session";
import { assertCan, loadUser, type CurrentUser } from "./access";
import type { Permission } from "./permissions";

/** The logged-in user, read fresh from the database once per request so role changes apply immediately. */
export const getUser = cache(async (): Promise<CurrentUser | null> => {
  const store = await cookies();
  const session = await verifySession(store.get(SESSION_COOKIE)?.value);
  return session ? loadUser(session.userId) : null;
});

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

/** For pages: sends users without the permission to the "no access" page. */
export async function requirePage(...perms: Permission[]) {
  const user = await requireUser();
  if (!perms.every((p) => user.permissions.has(p))) redirect("/no-access");
  return user;
}

/** For server actions: throws when the permission is missing. */
export async function requirePermission(...perms: Permission[]) {
  const user = await requireUser();
  assertCan(user, ...perms);
  return user;
}
