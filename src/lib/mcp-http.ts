import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { tooManyKeyAttempts, verifyApiKey } from "@/lib/api-keys";
import { registerTools } from "@/lib/mcp-tools";

// The MCP endpoint (Streamable HTTP, stateless: every request gets its own server and answers with JSON), shared by
//   /api/mcp          key in the header   Authorization: Bearer <key>   (Claude Desktop, Claude Code, claude.ai)
//   /api/mcp/<key>    key in the address                                  (clients with no place to type a key, such as ChatGPT)
const json = (status: number, body: unknown, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", "referrer-policy": "no-referrer", ...extra } });

export async function handleMcp(request: Request, key: string | undefined): Promise<Response> {
  const client = (request.headers.get("x-forwarded-for")?.split(",")[0] ?? request.headers.get("x-real-ip") ?? "local").trim();
  if (tooManyKeyAttempts(client)) return json(429, { error: "Sai key quá nhiều lần. Thử lại sau 15 phút." }, { "retry-after": "900" });
  const who = key ? await verifyApiKey(key, client) : null;
  if (who && !who.ok && who.reason === "off") return json(401, { error: "Key đang tắt. Bật lại ở trang Kết nối của trang quản trị." }, { "www-authenticate": 'Bearer realm="mcp"' });
  if (!who || !who.ok) return json(401, { error: "Thiếu hoặc sai key." }, { "www-authenticate": 'Bearer realm="mcp"' });

  const server = new McpServer({ name: "website", version: "1.0.0" });
  registerTools(server, { keyName: who.name });
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  return transport.handleRequest(request);
}

export const notAllowed = () => json(405, { error: "Chỉ nhận POST." }, { allow: "POST" });
