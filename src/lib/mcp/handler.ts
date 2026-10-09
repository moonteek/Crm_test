import { createHash } from "node:crypto";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { db } from "@/lib/db";
import { can, loadUser } from "@/lib/access";
import { buildServer } from "./tools";

function unauthorized(message: string) {
  return Response.json(
    { jsonrpc: "2.0", error: { code: -32001, message }, id: null },
    { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="algoritm-crm"' } },
  );
}

/**
 * Stateless MCP endpoint (Streamable HTTP). Every request is authenticated with a
 * personal token and served by a fresh server scoped to the token owner's permissions.
 */
export async function handleMcp(req: Request, pathToken?: string) {
  if (req.method !== "POST") {
    return Response.json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed" }, id: null }, { status: 405, headers: { Allow: "POST" } });
  }
  const header = req.headers.get("authorization");
  const token = pathToken ?? (header?.startsWith("Bearer ") ? header.slice(7).trim() : null);
  if (!token) return unauthorized("Token kerak: Authorization: Bearer <token>");

  const record = await db.apiToken.findUnique({ where: { tokenHash: createHash("sha256").update(token).digest("hex") } });
  const user = record && (await loadUser(record.userId));
  if (!record || !user) return unauthorized("Token noto'g'ri yoki bekor qilingan");
  if (!can(user, "mcp.use")) return unauthorized("Rolingizda MCP ruxsati yo'q");
  await db.apiToken.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } });

  const server = buildServer(user);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  return transport.handleRequest(req);
}
