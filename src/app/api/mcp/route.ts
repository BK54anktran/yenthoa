import { handleMcp, notAllowed } from "@/lib/mcp-http";

// Who may call: a key made on the admin page "Kết nối", sent as  Authorization: Bearer <key>.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = (request: Request) => handleMcp(request, /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") ?? "")?.[1]);
export const GET = notAllowed;
export const DELETE = notAllowed;
