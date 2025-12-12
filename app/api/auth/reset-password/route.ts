import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Only allow password reset for mgr@tri-two.com
    if (email !== "mgr@tri-two.com") {
      return NextResponse.json(
        { error: "Password reset is only available for authorized accounts." },
        { status: 403 }
      );
    }

    // Use service role client for admin operations (can send emails)
    const supabase = getSupabaseClient();
    
    // Check if user exists first
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error("Error listing users:", listError);
    }
    
    const userExists = users?.some(u => u.email === email);
    
    if (!userExists) {
      // Don't reveal if user exists, but log for debugging
      console.log("Password reset requested for non-existent user:", email);
      return NextResponse.json({
        success: true,
        message: "If an account exists with this email, a password reset link has been sent.",
      });
    }

    // Generate password reset link using admin API
    // Note: Supabase admin API can generate reset links directly
    const { data: resetData, error: resetError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: email,
    });

    if (resetError) {
      console.error("Password reset error:", resetError);
      console.error("Error details:", JSON.stringify(resetError, null, 2));
      
      // In development, try alternative method
      if (process.env.NODE_ENV === 'development') {
        console.log("Attempting alternative password reset method...");
        // Try using the regular client method as fallback
        const { createRouteHandlerClient } = await import("@/lib/supabase/server");
        const clientSupabase = createRouteHandlerClient();
        const { error: altError } = await clientSupabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/reset-password`,
        });
        
        if (altError) {
          console.error("Alternative method also failed:", altError);
        } else {
          console.log("Password reset email sent via alternative method");
        }
      }
      
      // Always return success (don't reveal if user exists)
      return NextResponse.json({
        success: true,
        message: "If an account exists with this email, a password reset link has been sent.",
      });
    }

    // In development, log the reset link
    if (process.env.NODE_ENV === 'development' && resetData?.properties?.action_link) {
      console.log("=".repeat(80));
      console.log("🔗 PASSWORD RESET LINK (Development):");
      console.log(resetData.properties.action_link);
      console.log("=".repeat(80));
    }

    // Always return success (don't reveal if user exists)
    return NextResponse.json({
      success: true,
      message: process.env.NODE_ENV === 'development' 
        ? "Password reset link generated. Check server console for the link."
        : "If an account exists with this email, a password reset link has been sent.",
    });
  } catch (error: any) {
    console.error("Password reset error:", error);
    console.error("Error stack:", error?.stack);
    
    // Always return JSON, never HTML
    const errorMessage = process.env.NODE_ENV === 'development' 
      ? `An error occurred: ${error?.message || 'Unknown error'}. Check server logs for details.`
      : "An error occurred. Please try again.";
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
