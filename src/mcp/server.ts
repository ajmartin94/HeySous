import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerLogTools } from "./tools/query-logs.js";
import { registerDatabaseTools } from "./tools/query-database.js";
import { registerStatusTools } from "./tools/server-status.js";

async function main(): Promise<void> {
  const dbPath = process.env.HEYSOUS_DB_PATH;
  if (!dbPath) {
    console.error(
      "Error: HEYSOUS_DB_PATH environment variable is required."
    );
    console.error(
      "Set it to the absolute path of the HeySous SQLite database file."
    );
    process.exit(1);
  }

  const server = new McpServer({
    name: "heysous-debug",
    version: "1.0.0",
  });

  // Register all tools
  registerLogTools(server);
  registerDatabaseTools(server, dbPath);
  registerStatusTools(server, dbPath);

  // Connect via stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Error handling
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception in MCP server:", err);
  process.exit(1);
});

process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection in MCP server:", err);
  process.exit(1);
});

main().catch((err) => {
  console.error("Failed to start MCP server:", err);
  process.exit(1);
});
