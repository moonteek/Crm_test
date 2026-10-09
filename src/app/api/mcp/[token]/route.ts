import { handleMcp } from "@/lib/mcp/handler";

export const dynamic = "force-dynamic";

// Same endpoint with the token in the URL, for MCP clients that can't send custom headers
// (for example claude.ai custom connectors). Treat this URL as a password.
async function handler(req: Request, { params }: { params: Promise<{ token: string }> }) {
  return handleMcp(req, (await params).token);
}
export { handler as GET, handler as POST, handler as DELETE };
