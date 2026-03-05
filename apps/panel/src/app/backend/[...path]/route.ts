import { NextRequest, NextResponse } from "next/server";

const API_URL =
  process.env["API_INTERNAL_URL"] ??
  process.env["NEXT_PUBLIC_API_URL"] ??
  "http://localhost:3045";
const COOKIE_NAME = "healthpanel-token";

async function proxyRequest(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const { path } = await params;
  const target = `${API_URL}/${path.join("/")}${request.nextUrl.search}`;

  const headers = new Headers();
  headers.set(
    "Content-Type",
    request.headers.get("content-type") ?? "application/json",
  );
  headers.set("Accept", request.headers.get("accept") ?? "application/json");

  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const body =
    request.method !== "GET" && request.method !== "HEAD"
      ? await request.text()
      : null;

  const apiResponse = await fetch(target, {
    method: request.method,
    headers,
    body,
  });

  const responseHeaders = new Headers();
  const contentType = apiResponse.headers.get("content-type");
  if (contentType) {
    responseHeaders.set("content-type", contentType);
  }

  return new NextResponse(apiResponse.body, {
    status: apiResponse.status,
    statusText: apiResponse.statusText,
    headers: responseHeaders,
  });
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
