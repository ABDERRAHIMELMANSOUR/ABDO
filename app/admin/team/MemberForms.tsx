"use client";

import { useActionState } from "react";
import FormMessage from "@/components/FormMessage";
import { createMember, resetPassword } from "../actions";

export function MemberForm() {
  const [state, formAction, pending] = useActionState(createMember, null);

  return (
    <form action={formAction} className="card space-y-4 p-5">
      <h2 className="font-medium">Add a team member</h2>
      <div>
        <label htmlFor="name" className="label">
          Full name
        </label>
        <input id="name" name="name" required className="input" placeholder="Ikram" />
      </div>
      <div>
        <label htmlFor="username" className="label">
          Username
        </label>
        <input id="username" name="username" required autoCapitalize="none" className="input" placeholder="ikram" />
      </div>
      <div>
        <label htmlFor="password" className="label">
          Password
        </label>
        <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className="input" />
      </div>
      <div>
        <label htmlFor="role" className="label">
          Role
        </label>
        <select id="role" name="role" defaultValue="employee" className="input">
          <option value="employee">Employee</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <FormMessage state={state} />
      <button type="submit" disabled={pending} className="btn btn-primary w-full">
        {pending ? "Adding…" : "Add member"}
      </button>
    </form>
  );
}

export function ResetPasswordForm({ userId }: { userId: number }) {
  const [state, formAction, pending] = useActionState(resetPassword, null);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={userId} />
      <input
        name="password"
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
        placeholder="New password"
        aria-label="New password"
        className="input w-36 py-1.5"
      />
      <button type="submit" disabled={pending} className="btn btn-secondary py-1.5">
        Reset
      </button>
      <FormMessage state={state} />
    </form>
  );
}
