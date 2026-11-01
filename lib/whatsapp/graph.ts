// Minimal client for the Meta Graph API (WhatsApp Cloud API).

export function metaConfigured() {
  return Boolean(process.env.WHATSAPP_ACCESS_TOKEN);
}

export async function graph<T>(path: string, init: { method?: "GET" | "POST"; body?: unknown } = {}): Promise<T> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) throw new Error("WHATSAPP_ACCESS_TOKEN is not set in .env.local");
  const version = process.env.META_GRAPH_VERSION || "v23.0";

  const res = await fetch(`https://graph.facebook.com/${version}/${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as T & {
    error?: { message?: string; error_user_title?: string; error_user_msg?: string };
  };
  if (!res.ok || data.error) {
    const e = data.error;
    throw new Error(e?.error_user_msg || e?.message || `Meta returned HTTP ${res.status}`);
  }
  return data;
}

export type PhoneNumberInfo = {
  display_phone_number?: string;
  verified_name?: string;
  quality_rating?: string;
  code_verification_status?: string;
  name_status?: string;
};

export function getPhoneNumber(phoneNumberId: string) {
  return graph<PhoneNumberInfo>(
    `${encodeURIComponent(phoneNumberId)}?fields=display_phone_number,verified_name,quality_rating,code_verification_status,name_status`,
  );
}

/** Apps subscribed to the WhatsApp Business Account's webhooks. Empty means no events will arrive. */
export async function getSubscribedApps(wabaId: string) {
  const res = await graph<{ data?: unknown[] }>(`${encodeURIComponent(wabaId)}/subscribed_apps`);
  return res.data?.length ?? 0;
}

export function createTemplate(wabaId: string, payload: unknown) {
  return graph<{ id: string; status?: string; category?: string }>(`${encodeURIComponent(wabaId)}/message_templates`, {
    method: "POST",
    body: payload,
  });
}

export async function findTemplate(wabaId: string, name: string, language: string) {
  const res = await graph<{ data?: { id: string; name: string; language: string; status: string; rejected_reason?: string }[] }>(
    `${encodeURIComponent(wabaId)}/message_templates?name=${encodeURIComponent(name)}&fields=id,name,language,status,rejected_reason`,
  );
  return res.data?.find((t) => t.name === name && t.language === language) ?? null;
}
