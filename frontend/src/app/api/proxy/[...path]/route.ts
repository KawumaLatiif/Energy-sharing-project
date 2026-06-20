import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { API_URL } from "@/common/constants/api";
import { AUTHENTICATION_COOKIE } from "@/common/constants/auth-cookie";

type RouteContext = { params: Promise<{ path: string[] }> };

async function proxyToBackend(req: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTHENTICATION_COOKIE)?.value;

  const targetPath = path.join("/");
  // Django APPEND_SLASH requires trailing slashes on API paths.
  const normalizedPath = targetPath.endsWith("/") ? targetPath : `${targetPath}/`;
  const url = `${API_URL}/${normalizedPath}${req.nextUrl.search}`;

  const headers: Record<string, string> = {};
  const contentType = req.headers.get("content-type");
  if (contentType) {
    headers["Content-Type"] = contentType;
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const body = hasBody ? await req.text() : undefined;

  try {
    const res = await fetch(url, {
      method: req.method,
      headers,
      body,
      cache: "no-store",
    });

    const responseBody = await res.text();
    return new NextResponse(responseBody, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("content-type") || "application/json",
      },
    });
  } catch {
    return NextResponse.json(
      { message: "Unable to reach the API server. Is the backend running?" },
      { status: 502 }
    );
  }
}

export const GET = proxyToBackend;
export const POST = proxyToBackend;
export const PATCH = proxyToBackend;
export const PUT = proxyToBackend;
export const DELETE = proxyToBackend;
