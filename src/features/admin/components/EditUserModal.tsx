"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AdminUser } from "@/features/admin/hooks/useAdminUsers";

interface EditUserModalProps {
  user: AdminUser | null;
  onClose: () => void;
}

export default function EditUserModal({ user, onClose }: EditUserModalProps) {
  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [role, setRole] = useState<"admin" | "manager" | "rep">("rep");
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Pre-fill form when user changes
  useEffect(() => {
    if (user) {
      setFullName(user.fullName || "");
      setJobTitle(user.jobTitle || "");
      setRole(user.role);
      setError(null);
    }
  }, [user]);

  const updateMutation = useMutation({
    mutationFn: async (data: {
      id: string;
      fullName: string;
      jobTitle: string;
      role: "admin" | "manager" | "rep";
    }) => {
      const res = await fetch(`/api/admin/users/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: data.fullName,
          jobTitle: data.jobTitle,
          role: data.role,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed to update user (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      onClose();
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError(null);
    updateMutation.mutate({
      id: user.id,
      fullName: fullName.trim(),
      jobTitle: jobTitle.trim(),
      role,
    });
  };

  if (!user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h2 className="text-lg font-semibold text-[#403770] mb-4">Edit User</h2>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                {error}
              </div>
            )}

            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-[#403770] mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Smith"
                className="w-full border border-[#C2BBD4] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#403770] focus:ring-2 focus:ring-[#403770]/30"
              />
            </div>

            {/* Job Title */}
            <div>
              <label className="block text-sm font-medium text-[#403770] mb-1">
                Job Title
              </label>
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="Account Executive"
                className="w-full border border-[#C2BBD4] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#403770] focus:ring-2 focus:ring-[#403770]/30"
              />
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-medium text-[#403770] mb-1">
                Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "admin" | "manager" | "rep")}
                className="w-full border border-[#C2BBD4] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#403770] focus:ring-2 focus:ring-[#403770]/30 bg-white"
              >
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="rep">Rep</option>
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-[#544A78] hover:bg-[#EFEDF5] rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-[#403770] hover:bg-[#322a5a] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
