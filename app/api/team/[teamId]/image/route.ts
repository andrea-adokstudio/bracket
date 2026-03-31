import { NextResponse } from "next/server"

export async function GET(
  _request: Request,
  context: { params: Promise<{ teamId: string }> },
) {
  const { teamId } = await context.params
  const id = Number(teamId)
  if (!Number.isFinite(id) || id <= 0) {
    return new NextResponse(null, { status: 400 })
  }

  const upstream = await fetch(`https://api.sofascore.app/api/v1/team/${id}/image`, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; Bracket/1.0)",
      accept: "image/*,*/*",
    },
    next: { revalidate: 86_400 },
  })

  if (!upstream.ok) {
    return new NextResponse(null, { status: upstream.status === 404 ? 404 : 502 })
  }

  const buffer = await upstream.arrayBuffer()
  const contentType = upstream.headers.get("content-type") ?? "image/png"

  return new NextResponse(buffer, {
    headers: {
      "content-type": contentType,
      "cache-control": "public, max-age=86400, s-maxage=86400",
    },
  })
}
