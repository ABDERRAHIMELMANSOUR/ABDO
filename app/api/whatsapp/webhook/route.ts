import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { logEvent } from "@/lib/whatsapp/store";

export const dynamic = "force-dynamic";

type WebhookBody = {
  entry?: {
    changes?: {
      field?: string;
      value?: {
        metadata?: { phone_number_id?: string; display_phone_number?: string };
        messages?: { from?: string; type?: string }[];
        statuses?: { status?: string; recipient_id?: string; errors?: { title?: string }[] }[];
        errors?: { title?: string; message?: string }[];
      };
    }[];
  }[];
};

/** Customers' numbers are only shown as their last 4 digits in the log. */
const mask = (phone?: string) => (phone ? `•••• ${phone.slice(-4)}` : null);

function validSignature(raw: string, header: string | null, secret: string) {
  if (!header) return false;
  const expected = Buffer.from(`sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`);
  const received = Buffer.from(header);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

/** Meta calls this once when you save the callback URL in the app dashboard. */
export function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  if (p.get("hub.mode") === "subscribe" && expected && p.get("hub.verify_token") === expected && p.get("hub.challenge")) {
    logEvent({ kind: "verification", detail: "Meta verified the callback URL" });
    return new Response(p.get("hub.challenge"), { status: 200 });
  }
  logEvent({ kind: "rejected", detail: "Verification failed: verify token doesn't match WHATSAPP_VERIFY_TOKEN" });
  return new Response("Forbidden", { status: 403 });
}

/** Incoming messages and delivery statuses for every connected number. */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const secret = process.env.META_APP_SECRET;
  if (secret && !validSignature(raw, req.headers.get("x-hub-signature-256"), secret)) {
    logEvent({ kind: "rejected", detail: "Invalid X-Hub-Signature-256 (check META_APP_SECRET)" });
    return new Response("Invalid signature", { status: 401 });
  }

  let body: WebhookBody;
  try {
    body = JSON.parse(raw);
  } catch {
    logEvent({ kind: "rejected", detail: "Request body is not JSON" });
    return new Response("Bad request", { status: 400 });
  }

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};
      const base = {
        phone_number_id: value.metadata?.phone_number_id,
        display_phone: value.metadata?.display_phone_number,
      };
      let logged = false;
      for (const m of value.messages ?? []) {
        logEvent({ ...base, kind: "message", contact: mask(m.from), detail: `Incoming ${m.type ?? "message"}` });
        logged = true;
      }
      for (const s of value.statuses ?? []) {
        const failed = s.status === "failed";
        logEvent({
          ...base,
          kind: failed ? "error" : "status",
          contact: mask(s.recipient_id),
          detail: failed ? `Delivery failed: ${s.errors?.[0]?.title ?? "unknown error"}` : `Message ${s.status}`,
        });
        logged = true;
      }
      for (const e of value.errors ?? []) {
        logEvent({ ...base, kind: "error", detail: e.title ?? e.message ?? "Error" });
        logged = true;
      }
      if (!logged) logEvent({ ...base, kind: "other", detail: `Event: ${change.field ?? "unknown"}` });
    }
  }

  // Meta retries for days unless it gets a quick 200.
  return new Response("EVENT_RECEIVED", { status: 200 });
}
