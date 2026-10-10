import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "crm_session";

export type Session = { userId: number };

function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

/** `remember`: 30-day login; otherwise the cookie ends with the browser session and the token within 12 hours. */
export const SESSION_TTL = { remember: 60 * 60 * 24 * 30, session: 60 * 60 * 12 };

export async function signSession(session: Session, ttlSeconds: number) {
  return new SignJWT(session)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(key());
}

export async function verifySession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return typeof payload.userId === "number" ? { userId: payload.userId } : null;
  } catch {
    return null;
  }
}
