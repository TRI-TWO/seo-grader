import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSupabaseClient } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const { email, password, role = "VISITOR" } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Only allow registration for mgr@tri-two.com
    if (email !== "mgr@tri-two.com") {
      return NextResponse.json(
        { error: "Registration is restricted to authorized accounts only." },
        { status: 403 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long" },
        { status: 400 }
      );
    }

    // Check if user already exists in Supabase
    const supabase = getSupabaseClient();
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const userExists = existingUsers?.users?.some(u => u.email === email);

    if (userExists) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      );
    }

    // Create user in Supabase Auth
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        role: role,
      },
    });

    if (authError || !authUser.user) {
      console.error("Supabase auth error:", authError);
      return NextResponse.json(
        { error: authError?.message || "Failed to create user" },
        { status: 500 }
      );
    }

    // Create corresponding User record in Prisma for business data linking
    try {
      const user = await prisma.user.create({
        data: {
          id: authUser.user.id, // Use Supabase UUID
          email: authUser.user.email!,
          role: role as "ADMIN" | "VISITOR",
        },
      });

      return NextResponse.json({
        success: true,
        message: "User created successfully",
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      });
    } catch (dbError: any) {
      // If Prisma creation fails, try to clean up Supabase user
      console.error("Prisma user creation error:", dbError);
      try {
        await supabase.auth.admin.deleteUser(authUser.user.id);
      } catch (cleanupError) {
        console.error("Failed to cleanup Supabase user:", cleanupError);
      }
      return NextResponse.json(
        { error: "Failed to create user record. Please try again." },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "An error occurred. Please try again." },
      { status: 500 }
    );
  }
}
