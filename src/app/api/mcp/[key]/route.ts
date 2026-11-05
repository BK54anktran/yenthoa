import { handleMcp, notAllowed } from "@/lib/mcp-http";

// The same endpoint with the key in the address, for clients that cannot send a header (ChatGPT only offers OAuth or no sign-in).
// A key in an address can end up in logs of servers in between, so keep this address as private as the key itself.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request, ctx: { params: Promise<{ key: string }> }) {
  return handleMcp(request, (await ctx.params).key);
}
export const GET = notAllowed;
export const DELETE = notAllowed;
