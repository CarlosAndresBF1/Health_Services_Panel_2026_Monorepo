import { NextResponse } from "next/server";

const COOKIE_NAME = "healthpanel-token";
const COOKIE_SECURE = process.env["COOKIE_SECURE"] === "true";

export async function POST() {
  const response = NextResponse.json({ success: true });

  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });

  return response;
}
