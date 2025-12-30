import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
  try {
    // Check if user is authenticated and is mgr@tri-two.com
    const user = await getCurrentUser();
    
    if (!user || user.email !== 'mgr@tri-two.com') {
      return NextResponse.json(
        { error: 'Unauthorized. Only mgr@tri-two.com can bootstrap.' },
        { status: 401 }
      );
    }

    const supabase = createClient();

    // 1. Insert into profiles if user doesn't exist
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        email: user.email,
        display_name: user.email?.split('@')[0] || 'Admin',
      }, {
        onConflict: 'id'
      });

    if (profileError) {
      console.error('Error upserting profile:', profileError);
      // Continue even if profile upsert fails (might already exist)
    }

    // 2. Check if default tenant exists, create if not
    const { data: existingTenants, error: tenantCheckError } = await supabase
      .from('tenants')
      .select('id, name, slug')
      .eq('slug', 'tri-two-internal')
      .limit(1);

    if (tenantCheckError) {
      console.error('Error checking tenants:', tenantCheckError);
      return NextResponse.json(
        { error: 'Failed to check tenants' },
        { status: 500 }
      );
    }

    let tenantId: string;
    
    if (existingTenants && existingTenants.length > 0) {
      tenantId = existingTenants[0].id;
    } else {
      // Create default tenant
      const { data: newTenant, error: tenantCreateError } = await supabase
        .from('tenants')
        .insert({
          name: 'TRI-TWO Internal',
          slug: 'tri-two-internal',
        })
        .select('id')
        .single();

      if (tenantCreateError || !newTenant) {
        console.error('Error creating tenant:', tenantCreateError);
        return NextResponse.json(
          { error: 'Failed to create default tenant' },
          { status: 500 }
        );
      }

      tenantId = newTenant.id;
    }

    // 3. Ensure admin membership exists
    const { data: existingMembership, error: membershipCheckError } = await supabase
      .from('tenant_memberships')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('user_id', user.id)
      .limit(1);

    if (membershipCheckError) {
      console.error('Error checking membership:', membershipCheckError);
      return NextResponse.json(
        { error: 'Failed to check membership' },
        { status: 500 }
      );
    }

    if (!existingMembership || existingMembership.length === 0) {
      const { error: membershipCreateError } = await supabase
        .from('tenant_memberships')
        .insert({
          tenant_id: tenantId,
          user_id: user.id,
          role: 'admin',
        });

      if (membershipCreateError) {
        console.error('Error creating membership:', membershipCreateError);
        return NextResponse.json(
          { error: 'Failed to create admin membership' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      tenant: {
        id: tenantId,
        name: existingTenants?.[0]?.name || 'TRI-TWO Internal',
        slug: existingTenants?.[0]?.slug || 'tri-two-internal',
      },
      message: 'Bootstrap completed successfully',
    });
  } catch (error) {
    console.error('Bootstrap error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

