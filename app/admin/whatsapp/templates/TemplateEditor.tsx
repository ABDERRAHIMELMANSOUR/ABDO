"use client";

import { Fragment, useActionState, useState, type ReactNode } from "react";
import FormMessage from "@/components/FormMessage";
import {
  BRANDS,
  BRAND_NAMES,
  TEMPLATE_CATEGORIES,
  TEMPLATE_LANGUAGES,
  TEMPLATE_STATUSES,
  fillVariables,
  validateTemplate,
  variableCount,
  type Brand,
  type ButtonType,
  type TemplateButton,
  type TemplateDraft,
  type TemplateStatus,
} from "@/lib/whatsapp/templates";
import { refreshTemplateStatus, saveTemplate, submitTemplate } from "../actions";

export type EditorInitial = TemplateDraft & {
  id: number | null;
  status: TemplateStatus;
  rejectionReason: string;
  metaTemplateId: string | null;
};

const BUTTON_TYPES: { value: ButtonType; label: string }[] = [
  { value: "QUICK_REPLY", label: "Quick reply" },
  { value: "URL", label: "Website" },
  { value: "PHONE_NUMBER", label: "Call" },
];

export default function TemplateEditor({ initial, metaReady }: { initial: EditorInitial; metaReady: boolean }) {
  const [t, setT] = useState<TemplateDraft>(initial);
  const [saveState, saveAction, saving] = useActionState(saveTemplate, null);
  const [submitState, submitAction, submitting] = useActionState(submitTemplate, null);
  const [refreshState, refreshAction, refreshing] = useActionState(refreshTemplateStatus, null);

  const set = <K extends keyof TemplateDraft>(key: K, value: TemplateDraft[K]) => setT((prev) => ({ ...prev, [key]: value }));
  const setButton = (i: number, patch: Partial<TemplateButton>) =>
    set("buttons", t.buttons.map((b, k) => (k === i ? { ...b, ...patch } : b)));
  const count = variableCount(t.body);
  const errors = validateTemplate(t);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <form action={saveAction} className="card space-y-4 p-5">
        {initial.id && <input type="hidden" name="id" value={initial.id} />}
        <input type="hidden" name="buttons" value={JSON.stringify(t.buttons)} />
        <input type="hidden" name="samples" value={JSON.stringify(t.samples.slice(0, count))} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Brand" htmlFor="brand">
            <select id="brand" name="brand" value={t.brand} onChange={(e) => set("brand", e.target.value as Brand)} className="input">
              {BRANDS.map((b) => (
                <option key={b} value={b}>
                  {BRAND_NAMES[b]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Template name" htmlFor="name" hint="lowercase_with_underscores">
            <input
              id="name"
              name="name"
              value={t.name}
              onChange={(e) => set("name", e.target.value.toLowerCase().replace(/[\s-]+/g, "_"))}
              className="input font-mono"
              required
            />
          </Field>
          <Field label="Category" htmlFor="category">
            <select id="category" name="category" value={t.category} onChange={(e) => set("category", e.target.value)} className="input">
              {TEMPLATE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.charAt(0) + c.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Language" htmlFor="language">
            <select id="language" name="language" value={t.language} onChange={(e) => set("language", e.target.value)} className="input">
              {TEMPLATE_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Header" htmlFor="header" hint={`optional · ${t.header.length}/60`}>
          <input id="header" name="header" value={t.header} onChange={(e) => set("header", e.target.value)} className="input" />
        </Field>
        <Field label="Body" htmlFor="body" hint={`${t.body.length}/1024 · use {{1}}, {{2}}… for variables, *bold*, _italic_`}>
          <textarea id="body" name="body" rows={7} value={t.body} onChange={(e) => set("body", e.target.value)} className="input" required />
        </Field>
        <Field label="Footer" htmlFor="footer" hint={`optional · ${t.footer.length}/60`}>
          <input id="footer" name="footer" value={t.footer} onChange={(e) => set("footer", e.target.value)} className="input" />
        </Field>

        {count > 0 && (
          <fieldset>
            <legend className="label">Sample values (Meta reviews the template with these)</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {Array.from({ length: count }, (_, i) => (
                <input
                  key={i}
                  value={t.samples[i] ?? ""}
                  onChange={(e) => {
                    const samples = [...t.samples];
                    samples[i] = e.target.value;
                    set("samples", samples);
                  }}
                  placeholder={`{{${i + 1}}}`}
                  aria-label={`Sample for {{${i + 1}}}`}
                  className="input"
                />
              ))}
            </div>
          </fieldset>
        )}

        <fieldset>
          <legend className="label">Buttons</legend>
          <div className="space-y-2">
            {t.buttons.map((b, i) => (
              <div key={i} className="flex flex-wrap gap-2">
                <select
                  value={b.type}
                  onChange={(e) => setButton(i, { type: e.target.value as ButtonType })}
                  aria-label={`Button ${i + 1} type`}
                  className="input w-auto"
                >
                  {BUTTON_TYPES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <input
                  value={b.text}
                  onChange={(e) => setButton(i, { text: e.target.value })}
                  placeholder="Label"
                  aria-label={`Button ${i + 1} label`}
                  className="input min-w-0 flex-1"
                />
                {b.type !== "QUICK_REPLY" && (
                  <input
                    value={b.value ?? ""}
                    onChange={(e) => setButton(i, { value: e.target.value })}
                    placeholder={b.type === "URL" ? "https://…" : "+212…"}
                    aria-label={`Button ${i + 1} ${b.type === "URL" ? "link" : "phone number"}`}
                    className="input min-w-0 flex-1"
                  />
                )}
                <button
                  type="button"
                  onClick={() => set("buttons", t.buttons.filter((_, k) => k !== i))}
                  className="btn btn-danger px-2"
                  aria-label={`Remove button ${i + 1}`}
                >
                  ✕
                </button>
              </div>
            ))}
            {t.buttons.length < 10 && (
              <button
                type="button"
                onClick={() => set("buttons", [...t.buttons, { type: "QUICK_REPLY", text: "" }])}
                className="btn btn-secondary py-1.5"
              >
                Add button
              </button>
            )}
          </div>
        </fieldset>

        <div className="grid gap-4 border-t border-slate-200 pt-4 sm:grid-cols-2">
          <Field label="Status" htmlFor="status">
            <select id="status" name="status" defaultValue={initial.status} className="input">
              {TEMPLATE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s === "submitted" ? "In review" : s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Rejection reason" htmlFor="rejectionReason" hint="if rejected">
            <input id="rejectionReason" name="rejectionReason" defaultValue={initial.rejectionReason} className="input" />
          </Field>
        </div>

        {errors.length > 0 && (
          <ul className="space-y-1 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {errors.map((e) => (
              <li key={e}>• {e}</li>
            ))}
          </ul>
        )}
        <FormMessage state={saveState} />
        <button type="submit" disabled={saving} className="btn btn-primary">
          {saving ? "Saving…" : initial.id ? "Save changes" : "Create template"}
        </button>
      </form>

      <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <Preview t={t} />
        {initial.id && (
          <section className="card space-y-3 p-5 text-sm">
            <h2 className="font-medium">Meta</h2>
            {initial.metaTemplateId ? (
              <p className="text-slate-600">
                Template ID <span className="font-mono">{initial.metaTemplateId}</span>
              </p>
            ) : (
              <p className="text-slate-600">Not submitted yet. Save your changes before submitting.</p>
            )}
            {!metaReady && <p className="text-amber-800">Set WHATSAPP_ACCESS_TOKEN to submit and sync with Meta.</p>}
            <div className="flex flex-wrap gap-2">
              <form action={submitAction}>
                <input type="hidden" name="id" value={initial.id} />
                <button type="submit" disabled={!metaReady || submitting} className="btn btn-primary">
                  {submitting ? "Submitting…" : "Submit to Meta"}
                </button>
              </form>
              <form action={refreshAction}>
                <input type="hidden" name="id" value={initial.id} />
                <button type="submit" disabled={!metaReady || refreshing} className="btn btn-secondary">
                  {refreshing ? "Checking…" : "Refresh status"}
                </button>
              </form>
            </div>
            <FormMessage state={submitState} />
            <FormMessage state={refreshState} />
          </section>
        )}
      </div>
    </div>
  );
}

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="label">
        {label} {hint && <span className="font-normal text-slate-400">({hint})</span>}
      </label>
      {children}
    </div>
  );
}

/** Renders WhatsApp's *bold*, _italic_ and ~strikethrough~ markers. */
function formatted(text: string) {
  return text.split(/(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~)/g).map((part, i) => {
    if (/^\*[^*]+\*$/.test(part)) return <strong key={i}>{part.slice(1, -1)}</strong>;
    if (/^_[^_]+_$/.test(part)) return <em key={i}>{part.slice(1, -1)}</em>;
    if (/^~[^~]+~$/.test(part)) return <s key={i}>{part.slice(1, -1)}</s>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

function Preview({ t }: { t: TemplateDraft }) {
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center gap-2 bg-[#075e54] px-4 py-2.5 text-sm font-medium text-white">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-xs">{t.brand}</span>
        {BRAND_NAMES[t.brand]}
      </div>
      <div className="bg-[#efeae2] p-4">
        <div className="max-w-[85%] rounded-lg rounded-tl-none bg-white px-3 py-2 text-sm shadow-sm">
          {t.header && <p className="mb-1 font-semibold">{t.header}</p>}
          <p className="whitespace-pre-line text-slate-800">{t.body.trim() ? formatted(fillVariables(t.body, t.samples)) : "Message body…"}</p>
          {t.footer && <p className="mt-1 text-xs text-slate-400">{t.footer}</p>}
          <p className="mt-1 text-right text-[10px] text-slate-400">09:41</p>
        </div>
        {t.buttons.length > 0 && (
          <div className="mt-1 max-w-[85%] space-y-1">
            {t.buttons.map((b, i) => (
              <div key={i} className="rounded-lg bg-white px-3 py-2 text-center text-sm font-medium text-[#00a5f4] shadow-sm">
                {b.type === "URL" ? "↗ " : b.type === "PHONE_NUMBER" ? "✆ " : ""}
                {b.text || "Button"}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
