# Design Document: OAuth2 Authentication for MCP Servers

## Architecture Overview

OAuth2 authentication will be implemented at the **gateway layer** in the MCP client connection logic. This ensures all MCP server connections go through a unified authentication flow without requiring changes to the execution sandbox or type generation layers.

```
┌─────────────────────────────────────────────────────────────┐
│ Configuration Layer                                          │
│ - .toolscript.json with OAuth2 config                       │
│ - Validation of OAuth2 parameters                           │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Gateway Layer (OAuth2 Integration)                          │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ McpClient                                                │ │
│ │ - Detects OAuth2 config                                 │ │
│ │ - Creates OAuthClientProvider                           │ │
│ │ - Passes provider to transport                          │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ OAuth2 Client Providers                                 │ │
│ │ - PersistentOAuthProvider (Authorization Code)          │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Token Storage                                            │ │
│ │ - File-based storage (~/.toolscript/oauth/)             │ │
│ │ - Secure permissions (0600 files, 0700 directory)       │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Callback Server (Authorization Code flow)               │ │
│ │ - Temporary HTTP server on localhost                    │ │
│ │ - Receives OAuth2 redirect                              │ │
│ │ - Completes token exchange                              │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ MCP SDK Transport Layer                                      │
│ - StreamableHTTPClientTransport with authProvider           │
│ - SSEClientTransport with authProvider                      │
│ - Automatic token refresh and retry                         │
└─────────────────────────────────────────────────────────────┘
```

## Configuration Schema

OAuth2 configuration is **fully optional**. The system uses OAuth discovery to detect when authentication is required.

### Zero Config (Dynamic Registration)
```json
{
  "mcpServers": {
    "github": {
      "type": "http",
      "url": "https://api.github.com/mcp"
      // No oauth field - discovery and dynamic registration happen automatically
    }
  }
}
```

User runs `toolscript auth github` which:
1. Performs OAuth discovery
2. Dynamically registers a client (if supported)
3. Saves client_id to `~/.toolscript/oauth/github.json`
4. Completes authorization flow

### Pre-Registered Client (Authorization Code)
```json
{
  "mcpServers": {
    "github": {
      "type": "http",
      "url": "https://api.github.com/mcp",
      "oauth": {
        "clientId": "${GITHUB_CLIENT_ID}"
      }
    }
  }
}
```

Used when server doesn't support dynamic registration or user prefers pre-registered client.


## OAuth2 Data Storage Strategy

OAuth2 data (client registration + tokens) stored per-user using secure file-based storage.

### Storage Implementation

**File-Based Storage**
- Location: `~/.toolscript/oauth/<server-name>.json`
- File permissions: 0600 (read/write owner only) on Unix-like systems
- Directory permissions: 0700 (owner only)
- **No encryption** - data stored as plaintext JSON, security relies on filesystem permissions
- Server names are sanitized to prevent directory traversal attacks

**Future Enhancement:**
- OS-specific keychain support could be added via Deno FFI for enhanced security
- Would require platform-specific implementations (macOS Keychain, Windows Credential Manager, Linux Secret Service)

### Storage Format

OAuth data is stored as JSON with the following structure:

```json
{
  "client": {
    "client_id": "...",
    "registration_source": "dynamic" | "config"
  },
  "tokens": {
    "access_token": "...",
    "refresh_token": "...",
    "expires_at": 1234567890,
    "token_type": "Bearer",
    "scope": "repo user"
  }
}
```

## OAuth Discovery

The MCP SDK provides automatic OAuth discovery via the server's metadata endpoint:
1. Connect to MCP server at configured URL
2. SDK fetches `/.well-known/oauth-authorization-server` or similar discovery endpoint
3. Discovery response includes:
   - `authorization_endpoint`
   - `token_endpoint`
   - `revocation_endpoint` (optional)
   - Supported grant types
   - Supported scopes
4. SDK uses discovered metadata for OAuth flows

No manual endpoint configuration required!

## OAuth2 Provider Implementation

### PersistentOAuthProvider (Authorization Code)
Wraps or extends MCP SDK's built-in provider with:
- `tokens()`: Load from keychain/file storage
- `saveTokens()`: Persist to keychain/file storage
- Delegates OAuth flow logic to MCP SDK
- PKCE handled automatically by MCP SDK

## Standalone Auth Command Design

The `toolscript auth <server>` command is **completely standalone** and does not require the gateway to be running.

### Auth Command Flow

1. **User runs**: `toolscript auth github`

2. **Read config**: Load server config from `.toolscript.json`

3. **Perform OAuth discovery**: Fetch authorization server metadata from MCP server

4. **Obtain client credentials**:
   - **Priority 1**: Check storage backend for existing client registration
   - **Priority 2**: Check `oauth.clientId` in config
   - **Priority 3**: Try dynamic client registration (RFC 7591)
     - POST to `registration_endpoint` from discovery
     - Save client registration to storage backend
   - **Fallback**: Error "Server doesn't support dynamic registration. Add oauth.clientId to config."

5. **Start temporary callback server**:
   - Bind to random available port (e.g., 8765)
   - Register route: `GET /oauth/callback?code=...&state=...`

