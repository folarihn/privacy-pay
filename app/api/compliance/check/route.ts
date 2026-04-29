import { NextRequest, NextResponse } from "next/server";
import { checkAddressRisk } from "@/lib/compliance";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin");
  const urlOrigin = request.nextUrl.origin;
  if (origin && origin !== urlOrigin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const address = request.nextUrl.searchParams.get("address");

  if (!address) {
    return NextResponse.json({ error: "address parameter required" }, { status: 400 });
  }

  try {
    const result = await checkAddressRisk(address);
    return NextResponse.json(result);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : typeof e === "string" ? e : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

