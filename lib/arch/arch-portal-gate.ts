import type { User } from "@supabase/supabase-js";
import { getCurrentUser, getClientForUser } from "@/lib/auth";

export type ArchPortalGate =
  | { kind: "unauthenticated" }
  | { kind: "no_client"; user: User }
  | { kind: "ready"; user: User };

/**
 * Arch routes: distinguish missing session vs missing org/client linkage.
 * Middleware can admit the user; server components must not send (2) back to /login.
 */
export async function getArchPortalGate(): Promise<ArchPortalGate> {
  const user = await getCurrentUser();
  if (!user) return { kind: "unauthenticated" };

  const client = await getClientForUser(user);
  if (!client) return { kind: "no_client", user };

  return { kind: "ready", user };
}
