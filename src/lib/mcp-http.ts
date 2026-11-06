import { MCP_INSTRUCTIONS } from "@/lib/mcp-guide";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { tooManyKeyAttempts, verifyApiKey } from "@/lib/api-keys";
import { registerTools } from "@/lib/mcp-tools";
import { registerMoreTools } from "@/lib/mcp-tools-more";

// The MCP endpoint (Streamable HTTP, stateless: every request gets its own server and answers with JSON), shared by
//   /api/mcp          key in the header   Authorization: Bearer <key>   (Claude Desktop, Claude Code, claude.ai)
//   /api/mcp/<key>    key in the address                                  (clients with no place to type a key, such as ChatGPT)
export const json = (status: number, body: unknown, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", "referrer-policy": "no-referrer", ...extra } });

// address of the caller as far as the proxy tells us (used to count wrong keys)
export const clientOf = (request: Request) => (request.headers.get("x-forwarded-for")?.split(",")[0] ?? request.headers.get("x-real-ip") ?? "local").trim();

// the key from the header  Authorization: Bearer <key>
export const bearerKey = (request: Request) => /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") ?? "")?.[1];

// the address the caller used (behind the proxy the request URL is an internal one)
const originOf = (request: Request) => {
  const url = new URL(request.url);
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0].trim() || url.protocol.replace(":", "");
  const host = request.headers.get("x-forwarded-host")?.split(",")[0].trim() || request.headers.get("host") || url.host;
  return `${proto}://${host}`;
};

// who is calling: a key that exists and is on, or the response to send back (wrong, off, or too many wrong guesses)
export async function authenticate(request: Request, key: string | undefined): Promise<{ ok: true; name: string } | { ok: false; response: Response }> {
  const client = clientOf(request);
  if (tooManyKeyAttempts(client)) return { ok: false, response: json(429, { error: "Sai key quá nhiều lần. Thử lại sau 15 phút." }, { "retry-after": "900" }) };
  const who = key ? await verifyApiKey(key, client) : null;
  if (who && !who.ok && who.reason === "off") return { ok: false, response: json(401, { error: "Key đang tắt. Bật lại ở trang Kết nối của trang quản trị." }, { "www-authenticate": 'Bearer realm="mcp"' }) };
  if (!who || !who.ok) return { ok: false, response: json(401, { error: "Thiếu hoặc sai key." }, { "www-authenticate": 'Bearer realm="mcp"' }) };
  return { ok: true, name: who.name };
}

export async function handleMcp(request: Request, key: string | undefined): Promise<Response> {
  const who = await authenticate(request, key);
  if (!who.ok) return who.response;
  const ctx = { keyName: who.name, origin: originOf(request) };

  const server = new McpServer({ name: "website", version: "1.0.0" }, { instructions: MCP_INSTRUCTIONS });
  registerTools(server, ctx);
  registerMoreTools(server, ctx);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  return transport.handleRequest(request);
}

export const notAllowed = () => json(405, { error: "Chỉ nhận POST." }, { allow: "POST" });
