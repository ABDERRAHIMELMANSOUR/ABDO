import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb, type Role, type User } from "./db";

const SESSION_COOKIE = "session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error("SESSION_SECRET must be set in .env.local (at least 32 characters).");
  }
  return new TextEncoder().encode(value);
}

export async function startSession(user: Pick<User, "id" | "role">) {
  const token = await new SignJWT({ role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** The signed-in user, re-read from the database so deactivated accounts lose access at once. */
export async function getCurrentUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  let userId: number;
  try {
    const { payload } = await jwtVerify(token, secret());
    userId = Number(payload.sub);
  } catch {
    return null;
  }

  const user = getDb()
    .prepare("SELECT id, username, name, role, active FROM users WHERE id = ?")
    .get(userId) as User | undefined;
  return user && user.active ? user : null;
}

export function homeFor(user: Pick<User, "role">) {
  return user.role === "admin" ? "/admin" : "/dashboard";
}

/** Use at the top of every protected page and server action. */
export async function requireUser(role?: Role): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (role && user.role !== role) redirect(homeFor(user));
  return user;
}
