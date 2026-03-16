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

export async function getUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  return user
}

/**
 * Returns the authenticated user AND their profile if they have the admin role.
 * Returns null if not authenticated or not an admin.
 */
export async function getAdminUser() {
  const user = await getUser()
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
    // If the role column doesn't exist yet (migration not applied),
    // the query will fail — treat as non-admin gracefully.
    return null
  }
}
