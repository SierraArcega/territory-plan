import { describe, it, expect, vi } from "vitest";
import { createMapView } from "../map-view-service";
import type { DbClient } from "@/features/shared/lib/service-error";

function stubDb() {
  const create = vi.fn(
    async ({ data }: { data: Record<string, unknown> }) => ({ id: "v1", ...data }),
  );
  const db = { mapView: { create } } as unknown as DbClient;
  return { db, create };
}

describe("createMapView", () => {
  it("requires a name", async () => {
    const { db } = stubDb();
    await expect(createMapView({ name: "  ", state: {} }, "u1", db)).rejects.toThrow(
      /name is required/,
    );
  });

  it("rejects a name over 200 characters", async () => {
    const { db } = stubDb();
    await expect(
      createMapView({ name: "x".repeat(201), state: {} }, "u1", db),
    ).rejects.toThrow(/200 characters/);
  });

  it("requires state to be a plain object", async () => {
    const { db } = stubDb();
    await expect(
      createMapView({ name: "ok", state: null as unknown as Record<string, unknown> }, "u1", db),
    ).rejects.toThrow(/state is required/);
    await expect(
      createMapView({ name: "ok", state: [] as unknown as Record<string, unknown> }, "u1", db),
    ).rejects.toThrow(/state is required/);
  });

  it("trims the name/description and sets the owner", async () => {
    const { db, create } = stubDb();
    await createMapView(
      { name: "  My View  ", description: "  notes  ", state: { foo: 1 } },
      "u1",
      db,
    );
    expect(create).toHaveBeenCalledOnce();
    const data = create.mock.calls[0][0].data;
    expect(data.name).toBe("My View");
    expect(data.description).toBe("notes");
    expect(data.ownerId).toBe("u1");
    expect(data.isShared).toBe(false);
  });
});
