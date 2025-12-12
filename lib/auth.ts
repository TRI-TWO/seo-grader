import { createClient } from '@/lib/supabase/server'
import { createClient as createBrowserClient } from '@/lib/supabase/client'
import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'

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
 * Returns the user if admin, or null if not
 */
export async function requireAdmin(): Promise<User | null> {
  const authResult = await requireAuth()
  
  if (!authResult || authResult.role !== 'ADMIN') {
    return null
  }
  
  return authResult.user
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
