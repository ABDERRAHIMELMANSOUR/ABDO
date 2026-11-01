export type FormState = { error?: string; message?: string } | null;

export default function FormMessage({ state }: { state: FormState }) {
  if (state?.error)
    return (
      <p role="alert" className="text-sm text-red-600">
        {state.error}
      </p>
    );
  if (state?.message)
    return (
      <p role="status" className="text-sm text-emerald-700">
        {state.message}
      </p>
    );
  return null;
}
