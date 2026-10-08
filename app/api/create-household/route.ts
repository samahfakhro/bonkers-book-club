import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { checkAvailability } from '@/lib/membership/availability'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, planLabel, ...householdFields } = body

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
    }

    // Verify the user actually exists in auth
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId)
    if (authError || !authUser.user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Idempotency — don't double-create
    const { data: existing } = await supabaseAdmin
      .from('households')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ householdId: existing.id })
    }

    // Final capacity check — caps/pauses may have changed since the pin was confirmed
    const availability = await checkAvailability(householdFields.latitude, householdFields.longitude)
    if (!availability.canJoin) {
      return NextResponse.json({ error: 'full', waitlist: true }, { status: 409 })
    }

    // Create household — zone + Bonkers Day come from the server's check, not the browser
    const { data: household, error: hhError } = await supabaseAdmin
      .from('households')
      .insert({ user_id: userId, ...householdFields, signup_zone_id: availability.zoneId, bonkers_day: availability.bonkersDay })
      .select('id')
      .single()

    if (hhError) {
      console.error('Household insert error:', hhError)
      return NextResponse.json({ error: hhError.message }, { status: 500 })
    }

    // Create subscription
    if (planLabel) {
      const { data: planRow } = await supabaseAdmin
        .from('subscription_plans')
        .select('id')
        .eq('name', planLabel)
        .maybeSingle()

      await supabaseAdmin.from('subscriptions').insert({
        household_id: household.id,
        plan_id: planRow?.id ?? null,
        status: 'active',
        start_date: new Date().toISOString(),
      })
    }

    return NextResponse.json({ householdId: household.id })
  } catch (err) {
    console.error('create-household error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
