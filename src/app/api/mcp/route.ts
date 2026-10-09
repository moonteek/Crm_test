import { handleMcp } from "@/lib/mcp/handler";

export const dynamic = "force-dynamic";

const handler = (req: Request) => handleMcp(req);
export { handler as GET, handler as POST, handler as DELETE };
