"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAdminUsers, type AdminUser } from "@/features/admin/hooks/useAdminUsers";
import InviteUserModal from "./InviteUserModal";
import EditUserModal from "./EditUserModal";

function relativeTime(date: string | null): string {
  if (!date) return "Never";
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

export default function UsersTab() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [impersonating, setImpersonating] = useState<string | null>(null);
  const router = useRouter();

  const pageSize = 20;

  // Debounce search input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset to first page on new search
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, isError } = useAdminUsers({
    page,
    pageSize,
    search: debouncedSearch,
  });

  const items = data?.items ?? [];
  const total = data?.pagination?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  const handleImpersonate = useCallback(async (userId: string) => {
    setImpersonating(userId);
    try {
      const res = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        router.push("/");
        router.refresh();
      }
    } finally {
      setImpersonating(null);
    }
  }, [router]);

  const handlePrev = useCallback(() => {
    setPage((p) => Math.max(1, p - 1));
  }, []);

  const handleNext = useCallback(() => {
    setPage((p) => Math.min(totalPages, p + 1));
  }, [totalPages]);

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        {/* Search */}
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A80A8]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"
            />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users..."
            className="pl-10 pr-4 py-2 text-sm border border-[#C2BBD4] rounded-lg focus:outline-none focus:border-[#403770] focus:ring-2 focus:ring-[#403770]/30 w-64"
          />
        </div>

        {/* Invite button */}
        <button
          onClick={() => setInviteOpen(true)}
          className="bg-[#403770] text-white px-4 py-2 text-sm font-medium rounded-lg hover:bg-[#322a5a] transition-colors"
        >
          Invite User
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden border border-[#E2DEEC] rounded-lg bg-white">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[#F7F5FA]">
                <th className="text-left text-[11px] font-semibold text-[#8A80A8] uppercase tracking-wider px-4 py-3">
                  Name
                </th>
                <th className="text-left text-[11px] font-semibold text-[#8A80A8] uppercase tracking-wider px-4 py-3">
                  Email
                </th>
                <th className="text-left text-[11px] font-semibold text-[#8A80A8] uppercase tracking-wider px-4 py-3">
                  Role
                </th>
                <th className="text-left text-[11px] font-semibold text-[#8A80A8] uppercase tracking-wider px-4 py-3">
                  Job Title
                </th>
                <th className="text-left text-[11px] font-semibold text-[#8A80A8] uppercase tracking-wider px-4 py-3">
                  Last Login
                </th>
                <th className="text-left text-[11px] font-semibold text-[#8A80A8] uppercase tracking-wider px-4 py-3">
                  Setup
                </th>
                <th className="text-right text-[11px] font-semibold text-[#8A80A8] uppercase tracking-wider px-4 py-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-[#8A80A8]">
                    Loading users...
                  </td>
                </tr>
              )}

              {isError && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-red-500">
                    Failed to load users. Please try again.
                  </td>
                </tr>
              )}

              {!isLoading && !isError && items.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-[#8A80A8]">
                    {debouncedSearch ? "No users match your search." : "No users yet."}
                  </td>
                </tr>
              )}

              {items.map((user, idx) => (
                <tr
                  key={user.id}
                  className={`group hover:bg-[#EFEDF5] transition-colors${
                    idx < items.length - 1 ? " border-b border-[#E2DEEC]" : ""
                  }`}
                >
                  {/* Name */}
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-[#403770]">
                      {user.fullName || "\u2014"}
                    </span>
                  </td>

                  {/* Email */}
                  <td className="px-4 py-3">
                    <span className="text-sm text-[#6E6390]">{user.email}</span>
                  </td>

                  {/* Role badge */}
                  <td className="px-4 py-3">
                    {user.role === "admin" ? (
                      <span className="bg-[#403770] text-white px-2 py-0.5 text-xs font-medium rounded-full">
                        Admin
                      </span>
                    ) : user.role === "manager" ? (
                      <span className="bg-[#8AA891]/15 text-[#5f665b] px-2 py-0.5 text-xs font-medium rounded-full">
                        Manager
                      </span>
                    ) : (
                      <span className="bg-[#6EA3BE]/15 text-[#4d7285] px-2 py-0.5 text-xs font-medium rounded-full">
                        Rep
                      </span>
                    )}
                  </td>

                  {/* Job Title */}
                  <td className="px-4 py-3">
                    <span className="text-sm text-[#6E6390]">
                      {user.jobTitle || "\u2014"}
                    </span>
                  </td>

                  {/* Last Login */}
                  <td className="px-4 py-3">
                    <span className="text-sm text-[#8A80A8]">
                      {relativeTime(user.lastLoginAt)}
                    </span>
                  </td>

                  {/* Setup dot */}
                  <td className="px-4 py-3">
                    <span
                      className={`w-2 h-2 rounded-full inline-block ${
                        user.hasCompletedSetup ? "bg-green-500" : "bg-gray-300"
                      }`}
                      title={user.hasCompletedSetup ? "Setup complete" : "Setup incomplete"}
                    />
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {user.role !== "admin" && (
                        <button
                          onClick={() => handleImpersonate(user.id)}
                          disabled={impersonating === user.id}
                          className="text-xs text-[#8A80A8] hover:text-[#E8735A] hover:bg-[#E8735A]/10 px-2 py-1 rounded transition-colors disabled:opacity-50"
                          aria-label={`Login as ${user.fullName || user.email}`}
                        >
                          {impersonating === user.id ? "Switching..." : "Login as"}
                        </button>
                      )}
                      <button
                        onClick={() => setEditingUser(user)}
                        className="p-1.5 text-[#A69DC0] hover:text-[#403770] transition-colors"
                        aria-label={`Edit ${user.fullName || user.email}`}
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                          />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        {total > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#E2DEEC] bg-[#F7F5FA]">
            <span className="text-sm text-[#8A80A8]">
              Showing {rangeStart}-{rangeEnd} of {total} users
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrev}
                  disabled={page <= 1}
                  className="px-3 py-1.5 text-sm font-medium text-[#403770] hover:bg-[#EFEDF5] rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={handleNext}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 text-sm font-medium text-[#403770] hover:bg-[#EFEDF5] rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <InviteUserModal isOpen={inviteOpen} onClose={() => setInviteOpen(false)} />
      <EditUserModal user={editingUser} onClose={() => setEditingUser(null)} />
    </div>
  );
}
