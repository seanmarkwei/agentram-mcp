# agentram-mcp

Model Context Protocol server for [AgentRAM](https://agentram.dev). Give your AI agents persistent memory in Claude Desktop, Cline, Cursor, and any other MCP-compatible client.

## What you get

10 MCP tools that map 1:1 to the AgentRAM REST API.

**Personal agent memory**
- `store_memory`: Write a value under an `agent_id` + `key`. Optional `ttl_days` for auto-expiry.
- `retrieve_memory`: Read a memory back by `agent_id` + `key`. Refunds the credit on 404.
- `list_memories`: List everything stored for an agent, newest first.
- `search_memories`: Case-insensitive text search across keys and values. No embeddings needed.
- `delete_memory`: Permanently delete a memory.

**Shared multi-agent memory**
- `create_namespace`: Create a shared memory pool that multiple agents can read and write to. Free.
- `store_shared_memory`: Write to a shared namespace.
- `retrieve_shared_memory`: Read from a shared namespace.
- `list_shared_memories`: List everything in a namespace.

**Utility**
- `check_credits`: Show your current account balance. Free, no credit deducted.

Each non-free tool costs 1 credit. Reads and writes are the same price.

## Get an API key

Sign up at [agentram.dev](https://agentram.dev). You get 100 free credits on signup. No credit card required.

## Install in Claude Desktop

Edit `claude_desktop_config.json`:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

Add:

```json
{
  "mcpServers": {
    "agentram": {
      "command": "npx",
      "args": ["-y", "agentram-mcp"],
      "env": {
        "AGENTRAM_API_KEY": "agentram_your_key_here"
      }
    }
  }
}
```

Restart Claude Desktop. The 10 tools will appear in the MCP picker.

## Install in Cline (VS Code)

In Cline's MCP settings, add:

```json
{
  "mcpServers": {
    "agentram": {
      "command": "npx",
      "args": ["-y", "agentram-mcp"],
      "env": {
        "AGENTRAM_API_KEY": "agentram_your_key_here"
      }
    }
  }
}
```

## Install in Cursor

In Cursor's MCP settings, add:

```json
{
  "mcpServers": {
    "agentram": {
      "command": "npx",
      "args": ["-y", "agentram-mcp"],
      "env": {
        "AGENTRAM_API_KEY": "agentram_your_key_here"
      }
    }
  }
}
```

## Try it locally before publishing

```bash
npm install
npm run build
AGENTRAM_API_KEY=your_key node dist/index.js
```

Or open the MCP Inspector web UI:

```bash
AGENTRAM_API_KEY=your_key npx @modelcontextprotocol/inspector node dist/index.js
```

The Inspector lets you list tools and invoke each one manually to verify everything works against the real API.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AGENTRAM_API_KEY` | Yes | Your AgentRAM API key, starts with `agentram_` |
| `AGENTRAM_API_BASE` | No | Override the API base URL. Defaults to `https://api.agentram.dev` |

## Links

- AgentRAM website: [agentram.dev](https://agentram.dev)
- Full API docs: [agentram.dev/docs.html](https://agentram.dev/docs.html)
- Issues: [github.com/seanmarkwei/agentram-mcp/issues](https://github.com/seanmarkwei/agentram-mcp/issues)

## License

MIT
