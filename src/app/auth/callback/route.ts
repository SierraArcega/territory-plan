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
      // Merge any pre-provisioned stub profile into the real Supabase user
      try {
        const stub = await prisma.userProfile.findFirst({
          where: {
            email: data.user.email!,
            id: { not: data.user.id },
          },
        })

        if (stub) {
          // Transfer all FK references from stub ID → real Supabase ID, then delete stub
          await prisma.$transaction(async (tx) => {
            await tx.$executeRaw`UPDATE territory_plans SET owner_id = ${data.user.id}::uuid WHERE owner_id = ${stub.id}::uuid`
            await tx.$executeRaw`UPDATE territory_plans SET user_id = ${data.user.id}::uuid WHERE user_id = ${stub.id}::uuid`
            await tx.$executeRaw`UPDATE territory_plan_collaborators SET user_id = ${data.user.id}::uuid WHERE user_id = ${stub.id}::uuid`
            // Normalized FK columns
            await tx.$executeRaw`UPDATE districts SET owner_id = ${data.user.id}::uuid WHERE owner_id = ${stub.id}::uuid`
            await tx.$executeRaw`UPDATE districts SET sales_executive_id = ${data.user.id}::uuid WHERE sales_executive_id = ${stub.id}::uuid`
            await tx.$executeRaw`UPDATE states SET territory_owner_id = ${data.user.id}::uuid WHERE territory_owner_id = ${stub.id}::uuid`
            await tx.$executeRaw`UPDATE schools SET owner_id = ${data.user.id}::uuid WHERE owner_id = ${stub.id}::uuid`
            await tx.$executeRaw`UPDATE unmatched_accounts SET sales_executive_id = ${data.user.id}::uuid WHERE sales_executive_id = ${stub.id}::uuid`
            await tx.$executeRaw`UPDATE opportunities SET sales_rep_id = ${data.user.id}::uuid WHERE sales_rep_id = ${stub.id}::uuid`
            await tx.userProfile.delete({ where: { id: stub.id } })
          })
        }
      } catch (mergeError) {
        console.error('Error merging stub profile:', mergeError)
      }

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
