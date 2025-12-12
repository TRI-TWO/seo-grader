import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase/server";

// Note: Supabase handles password reset tokens via URL hash fragments
// This route is kept for compatibility but the actual reset happens client-side
export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  // Supabase password reset tokens are handled via URL hash, not query params
  // This endpoint can be used to verify the token if needed
  return NextResponse.json({ 
    message: "Password reset token validation. Use the reset password page to complete the process." 
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { password } = await req.json();

    if (!password) {
      return NextResponse.json(
        { error: "Password is required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long" },
        { status: 400 }
      );
    }

    const supabase = createRouteHandlerClient();
    
    // Update password using Supabase Auth
    // Note: The user must have a valid session from the password reset link
    const { error: updateError } = await supabase.auth.updateUser({
      password: password,
    });

    if (updateError) {
      console.error("Password update error:", updateError);
      return NextResponse.json(
        { error: updateError.message || "Failed to update password. The reset link may have expired." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Password has been reset successfully",
    });
  } catch (error: any) {
    console.error("Password reset error:", error);
    return NextResponse.json(
      { error: "An error occurred. Please try again." },
      { status: 500 }
    );
  }
}
