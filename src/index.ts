#!/usr/bin/env node
/**
 * agentram-mcp
 *
 * MCP server that wraps the AgentRAM REST API.
 * Gives AI agents (Claude Desktop, Cline, Cursor, etc.) persistent memory
 * via 10 tools mapped to the agentram.dev API surface.
 *
 * Environment variables:
 *   AGENTRAM_API_KEY  required, starts with "agentram_"
 *   AGENTRAM_API_BASE optional, defaults to https://api.agentram.dev
 *
 * Logs only to stderr. stdout is reserved for JSON-RPC.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";

const API_BASE = process.env.AGENTRAM_API_BASE || "https://api.agentram.dev";
const API_KEY = process.env.AGENTRAM_API_KEY;

if (!API_KEY) {
  console.error("[agentram-mcp] ERROR: AGENTRAM_API_KEY environment variable is required.");
  console.error("[agentram-mcp] Get a free API key (100 credits, no card) at https://agentram.dev");
  process.exit(1);
}

type Query = Record<string, string | number | undefined>;

async function callAPI(
  method: string,
  path: string,
  options: { body?: unknown; query?: Query } = {}
): Promise<unknown> {
  const url = new URL(API_BASE + path);
  if (options.query) {
    for (const [k, v] of Object.entries(options.query)) {
      if (v !== undefined && v !== null) {
        url.searchParams.set(k, String(v));
      }
    }
  }

  const headers: Record<string, string> = {
    "x-api-key": API_KEY!,
    "Accept": "application/json",
  };

  let body: string | undefined;
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  const res = await fetch(url, { method, headers, body });

  let data: any = {};
  try {
    data = await res.json();
  } catch {
    // ignore JSON parse errors; we'll use HTTP status
  }

  if (!res.ok) {
    const message =
      data?.error?.message ||
      data?.message ||
      data?.error ||
      `HTTP ${res.status} ${res.statusText}`;
    throw new Error(`AgentRAM API error (${res.status}): ${message}`);
  }

  return data;
}

const tools: Tool[] = [
  {
    name: "store_memory",
    description:
      "Store a value under a key for a given AI agent. Writing to an existing key updates the value (no duplicates created). Costs 1 credit.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "Unique identifier for the agent. Max 100 characters.",
        },
        key: {
          type: "string",
          description: "Memory label. Max 200 characters.",
        },
        value: {
          type: "string",
          description: "What to remember. Max 5,000 characters.",
        },
        ttl_days: {
          type: "number",
          description:
            "Optional. Days until this memory expires automatically. Omit for permanent memories.",
        },
      },
      required: ["agent_id", "key", "value"],
    },
  },
  {
    name: "retrieve_memory",
    description:
      "Retrieve a stored memory by agent ID and key. Returns 404 (and refunds the credit) if the memory does not exist. Costs 1 credit.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "The agent identifier." },
        key: { type: "string", description: "The memory label to retrieve." },
      },
      required: ["agent_id", "key"],
    },
  },
  {
    name: "list_memories",
    description:
      "List all memories stored under an agent ID, ordered by most recently written. Expired memories are excluded. Costs 1 credit.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "The agent identifier." },
        limit: {
          type: "number",
          description: "Max results. Default 50, max 200.",
        },
      },
      required: ["agent_id"],
    },
  },
  {
    name: "search_memories",
    description:
      "Case-insensitive text search across keys and values for a given agent. No embeddings or vector configuration required. Costs 1 credit.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "The agent identifier." },
        query: {
          type: "string",
          description: "Search term. Matched against keys and values.",
        },
      },
      required: ["agent_id", "query"],
    },
  },
  {
    name: "delete_memory",
    description: "Permanently delete a stored memory. Cannot be undone. Costs 1 credit.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "The agent identifier." },
        key: { type: "string", description: "The memory label to delete." },
      },
      required: ["agent_id", "key"],
    },
  },
  {
    name: "check_credits",
    description:
      "Return the current credit balance for your account. Free to call (no credit deducted).",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "create_namespace",
    description:
      "Create a shared memory namespace that multiple agents can read from and write to. Returns a namespace_key to share with each agent. Free to call (no credit deducted).",
    inputSchema: {
      type: "object",
      properties: {
        label: {
          type: "string",
          description: "Optional human-readable name. Max 100 characters.",
        },
      },
    },
  },
  {
    name: "store_shared_memory",
    description:
      "Store a value in a shared namespace. Any agent with the namespace_key can write to it. Costs 1 credit.",
    inputSchema: {
      type: "object",
      properties: {
        namespace_key: {
          type: "string",
          description: "The namespace key from create_namespace.",
        },
        key: { type: "string", description: "Memory label. Max 200 characters." },
        value: { type: "string", description: "What to store. Max 5,000 characters." },
        ttl_days: {
          type: "number",
          description: "Optional. Days until this memory expires.",
        },
      },
      required: ["namespace_key", "key", "value"],
    },
  },
  {
    name: "retrieve_shared_memory",
    description: "Retrieve a value from a shared namespace by key. Costs 1 credit.",
    inputSchema: {
      type: "object",
      properties: {
        namespace_key: {
          type: "string",
          description: "The namespace key.",
        },
        key: { type: "string", description: "The memory label to retrieve." },
      },
      required: ["namespace_key", "key"],
    },
  },
  {
    name: "list_shared_memories",
    description:
      "List all memories in a shared namespace, ordered by most recent. Costs 1 credit.",
    inputSchema: {
      type: "object",
      properties: {
        namespace_key: {
          type: "string",
          description: "The namespace key.",
        },
        limit: {
          type: "number",
          description: "Max results. Default 50, max 200.",
        },
      },
      required: ["namespace_key"],
    },
  },
];

const server = new Server(
  { name: "agentram-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const a = (args || {}) as Record<string, any>;

  try {
    let result: unknown;

    switch (name) {
      case "store_memory":
        result = await callAPI("POST", "/memory", {
          body: {
            agent_id: a.agent_id,
            key: a.key,
            value: a.value,
            ...(a.ttl_days !== undefined ? { ttl_days: a.ttl_days } : {}),
          },
        });
        break;

      case "retrieve_memory":
        result = await callAPI("GET", "/memory", {
          query: { agent_id: a.agent_id, key: a.key },
        });
        break;

      case "list_memories":
        result = await callAPI("GET", "/memories", {
          query: { agent_id: a.agent_id, limit: a.limit },
        });
        break;

      case "search_memories":
        result = await callAPI("GET", "/memory/search", {
          query: { agent_id: a.agent_id, q: a.query },
        });
        break;

      case "delete_memory":
        result = await callAPI("DELETE", "/memory", {
          body: { agent_id: a.agent_id, key: a.key },
        });
        break;

      case "check_credits":
        result = await callAPI("GET", "/credits");
        break;

      case "create_namespace":
        result = await callAPI("POST", "/namespace", {
          body: a.label ? { label: a.label } : {},
        });
        break;

      case "store_shared_memory":
        result = await callAPI("POST", "/memory/shared", {
          body: {
            namespace_key: a.namespace_key,
            key: a.key,
            value: a.value,
            ...(a.ttl_days !== undefined ? { ttl_days: a.ttl_days } : {}),
          },
        });
        break;

      case "retrieve_shared_memory":
        result = await callAPI("GET", "/memory/shared", {
          query: { namespace_key: a.namespace_key, key: a.key },
        });
        break;

      case "list_shared_memories":
        result = await callAPI("GET", "/memories/shared", {
          query: { namespace_key: a.namespace_key, limit: a.limit },
        });
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    };
  }
});

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[agentram-mcp] Server running on stdio. API base: ${API_BASE}`);
}

main().catch((err) => {
  console.error("[agentram-mcp] Fatal error:", err);
  process.exit(1);
});
