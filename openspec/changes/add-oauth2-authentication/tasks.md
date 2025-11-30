# Tasks: Add OAuth2 Authentication for MCP Servers

## Implementation Status

**✅ Core Implementation Complete** - All critical OAuth2 functionality has been implemented:

### Completed Tasks:
- [x] Task 1.1: OAuth2 configuration types
- [x] Task 1.2: Configuration schema validation
- [x] Task 2.1: Storage approach selected (file-based with secure permissions)
- [x] Task 2.2: OAuth data storage implementation
- [x] Task 3.1: Authorization Code provider
- [x] Task 3.2: Client Credentials provider
- [x] Task 3.3: Provider factory
- [x] Task 4.1: McpClient OAuth integration
- [x] Task 5.1: Standalone `toolscript auth` command
- [x] Task 5.2: Auth command registered in CLI
- [x] Task 5.3: Browser opening utility
- [x] Task 6.2: OAuth2 logging throughout

### Pending Tasks:
- [ ] Task 1.3: OAuth2 documentation (docs/oauth2.md)
- [ ] Task 6.1: Additional error message improvements
- [ ] Task 7.1-7.3: Unit/integration/E2E tests
- [ ] Task 7.4: README updates
- [ ] Task 8.1-8.3: Security review, cross-platform testing, changelog

### Skipped Tasks:
- Task 4.2: OAuth callback in gateway (not needed - auth command runs standalone callback server)
- Task 4.3: OAuth state tracking in Aggregator (handled by McpClient)

## Overview

This implementation leverages MCP SDK's built-in OAuth2 support and OAuth discovery, resulting in a much simpler implementation than manual OAuth configuration.

**Key Simplifications:**
- OAuth discovery eliminates manual endpoint configuration
- MCP SDK's built-in providers handle OAuth logic (PKCE, token exchange, refresh)
- Only need to add persistent storage backend
- Explicit `toolscript auth` command avoids automatic browser opening
- Flow type inferred from config (no flow selector needed)

## Phase 1: Configuration and Types

### Task 1.1: Define Minimal OAuth2 Configuration Types
**File**: `src/config/types.ts`
- Define simple `OAuth2Config` interface:
  ```typescript
  interface OAuth2Config {
    clientId: string;
    clientSecret?: string;  // presence determines flow type
    scopes?: string[];
  }
  ```
- Extend `HttpServerConfig` and `SseServerConfig` with optional `oauth?: OAuth2Config`

**Validation**: TypeScript compilation, types exported

### Task 1.2: Add OAuth2 Configuration Schema Validation
**File**: `src/config/schema.ts`
- Add Zod schema for `OAuth2Config` requiring `clientId`
- Make `clientSecret` and `scopes` optional
- Reject `authorizationUrl`, `tokenUrl`, `redirectUri`, `flow` fields if present
- Add to `ServerConfigSchema`

**Validation**: Unit tests for valid configs and rejection of manual endpoints

### Task 1.3: Update Configuration Examples
**File**: `docs/oauth2.md` (new file)
- Authorization Code example (GitHub): only `clientId`
- Client Credentials example (internal API): `clientId` + `clientSecret`
- Environment variable usage for secrets
- Troubleshooting section

**Validation**: Examples are clear and minimal

## Phase 2: Token Storage

### Task 2.1: Research Keychain Library for Deno
**Research Task**
- Find Deno-compatible keychain library (FFI-based or native)
- Test on available platforms (macOS primarily, Windows/Linux if accessible)
- Document fallback behavior

**Validation**: Library selected, documented

### Task 2.2: Implement OAuth Data Storage Abstraction
**File**: `src/oauth/storage.ts` (new file)
- Create `OAuthStorage` interface for combined client + token storage:
  ```typescript
  interface OAuthData {
    client?: {
      client_id: string;
      client_secret?: string;
      registration_source: "dynamic" | "config";
    };
    tokens?: OAuthTokens;
  }

  interface OAuthStorage {
    getOAuthData(serverName: string): Promise<OAuthData | undefined>;
    saveOAuthData(serverName: string, data: OAuthData): Promise<void>;
    deleteOAuthData(serverName: string): Promise<void>;
  }
  ```
- Implement keychain backend (primary - tries first)
- Implement file backend (fallback - `~/.toolscript/oauth/<server>.json`, 0600 perms, no encryption)
- Factory function tries keychain first, falls back to file if unavailable
- Log warning when using file storage due to no encryption

