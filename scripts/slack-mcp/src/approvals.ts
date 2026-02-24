/**
 * In-memory approval store.
 * MCP tools create approval entries; Bolt action handlers resolve them.
 */

export interface PendingApproval {
  id: string;
  description: string;
  channel: string;
  messageTs?: string;
  status: "pending" | "approved" | "rejected";
  resolvedBy?: string;
  resolvedAt?: Date;
  feedback?: string;
  resolve?: (result: ApprovalResult) => void;
}

export interface ApprovalResult {
  status: "approved" | "rejected" | "timeout";
  user: string;
  feedback?: string;
}

const store = new Map<string, PendingApproval>();

export function createApproval(
  channel: string,
  description: string,
): PendingApproval {
  const id = `approval_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const approval: PendingApproval = {
    id,
    description,
    channel,
    status: "pending",
  };
  store.set(id, approval);
  return approval;
}

export function getApproval(id: string): PendingApproval | undefined {
  return store.get(id);
}

export function resolveApproval(
  id: string,
  status: "approved" | "rejected",
  userId: string,
  feedback?: string,
): boolean {
  const approval = store.get(id);
  if (!approval || approval.status !== "pending") return false;

  approval.status = status;
  approval.resolvedBy = userId;
  approval.resolvedAt = new Date();
  if (feedback) approval.feedback = feedback;

  if (approval.resolve) {
    approval.resolve({ status, user: userId, feedback });
  }

  return true;
}

export function waitForApproval(
  id: string,
  timeoutMs: number,
): Promise<ApprovalResult> {
  const approval = store.get(id);
  if (!approval) {
    return Promise.reject(new Error(`No approval found: ${id}`));
  }

  if (approval.status !== "pending") {
    return Promise.resolve({
      status: approval.status,
      user: approval.resolvedBy || "",
      feedback: approval.feedback,
    });
  }

  return Promise.race([
    new Promise<ApprovalResult>((resolve) => {
      approval.resolve = resolve;
    }),
    new Promise<ApprovalResult>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), timeoutMs),
    ),
  ]).catch(() => ({ status: "timeout" as const, user: "" }));
}
