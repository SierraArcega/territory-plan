import "server-only";
import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { AppSetting } from "@prisma/client";
import { DROPBOX_SIGN_TEST_MODE_KEY } from "./app-setting-keys";

export { DROPBOX_SIGN_TEST_MODE_KEY };

/** Pure fallback rule shared by every reader: only an explicit JSON boolean
 *  counts; anything else (missing row, malformed value) = test mode ON. */
export function dropboxSignTestModeFromValue(value: unknown): boolean {
  return typeof value === "boolean" ? value : true;
}

export async function getAppSetting(key: string): Promise<Prisma.JsonValue | undefined> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  return row?.value;
}

/** DB errors propagate — a send must fail loudly rather than silently flip mode. */
export async function getDropboxSignTestMode(): Promise<boolean> {
  return dropboxSignTestModeFromValue(await getAppSetting(DROPBOX_SIGN_TEST_MODE_KEY));
}

export async function setAppSetting(key: string, value: Prisma.InputJsonValue, updatedById: string): Promise<AppSetting> {
  return prisma.appSetting.upsert({
    where: { key },
    create: { key, value, updatedById },
    update: { value, updatedById },
  });
}