**Validation**: Unit tests with mocked keychain

## Phase 3: OAuth2 Providers with Persistent Storage

### Task 3.1: Implement Persistent Authorization Code Provider
**File**: `src/oauth/providers/authorization-code-provider.ts` (new file)
- Implement `OAuthClientProvider` interface (MCP SDK)
- Constructor takes `TokenStorage` and server name
- `tokens()`: load from storage
- `saveTokens()`: persist to storage
- `clientInformation()`, `saveClientInformation()`: persist client registration
- `redirectToAuthorization()`: open browser or display URL
- `codeVerifier()`, `saveCodeVerifier()`: PKCE handled by MCP SDK, store verifier in memory or storage
- `state()`: generate random state, store for validation
- `redirectUrl`: return `http://localhost:<gateway-port>/oauth/callback`

**Validation**: Unit tests for all interface methods

### Task 3.2: Extend Client Credentials Provider with Persistence
**File**: `src/oauth/providers/client-credentials-provider.ts` (new file)
- Extend MCP SDK's `ClientCredentialsProvider`
- Add `TokenStorage` to constructor
- Override `tokens()` to load from storage
- Override `saveTokens()` to persist to storage
- Delegate all OAuth logic to parent class

**Validation**: Unit tests verify persistence

### Task 3.3: Create Provider Factory
**File**: `src/oauth/providers/index.ts` (new file)
- `createOAuthProvider(config: OAuth2Config, storage: TokenStorage, serverName: string, gatewayPort: number)`
- Infer flow: `config.clientSecret ? client_credentials : authorization_code`
- Return appropriate provider instance
- Log inferred flow type

**Validation**: Unit tests for both flows

## Phase 4: Gateway Integration

### Task 4.1: Integrate OAuth2 into McpClient
**File**: `src/gateway/mcp-client.ts`
- In `connect()` method, detect `oauth` field in `ServerConfig`
- Create token storage for server
- Create OAuth provider using factory
- Pass `authProvider` option to `StreamableHTTPClientTransport` or `SSEClientTransport`
- MCP SDK handles OAuth discovery and authentication automatically
- Handle `UnauthorizedError` from SDK: log error indicating auth required

**Validation**: Integration tests with mock OAuth server

### Task 4.2: Add OAuth2 Callback Endpoint to Gateway
**File**: `src/gateway/server.ts`
- Add `GET /oauth/callback` route to Hono app
- Extract `code` and `state` from query params
- Look up pending auth session by state
- Call MCP SDK's auth completion method with code
- Provider's `saveTokens()` is called automatically
- Return HTML success/error page
- Track pending auth sessions (state → server name mapping)
- Timeout pending sessions after 5 minutes

**Validation**: Integration test simulates OAuth callback

### Task 4.3: Add OAuth2 State Tracking in Aggregator
**File**: `src/gateway/aggregator.ts`
- Add `oauthStatus` field to server state
- Track: `authenticated | pending_authorization | authentication_failed`
- Expose in `getServers()` response
- Update status when provider callbacks occur

**Validation**: Test `/servers` endpoint includes `oauth_status`

## Phase 5: CLI Auth Command

### Task 5.1: Implement Standalone Auth Command
**File**: `src/cli/commands/auth.ts` (new file)
- Parse `<server-name>` argument (optional)
- **If no server-name**: List all OAuth2 servers with authentication status and flow type
  - Check storage backend for each server
  - Display: server name, flow type, auth status (authenticated/not authenticated)
- **If server-name provided**:
  - Read server config from `.toolscript.json`
  - Perform OAuth discovery
  - Obtain client credentials (stored → config → dynamic registration)
  - Start temporary callback server on random port
  - Generate and display authorization URL to stdout
  - Attempt to open browser for authorization
  - If browser opening fails, display fallback message
  - Wait for callback with progress indicators
  - Exchange code for tokens via MCP SDK
  - Save client info + tokens to storage backend
  - Shutdown callback server
  - Display success message: "✓ Authorization successful! Credentials stored securely."
  - Timeout after 5 minutes
  - Handle Ctrl+C gracefully
- Validate flow is `authorization_code` (reject `client_credentials` with helpful error)
- Command runs independently without gateway running

**Validation**: E2E test with mock OAuth server

### Task 5.2: Add Auth Command to CLI
**File**: `src/cli/main.ts`
- Register `auth` subcommand
- Add to help output

