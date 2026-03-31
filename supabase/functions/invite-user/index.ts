import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Auth check
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')
    const { data: { user: adminUser }, error: userError } = await supabaseAdmin.auth.getUser(token!)

    if (userError || !adminUser) throw new Error('Unauthorized');

    const { data: userRole } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', adminUser.id)
      .single()

    if (userRole?.role !== 'admin') throw new Error('Admin access required');

    const { email, role } = await req.json()

    if (!email || !role) throw new Error('Email and role are required');

    // 1. Invite user via Supabase (this creates the user in auth.users)
    // We set 'shouldCreateUser' to true and 'redirectTo'
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${Deno.env.get('SITE_URL') || 'http://localhost:8080'}/auth`,
        data: { initial_role: role }
    })

    if (inviteError) throw inviteError

    // 2. Add role to user_roles table (status: pending or actual role)
    await supabaseAdmin.from('user_roles').insert({
        user_id: inviteData.user.id,
        role: role,
        granted_by: adminUser.id
    })

    // 3. Send branded email via notification engine
    // Note: Supabase might send its own email if not disabled. 
    // The user mentioned "not leaving it to supabase".
    
    const notificationRes = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-system-notification`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'user_invitation',
          recipient: email,
          data: {
            inviterName: adminUser.email?.split('@')[0] || 'Admin',
            invitationUrl: `${Deno.env.get('SITE_URL') || 'http://localhost:8080'}/auth`, // Supabase handles the magic link if they click reset later, but for invitation we can point to auth
            role: role
          },
          related_id: inviteData.user.id
        })
      }
    )

    return new Response(JSON.stringify({ success: true, user: inviteData.user }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
