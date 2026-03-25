import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { CookieOptions } from '@supabase/ssr'

type CookieToSet = { name: string; value: string; options?: CookieOptions }

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
    }
  )
}

/**
 * Returns the real authenticated user from Supabase, ignoring impersonation.
 * Use this for admin checks and impersonation endpoints.
 */
export async function getRealUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  return user
}

/**
 * Returns the effective user — impersonated user if an admin has an active
 * impersonation session, otherwise the real authenticated user.
 *
 * The returned object includes an `isImpersonating` flag so callers can
 * avoid overwriting the target user's profile with the admin's metadata.
 */
export async function getUser() {
  const realUser = await getRealUser()
  if (!realUser) return null

  const cookieStore = await cookies()
  const impersonateUid = cookieStore.get('impersonate_uid')?.value

  if (!impersonateUid) return { ...realUser, isImpersonating: false as const }

  // Verify the real user is an admin
  try {
    const { default: prisma } = await import('@/lib/prisma')
    const adminProfile = await prisma.userProfile.findUnique({
      where: { id: realUser.id },
      select: { role: true },
    })

    if (!adminProfile || adminProfile.role !== 'admin') return { ...realUser, isImpersonating: false as const }

    // Verify the target user exists and get their email
    const targetProfile = await prisma.userProfile.findUnique({
      where: { id: impersonateUid },
      select: { id: true, email: true },
    })

    if (!targetProfile) return { ...realUser, isImpersonating: false as const }

    // Return a synthetic user object with the impersonated user's ID and email
    return { ...realUser, id: impersonateUid, email: targetProfile.email, isImpersonating: true as const }
  } catch {
    return { ...realUser, isImpersonating: false as const }
  }
}

/**
 * Returns the authenticated user AND their profile if they have the admin role.
 * Uses getRealUser() to bypass impersonation — admin checks always use real identity.
 */
export async function getAdminUser() {
  const user = await getRealUser()
  if (!user) return null

  try {
    const { default: prisma } = await import('@/lib/prisma')
    const profile = await prisma.userProfile.findUnique({
      where: { id: user.id },
      select: { id: true, role: true, email: true, fullName: true },
    })

    if (!profile || profile.role !== 'admin') return null

    return { user, profile }
  } catch {
    return null
  }
}