**Validation**: `toolscript --help` shows auth command

### Task 5.3: Implement Browser Opening Utility
**File**: `src/oauth/browser.ts` (new file)
- `openBrowser(url: string)`: platform-specific
- macOS: `open`, Windows: `start`, Linux: `xdg-open`
- Fallback to displaying URL if command fails

**Validation**: Manual test on each platform

## Phase 6: User Experience and Error Handling

### Task 6.1: Add Clear Error Messages
**Files**: Multiple
- Unauthenticated server error: "Server '<name>' requires OAuth2. Run: toolscript auth <name>"
- Client credentials failure: detailed credential/endpoint errors
- OAuth discovery failure: "Server does not support OAuth2 or is misconfigured"
- All errors actionable and user-friendly

**Validation**: Test all error scenarios

### Task 6.2: Add OAuth2 Logging
**Files**: Multiple
- Discovery attempt at DEBUG
- Flow inference at INFO
- Token acquisition at INFO (no token values)
- Token refresh at DEBUG
- Errors at ERROR with context
- Never log secrets, tokens, codes, state

**Validation**: Review logs, verify no secrets

## Phase 7: Testing and Documentation

### Task 7.1: Unit Tests
**Files**: `src/oauth/**/*.test.ts`, `src/config/*.test.ts`
- Token storage (keychain mock + file)
- OAuth providers (all interface methods)
- Configuration validation
- Flow type inference

**Validation**: >80% coverage for OAuth module

### Task 7.2: Integration Tests
**Files**: `tests/integration/oauth2.test.ts`
- Full Authorization Code flow with mock OAuth server
- Client Credentials flow with mock server
- Token persistence and reload
- Callback handling
- Error scenarios

**Validation**: All integration tests pass

### Task 7.3: E2E Tests
**Files**: `tests/e2e/oauth2.test.ts`
- `toolscript auth` command end-to-end
- Token reuse across gateway restarts
- Both flows tested

**Validation**: E2E tests pass

### Task 7.4: Documentation
**Files**: `README.md`, `docs/oauth2.md`, `docs/cli.md`
- Add OAuth2 section to README
- Comprehensive OAuth2 guide with minimal config examples
- Document `toolscript auth` command
- Troubleshooting section
- Provider-specific examples (GitHub, Google, etc.)

**Validation**: Documentation review

## Phase 8: Polish

### Task 8.1: Security Review
**Review Task**
- Token storage security (keychain + file perms)
- No secrets in logs
- State parameter validation
- PKCE handled by MCP SDK (verify)

**Validation**: Security checklist completed

### Task 8.2: Cross-Platform Testing
**Testing Task**
- macOS (keychain + file fallback)
- Windows (if accessible)
- Linux (if accessible)
- Document platform-specific behavior

**Validation**: Tested on available platforms

### Task 8.3: Update Changelog
**Files**: `CHANGELOG.md`
- Document OAuth2 feature
- Include minimal config examples
- Note MCP OAuth discovery requirement

**Validation**: Changelog review

## Dependencies Between Tasks

```
Phase 1 (Config) → Phase 2 (Storage) → Phase 3 (Providers) → Phase 4 (Gateway)
                                                              → Phase 5 (CLI Auth)
                                                              ↓
                                      Phase 6 (UX) ← Phase 4 & 5
                                           ↓
                                      Phase 7 (Testing)
                                           ↓
                                      Phase 8 (Polish)
```

## Estimated Effort

- Phase 1: 0.5-1 day (minimal config types)
- Phase 2: 1-2 days (keychain library + storage)
- Phase 3: 1-2 days (providers using MCP SDK)
- Phase 4: 2-3 days (gateway integration)
- Phase 5: 1-2 days (auth command)
- Phase 6: 1 day (errors + logging)
- Phase 7: 2-3 days (testing)
- Phase 8: 1 day (polish)

**Total**: ~10-15 days (significantly reduced from original estimate)

## Key Simplifications vs. Original Plan

1. **No manual OAuth endpoints** - OAuth discovery handles this (saves ~2 days)
2. **MCP SDK providers** - No custom OAuth logic needed (saves ~3 days)
3. **Explicit auth only** - No automatic browser opening complexity (saves ~1 day)
4. **Flow inference** - No flow selector validation (saves ~0.5 day)
5. **Simpler config** - Just clientId/clientSecret/scopes (saves ~1 day)

**Total time saved**: ~7-8 days