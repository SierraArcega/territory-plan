import { Suspense } from "react";
import AdminDashboard from "@/features/admin/components/AdminDashboard";

export default function AdminPage() {
  return (
    <Suspense>
      <AdminDashboard />
    </Suspense>
  );
}
