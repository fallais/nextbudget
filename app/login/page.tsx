import { redirect } from "next/navigation";
import { getCurrentUser } from "@application/auth";
import { LoginForm } from "@/components/auth/login-form";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Already authenticated (or running in open mode) → no login needed.
  if (await getCurrentUser()) redirect("/");
  return <LoginForm />;
}
