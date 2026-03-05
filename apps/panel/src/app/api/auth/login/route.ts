import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "healthpanel-token";
// Use internal Docker URL for server-side fetches; fallback to public URL for local dev
const API_URL =
  process.env["API_INTERNAL_URL"] ??
  process.env["NEXT_PUBLIC_API_URL"] ??
  "http://localhost:3045";
const COOKIE_SECURE = process.env["COOKIE_SECURE"] === "true";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      username?: unknown;
      password?: unknown;
    };

    if (!body.username || !body.password) {
      return NextResponse.json(
        { success: false, error: "Username and password are required" },
        { status: 400 },
      );
    }

    const apiResponse = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: body.username,
        password: body.password,
      }),
    });

    if (!apiResponse.ok) {
      let errorMessage = "Invalid username or password";
      try {
        const errorData = (await apiResponse.json()) as {
          message?: string;
          error?: string;
        };
        errorMessage = errorData.message ?? errorData.error ?? errorMessage;
      } catch {
        // ignore parse errors
      }
      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: apiResponse.status },
      );
    }

    const data = (await apiResponse.json()) as {
      accessToken: string;
      user: { id: number; username: string };
    };

    const response = NextResponse.json({
      success: true,
      user: data.user,
    });

    response.cookies.set(COOKIE_NAME, data.accessToken, {
      httpOnly: true,
      secure: COOKIE_SECURE,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return response;
  } catch (error) {
    console.error("[Auth Login Route] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
