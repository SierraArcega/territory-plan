import { Prisma } from "@prisma/client";
import { ServiceError, type DbClient } from "@/features/shared/lib/service-error";

const MAX_NAME_LENGTH = 200;

export interface CreateMapViewInput {
  name: string;
  description?: string | null;
  isShared?: boolean;
  /** Serialized MapViewState (filters / palette / signal config). */
  state: Record<string, unknown>;
}

/**
 * Creates a map view owned by `userId`. Shared by the REST route
 * (`POST /api/map-views`) and the copilot `map_view.create` action, so name /
 * state validation lives here once. Throws {@link ServiceError} on bad input.
 */
export async function createMapView(
  input: CreateMapViewInput,
  userId: string,
  db: DbClient,
) {
  const name = input.name?.trim();
  if (!name) {
    throw new ServiceError("name is required");
  }
  if (name.length > MAX_NAME_LENGTH) {
    throw new ServiceError(`name must be ${MAX_NAME_LENGTH} characters or fewer`);
  }
  if (!input.state || typeof input.state !== "object" || Array.isArray(input.state)) {
    throw new ServiceError("state is required and must be an object");
  }

  return db.mapView.create({
    data: {
      name,
      description: input.description?.trim() || null,
      isShared: input.isShared ?? false,
      state: input.state as Prisma.InputJsonValue,
      ownerId: userId,
    },
    include: {
      owner: {
        select: { id: true, fullName: true, avatarUrl: true },
      },
    },
  });
}
