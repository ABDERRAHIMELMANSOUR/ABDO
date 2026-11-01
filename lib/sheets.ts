export type SheetRow = {
  date: string;
  time: string;
  timestamp: string;
  name: string;
  username: string;
  status: string;
};

type SheetResult = { ok: true } | { ok: false; error: string };

export function sheetsConfigured() {
  return Boolean(process.env.GOOGLE_SHEETS_WEBHOOK_URL);
}

/**
 * Appends one attendance row to the HR Google Sheet through the Apps Script web app
 * in google-apps-script/Code.gs.
 */
export async function sendToSheet(row: SheetRow): Promise<SheetResult> {
  const url = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  if (!url) return { ok: false, error: "GOOGLE_SHEETS_WEBHOOK_URL is not set" };

  try {
    // Apps Script answers POSTs with a redirect to the script output; fetch follows it.
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: process.env.GOOGLE_SHEETS_WEBHOOK_SECRET || "", ...row }),
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { ok: false, error: `Google returned HTTP ${res.status}` };

    const text = await res.text();
    let data: { ok?: boolean; error?: string };
    try {
      data = JSON.parse(text);
    } catch {
      return { ok: false, error: "Unexpected response; check the web app is deployed for 'Anyone'" };
    }
    return data.ok ? { ok: true } : { ok: false, error: data.error || "Rejected by Apps Script" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
