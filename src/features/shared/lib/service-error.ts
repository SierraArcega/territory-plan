import type { PrismaClient, Prisma } from "@prisma/client";

/**
 * A Prisma client that works inside or outside a transaction. Feature service
 * functions accept this so the same logic runs from a REST route (default
 * `prisma`) or inside the copilot's `prisma.$transaction(tx => …)` (where the
 * audit row is written in the same transaction).
 */
export type DbClient = PrismaClient | Prisma.TransactionClient;

/**
 * Error carrying an HTTP status, thrown by feature service fns. Both the REST
 * routes and the copilot execute endpoint map it to a response — so validation
 * and authorization live in the service, not duplicated per caller.
 */
export class ServiceError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "ServiceError";
    this.status = status;
  }
}

export function isServiceError(e: unknown): e is ServiceError {
  return e instanceof ServiceError;
}
