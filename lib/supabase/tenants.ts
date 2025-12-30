import { createClient } from '@/lib/supabase/server';
import { createClient as createBrowserClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface TenantMembership {
  id: string;
  tenant_id: string;
  user_id: string;
  role: 'admin' | 'member' | 'viewer';
  created_at: string;
}

/**
 * Get all tenants for a user (server-side)
 */
export async function getUserTenants(userId: string): Promise<Tenant[]> {
  try {
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('tenant_memberships')
      .select(`
        tenant_id,
        tenants (
          id,
          name,
          slug,
          created_at
        )
      `)
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching user tenants:', error);
      return [];
    }

    return (data || []).map((item: any) => item.tenants).filter(Boolean);
  } catch (error) {
    console.error('Error in getUserTenants:', error);
    return [];
  }
}

/**
 * Get all tenants for a user (client-side)
 */
export async function getUserTenantsClient(userId: string): Promise<Tenant[]> {
  try {
    const supabase = createBrowserClient();
    
    const { data, error } = await supabase
      .from('tenant_memberships')
      .select(`
        tenant_id,
        tenants (
          id,
          name,
          slug,
          created_at
        )
      `)
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching user tenants:', error);
      return [];
    }

    return (data || []).map((item: any) => item.tenants).filter(Boolean);
  } catch (error) {
    console.error('Error in getUserTenantsClient:', error);
    return [];
  }
}

/**
 * Get the primary/default tenant for a user (server-side)
 * Returns the first tenant if only one exists, or the most recently created
 */
export async function getActiveTenant(userId: string): Promise<Tenant | null> {
  try {
    const tenants = await getUserTenants(userId);
    
    if (tenants.length === 0) {
      return null;
    }
    
    if (tenants.length === 1) {
      return tenants[0];
    }
    
    // Return most recently created tenant
    return tenants.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];
  } catch (error) {
    console.error('Error in getActiveTenant:', error);
    return null;
  }
}

/**
 * Get the primary/default tenant for a user (client-side)
 */
export async function getActiveTenantClient(userId: string): Promise<Tenant | null> {
  try {
    const tenants = await getUserTenantsClient(userId);
    
    if (tenants.length === 0) {
      return null;
    }
    
    if (tenants.length === 1) {
      return tenants[0];
    }
    
    // Return most recently created tenant
    return tenants.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];
  } catch (error) {
    console.error('Error in getActiveTenantClient:', error);
    return null;
  }
}

/**
 * Ensure a tenant membership exists (server-side, admin only)
 * Requires service role key or admin user
 */
export async function ensureTenantMembership(
  userId: string,
  tenantId: string,
  role: 'admin' | 'member' | 'viewer'
): Promise<TenantMembership | null> {
  try {
    const supabase = createClient();
    
    // Check if membership already exists
    const { data: existing, error: checkError } = await supabase
      .from('tenant_memberships')
      .select('*')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = not found
      console.error('Error checking membership:', checkError);
      return null;
    }

    if (existing) {
      // Update role if different
      if (existing.role !== role) {
        const { data: updated, error: updateError } = await supabase
          .from('tenant_memberships')
          .update({ role })
          .eq('id', existing.id)
          .select()
          .single();

        if (updateError) {
          console.error('Error updating membership:', updateError);
          return null;
        }

        return updated;
      }

      return existing;
    }

    // Create new membership
    const { data: newMembership, error: createError } = await supabase
      .from('tenant_memberships')
      .insert({
        user_id: userId,
        tenant_id: tenantId,
        role,
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating membership:', createError);
      return null;
    }

    return newMembership;
  } catch (error) {
    console.error('Error in ensureTenantMembership:', error);
    return null;
  }
}

/**
 * Get user's role in a specific tenant (server-side)
 */
export async function getUserRoleInTenant(
  userId: string,
  tenantId: string
): Promise<'admin' | 'member' | 'viewer' | null> {
  try {
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('tenant_memberships')
      .select('role')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) {
      return null;
    }

    return data.role as 'admin' | 'member' | 'viewer';
  } catch (error) {
    console.error('Error in getUserRoleInTenant:', error);
    return null;
  }
}

