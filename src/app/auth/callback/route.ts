import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      // Upsert user profile from Supabase user data
      // This syncs user info on every login and creates the profile if it doesn't exist
      try {
        await prisma.userProfile.upsert({
          where: { id: data.user.id },
          update: {
            // Update user info from OAuth provider on each login
            email: data.user.email!,
            fullName:
              data.user.user_metadata?.full_name ||
              data.user.user_metadata?.name ||
              null,
            avatarUrl:
              data.user.user_metadata?.avatar_url ||
              data.user.user_metadata?.picture ||
              null,
            lastLoginAt: new Date(),
          },
          create: {
            id: data.user.id,
            email: data.user.email!,
            fullName:
              data.user.user_metadata?.full_name ||
              data.user.user_metadata?.name ||
              null,
            avatarUrl:
              data.user.user_metadata?.avatar_url ||
              data.user.user_metadata?.picture ||
              null,
            hasCompletedSetup: false,
            lastLoginAt: new Date(),
          },
        });
      } catch (profileError) {
        // Log but don't block login - profile can be created later via API
        console.error('Error upserting user profile:', profileError);
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=Could not authenticate user`)
}
