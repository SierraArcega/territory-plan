import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/supabase/server";
import AdminShell from "@/features/admin/components/AdminShell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getAdminUser();
  if (!admin) {
    redirect("/");
  }

  return <AdminShell>{children}</AdminShell>;
}
