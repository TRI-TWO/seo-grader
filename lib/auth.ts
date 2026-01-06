import { createClient } from '@/lib/supabase/server'
import { createClient as createBrowserClient } from '@/lib/supabase/client'
import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { prisma } from '@/lib/prisma'
import { isSmokeyUser, getUserPersona, hasCapability } from '@/lib/capabilities/check'

export type UserRole = 'ADMIN' | 'VISITOR'

/**
 * Get the current authenticated user (server-side)
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const supabase = createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user) {
      return null
    }
    
    return user
  } catch (error) {
    console.error('Error getting current user:', error)
    return null
  }
}

/**
 * Get the current authenticated user (client-side)
 */
export async function getCurrentUserClient(): Promise<User | null> {
  try {
    const supabase = createBrowserClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user) {
      return null
    }
    
    return user
  } catch (error) {
    console.error('Error getting current user:', error)
    return null
  }
}

/**
 * Extract user role from user metadata
 */
export function getUserRole(user: User | null): UserRole {
  if (!user) {
    return 'VISITOR'
  }
  
  return (user.user_metadata?.role as UserRole) || 'VISITOR'
}

/**
 * Require authentication for API routes
 * Returns the user if authenticated, or null if not
 */
export async function requireAuth(): Promise<{ user: User; role: UserRole } | null> {
  const user = await getCurrentUser()
  
  if (!user) {
    return null
  }
  
  const role = getUserRole(user)
  
  return { user, role }
}

/**
 * Require admin role for API routes
 * Checks if user is Smokey persona (bypasses tier logic)
 * Falls back to email check for backward compatibility
 * Returns the user if admin, or null if not
 */
export async function requireAdmin(): Promise<User | null> {
  const user = await getCurrentUser()
  
  if (!user) {
    return null
  }
  
  // Check if user is Smokey persona (new system)
  const isSmokey = await isSmokeyUser(user.id)
  if (isSmokey) {
    return user
  }
  
  // Fallback: Check if user is admin by email (backward compatibility)
  if (user.email === 'mgr@tri-two.com') {
    return user
  }
  
  return null
}

/**
 * Check if user is a client (not admin)
 * Clients can only access audit when allow_audit_free_access = true
 */
export async function isClient(user: User): Promise<boolean> {
  const isAdmin = await requireAdmin()
  if (isAdmin) {
    return false // Admin is not a client
  }
  
  // Check if user email matches a client
  const client = await prisma.client.findFirst({
    where: { email: user.email || '' },
  });
  
  return !!client;
}

/**
 * Get client for a user (if they are a client)
 */
export async function getClientForUser(user: User) {
  if (!user.email) {
    return null;
  }
  
  return await prisma.client.findFirst({
    where: { email: user.email },
  });
}

/**
 * Check if client can access audit (free access)
 */
export async function canClientAccessAudit(user: User): Promise<boolean> {
  const client = await getClientForUser(user);
  if (!client) {
    return false;
  }
  
  return client.allow_audit_free_access === true;
}

/**
 * Check if user has a specific capability
 * Smokey users automatically have all capabilities
 */
export async function requireCapability(
  userId: string,
  capabilityKey: string
): Promise<boolean> {
  return await hasCapability(userId, capabilityKey)
}

/**
 * Get user's persona (smokey or wildcat)
 */
export async function getPersona(userId: string): Promise<'smokey' | 'wildcat' | null> {
  return await getUserPersona(userId)
}

/**
 * Create an unauthorized response
 */
export function unauthorizedResponse(message = 'Unauthorized') {
  return NextResponse.json({ error: message }, { status: 401 })
}

/**
 * Create a forbidden response (for admin-only routes)
 */
export function forbiddenResponse(message = 'Forbidden') {
  return NextResponse.json({ error: message }, { status: 403 })
}

