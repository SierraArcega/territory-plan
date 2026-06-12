// PATCH /api/admin/settings — write one allowlisted app_settings row.
// Body: { key: string, value: unknown }. Admin-only.
import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/supabase/server";
import { setAppSetting, DROPBOX_SIGN_TEST_MODE_KEY } from "@/features/shared/lib/app-settings";

export const dynamic = "force-dynamic";

// Allowlist of admin-editable settings, each with a value validator.
const SETTING_VALIDATORS: Record<string, (value: unknown) => boolean> = {
  [DROPBOX_SIGN_TEST_MODE_KEY]: (value) => typeof value === "boolean",
};

export async function PATCH(request: Request) {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = (await request.json().catch(() => null)) as { key?: string; value?: unknown } | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const key = body.key ?? "";
    const isValid = SETTING_VALIDATORS[key];
    if (!isValid || !isValid(body.value)) {
      return NextResponse.json({ error: "Unknown setting or invalid value" }, { status: 400 });
    }

    const row = await setAppSetting(key, body.value as boolean, admin.profile.id);
    return NextResponse.json({ key: row.key, value: row.value, updatedAt: row.updatedAt });
  } catch (error) {
    console.error("Error updating app setting:", error);
    return NextResponse.json({ error: "Failed to update setting" }, { status: 500 });
  }
}
