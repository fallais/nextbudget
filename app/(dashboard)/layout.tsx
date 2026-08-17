import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { getCurrentUser, getAuthMode } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // open mode → resolves to the owner; enforced mode → requires a valid session.
  const [user, authMode] = await Promise.all([getCurrentUser(), getAuthMode()]);
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar
        user={{ id: user.id, name: user.name, role: user.role }}
        authMode={authMode}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
