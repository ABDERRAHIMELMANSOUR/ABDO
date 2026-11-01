import { redirect } from "next/navigation";
import Logo from "@/components/Logo";
import { getCurrentUser, homeFor } from "@/lib/auth";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user));

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Logo className="mx-auto mb-4 h-10 w-10 text-sm" />
          <h1 className="text-xl font-semibold">Sign in to ABDO</h1>
          <p className="mt-1 text-sm text-slate-500">
            Your first sign-in of the day records your arrival time.
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
