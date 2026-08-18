import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getAuthMode, getCurrentUser } from "@application/auth";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // open mode → resolves to the owner; enforced mode → requires a valid session.
  const [user, authMode] = await Promise.all([getCurrentUser(), getAuthMode()]);
  if (!user) redirect("/login");

  return (
    <AppShell user={{ id: user.id, name: user.name, role: user.role }} authMode={authMode}>
      {children}
    </AppShell>
  );
}
