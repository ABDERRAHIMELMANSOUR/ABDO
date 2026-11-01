"use client";

import { useActionState } from "react";
import FormMessage from "@/components/FormMessage";
import type { WaNumber } from "@/lib/whatsapp/store";
import { BRANDS, BRAND_NAMES } from "@/lib/whatsapp/templates";
import { saveNumber } from "../actions";

export default function NumberForm({ number }: { number?: WaNumber }) {
  const [state, formAction, pending] = useActionState(saveNumber, null);
  const id = number?.id ?? "new";

  return (
    <form action={formAction} className="space-y-3">
      {number && <input type="hidden" name="id" value={number.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`brand-${id}`} className="label">
            Brand
          </label>
          <select id={`brand-${id}`} name="brand" defaultValue={number?.brand ?? "ALM"} className="input">
            {BRANDS.map((b) => (
              <option key={b} value={b}>
                {BRAND_NAMES[b]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`label-${id}`} className="label">
            Label
          </label>
          <input id={`label-${id}`} name="label" required defaultValue={number?.label ?? ""} placeholder="ALM · new number" className="input" />
        </div>
        <div>
          <label htmlFor={`display-${id}`} className="label">
            Phone number
          </label>
          <input id={`display-${id}`} name="displayPhone" defaultValue={number?.display_phone ?? ""} placeholder="+212 5 22 00 00 00" className="input" />
        </div>
        <div>
          <label htmlFor={`pnid-${id}`} className="label">
            Phone number ID
          </label>
          <input id={`pnid-${id}`} name="phoneNumberId" inputMode="numeric" defaultValue={number?.phone_number_id ?? ""} className="input font-mono" />
        </div>
        <div>
          <label htmlFor={`waba-${id}`} className="label">
            WhatsApp Business Account ID
          </label>
          <input id={`waba-${id}`} name="wabaId" inputMode="numeric" defaultValue={number?.waba_id ?? ""} className="input font-mono" />
        </div>
        <div>
          <label htmlFor={`routing-${id}`} className="label">
            Routing
          </label>
          <input id={`routing-${id}`} name="routing" defaultValue={number?.routing ?? ""} placeholder="Advisers dispatch (Ikram)" className="input" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn btn-primary">
          {number ? "Save" : "Add number"}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
