"use client";

import { useActionState } from "react";
import FormMessage from "@/components/FormMessage";
import { BRANDS, BRAND_NAMES } from "@/lib/whatsapp/templates";
import { createCampaign } from "../actions";

export default function CampaignForm() {
  const [state, formAction, pending] = useActionState(createCampaign, null);

  return (
    <form action={formAction} className="card space-y-3 p-5">
      <h2 className="font-medium">New campaign</h2>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="c-brand" className="label">
            Brand
          </label>
          <select id="c-brand" name="brand" className="input">
            {BRANDS.map((b) => (
              <option key={b} value={b}>
                {BRAND_NAMES[b]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="c-platform" className="label">
            Platform
          </label>
          <select id="c-platform" name="platform" className="input">
            <option value="Meta">Meta Ads</option>
            <option value="Google">Google Display</option>
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="c-name" className="label">
          Name
        </label>
        <input id="c-name" name="name" required placeholder="CPA · Assurance auto · Nov" className="input" />
      </div>
      <div>
        <label htmlFor="c-objective" className="label">
          Objective
        </label>
        <input id="c-objective" name="objective" placeholder="Messages (Click-to-WhatsApp)" className="input" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="c-budget" className="label">
            Daily budget (MAD)
          </label>
          <input id="c-budget" name="dailyBudget" type="number" min="0" step="1" className="input" />
        </div>
        <div>
          <label htmlFor="c-start" className="label">
            Start date
          </label>
          <input id="c-start" name="startDate" type="date" className="input" />
        </div>
      </div>
      <FormMessage state={state} />
      <button type="submit" disabled={pending} className="btn btn-primary w-full">
        Create with default checklist
      </button>
    </form>
  );
}
