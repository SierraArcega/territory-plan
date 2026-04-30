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
      // Profile creation and stub-merge are handled by the on_auth_user_created
      // trigger on auth.users. Drift recovery and lastLoginAt are handled by
      // /api/profile on first request. Nothing to do here at the user-row level.

      // Re-link normalized FK columns for this user
      // Matches on email (for opportunities) and crm_name (for owner/sales_executive fields)
      try {
        const userId = data.user.id
        const email = data.user.email!

        // Link opportunities by email match
        await prisma.$executeRaw`
          UPDATE opportunities SET sales_rep_id = ${userId}::uuid
          WHERE sales_rep_id IS NULL
            AND LOWER(TRIM(sales_rep_email)) = LOWER(TRIM(${email}))
        `

        // Link by crm_name if set
        const profile = await prisma.userProfile.findUnique({
          where: { id: userId },
          select: { crmName: true },
        })

        if (profile?.crmName) {
          const crmName = profile.crmName
          await Promise.all([
            prisma.$executeRaw`
              UPDATE districts SET owner_id = ${userId}::uuid
              WHERE owner_id IS NULL
                AND LOWER(TRIM(owner)) = LOWER(TRIM(${crmName}))
            `,
            prisma.$executeRaw`
              UPDATE districts SET sales_executive_id = ${userId}::uuid
              WHERE sales_executive_id IS NULL
                AND LOWER(TRIM(sales_executive)) = LOWER(TRIM(${crmName}))
            `,
            prisma.$executeRaw`
              UPDATE states SET territory_owner_id = ${userId}::uuid
              WHERE territory_owner_id IS NULL
                AND LOWER(TRIM(territory_owner)) = LOWER(TRIM(${crmName}))
            `,
            prisma.$executeRaw`
              UPDATE schools SET owner_id = ${userId}::uuid
              WHERE owner_id IS NULL
                AND LOWER(TRIM(owner)) = LOWER(TRIM(${crmName}))
            `,
            prisma.$executeRaw`
              UPDATE unmatched_accounts SET sales_executive_id = ${userId}::uuid
              WHERE sales_executive_id IS NULL
                AND LOWER(TRIM(sales_executive)) = LOWER(TRIM(${crmName}))
            `,
          ])
        }
      } catch (relinkError) {
        console.error('Error re-linking normalized FKs:', relinkError)
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=Could not authenticate user`)
}