6. **Generate authorization URL**:
   - Use MCP SDK with discovered endpoints
   - `redirect_uri=http://localhost:8765/oauth/callback`
   - Generate PKCE challenge (MCP SDK handles this)
   - Generate state parameter for CSRF protection

7. **Display and open authorization URL**:
   - Log complete authorization URL to stdout
   - Attempt to open URL in default browser
   - If browser opening fails, display fallback message
   - User completes authorization in browser

8. **Handle callback**:
   - Validate state parameter
   - Exchange code for tokens (MCP SDK)
   - Save both client registration AND tokens to storage backend (keychain or file)

9. **Shutdown callback server**: Display success message, exit

10. **Gateway loads data later**: When gateway starts, it loads client info and tokens from storage backend

### Redirect URI Strategy

Since callback server port is dynamic:
- Use `http://localhost:8765/oauth/callback` (or whatever port binds)
- During dynamic registration, register pattern: `http://localhost:*/oauth/callback` (if server supports wildcards)
- Otherwise, register specific port and reuse it (store in client registration)

## Token Refresh Strategy

1. **Proactive Refresh**: Check token expiry before each MCP operation
2. **Refresh Window**: Refresh if token expires within 5 minutes
3. **SDK Integration**: MCP SDK handles refresh automatically via `OAuthClientProvider`
4. **Failure Handling**:
   - If refresh fails, clear tokens
   - Trigger re-authentication flow
   - Display user-friendly error message

## Security Considerations

1. **Token Storage**:
   - Primary: System keychain (encrypted by OS)
   - Fallback: File with 0600 permissions
   - Never log tokens or secrets

2. **Environment Variables**:
   - Client ID/Secret loaded from env vars (not stored in config)
   - Use ${VAR} syntax in config files

3. **PKCE Support**:
   - Always use PKCE for Authorization Code flow
   - Generate cryptographically secure code verifier

4. **State Parameter**:
   - Generate random state for CSRF protection
   - Validate state on callback

5. **Scope Validation**:
   - Document required scopes for each flow
   - Validate granted scopes match requested

## User Experience

### Auth Status Listing
```bash
# List all OAuth2 servers with authentication status
$ toolscript auth
OAuth2 Servers:

✓ github - authenticated
✗ gitlab - not authenticated

Run 'toolscript auth <server-name>' to authenticate a server.
```

### First-Time Setup (Zero Config with Dynamic Registration)
```bash
# 1. Minimal config - just the server URL
$ cat .toolscript.json
{
  "mcpServers": {
    "github": {
      "type": "http",
      "url": "https://api.github.com/mcp"
    }
  }
}

# 2. Authenticate (gateway NOT running)
$ toolscript auth github
Performing OAuth discovery...
✓ Server supports dynamic client registration
Registering client...
✓ Client registered successfully
Starting callback server on port 8765...

Authorization URL: https://github.com/login/oauth/authorize?client_id=...&redirect_uri=...&state=...

Opening browser for authorization...
Waiting for authorization...
✓ Authorization successful! Credentials stored securely.

# 3. Later, start gateway
$ toolscript gateway
Starting gateway server...
✓ Loaded OAuth2 credentials for 'github'
✓ Connected to 'github'
Gateway server listening on http://localhost:3000
```

### Pre-Registered Client
```bash
# Server doesn't support dynamic registration
$ toolscript auth legacy-server
Performing OAuth discovery...
✗ Server doesn't support dynamic client registration
Please add oauth.clientId to config for 'legacy-server'

# User adds clientId to config
$ cat .toolscript.json
{
  "mcpServers": {
    "legacy-server": {
      "type": "http",
      "url": "https://legacy.example.com/mcp",
      "oauth": {
        "clientId": "${LEGACY_CLIENT_ID}"
      }
    }
  }
}

# Try again
$ toolscript auth legacy-server
Using client_id from config...
Starting callback server on port 8765...
✓ Authorization successful!
```


## Integration Points

### Configuration Layer (`src/config/`)
- Extend `ServerConfig` types with `OAuth2Config`
- Validate OAuth2 parameters in schema
- Support environment variable substitution

### Gateway Layer (`src/gateway/`)
- Modify `McpClient.connect()` to detect OAuth2 config
- Create OAuth2 provider based on flow type
- Pass provider to transport constructor
- Add OAuth2 callback endpoint to gateway HTTP server

### New Module (`src/oauth/`)
- `providers.ts`: Persistent OAuth provider implementations
- `storage.ts`: Token storage abstraction (keychain + file)
- `callback-server.ts`: Callback handler logic (if separate from main gateway)
- `types.ts`: OAuth2 configuration types

## Testing Strategy

### Unit Tests
- Token storage read/write (mock keychain)
- Provider token refresh logic
- Configuration validation
- PKCE generation and validation

### Integration Tests
- Full OAuth2 flow with mock OAuth server
- Token persistence and reload
- Automatic refresh before expiry
- Callback server handling

### E2E Tests
- Connect to real OAuth2-protected MCP server (test account)
- Verify token reuse across gateway restarts

## Migration Path

This is an additive change:
- Existing configurations without `oauth` field work unchanged
- OAuth2 is opt-in per server
- No breaking changes to existing functionality
- Clear upgrade path in documentation
