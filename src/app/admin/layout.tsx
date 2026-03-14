import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/supabase/server";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getAdminUser();
  if (!admin) {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-[#FFFCFA]">
      <header className="border-b border-[#D4CFE2] bg-white px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <a href="/" className="text-sm font-medium text-[#8A80A8] hover:text-[#403770] transition-colors">
              &larr; Territory Planner
            </a>
            <span className="text-[#D4CFE2]">/</span>
            <span className="text-sm font-semibold text-[#403770]">Admin</span>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}
