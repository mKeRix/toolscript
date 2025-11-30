# Proposal: Add OAuth2 Authentication for MCP Servers

## Change ID
`add-oauth2-authentication`

## Summary
Add OAuth2 authentication support to toolscript's MCP client layer, enabling connections to OAuth2-protected MCP servers. Authentication will be handled at the gateway level with persistent token storage using dynamic client registration and the Authorization Code flow.

## Motivation
Many MCP servers require OAuth2 authentication to access protected resources and APIs. Currently, toolscript only supports:
- HTTP servers with static headers (via `headers` config field)
- Stdio servers with environment variables

This limits integration with OAuth2-protected services like GitHub, Google APIs, Microsoft Graph, and other enterprise MCP servers that require dynamic token management, automatic refresh, and secure credential storage.

## Goals
1. Enable toolscript to connect to OAuth2-protected MCP servers using standard OAuth discovery
2. Support Authorization Code flow with dynamic client registration
3. Persist tokens securely between gateway restarts using file-based storage
4. Handle token refresh automatically via MCP SDK
5. Leverage the MCP TypeScript SDK's built-in OAuth2 support as much as possible
6. Provide explicit user control over Authorization Code authentication via CLI command
7. Fail gracefully with clear errors when authentication is required but not completed

## Non-Goals
- Implementing OAuth2 server functionality (only client-side authentication)
- Supporting tool-level OAuth configuration (server-level only)
- Manual OAuth2 endpoint configuration (rely on OAuth discovery)
- OAuth1.0a or other legacy authentication protocols
- Automatic browser opening during gateway startup (explicit auth command only)
- Custom OAuth2 provider implementations (use MCP SDK's providers)
- Supporting Client Credentials flow (Authorization Code only)
- OAuth configuration parameters in config file (discovery-based only)

## Implementation Approach
- Use MCP server's OAuth discovery endpoint to obtain authorization metadata
- Support dynamic client registration for obtaining client credentials
- New CLI command `toolscript auth <server-name>` for explicit Authorization Code flow
- Implement persistent token storage using file-based storage with 0600 permissions
- Integrate MCP SDK's OAuthClientProvider with custom storage backend
- Tool calls to unauthenticated servers fail with actionable error messages

## Dependencies
- MCP TypeScript SDK's OAuth2 client support (already available)
- Deno filesystem APIs for secure file storage
- No breaking changes to existing configuration format

## Risks and Mitigations
**Risk**: OAuth discovery not available on all servers
- **Mitigation**: Fail with clear error if discovery endpoint missing, document requirement

**Risk**: Token storage security (file-based, no encryption)
- **Mitigation**: Use 0600 file permissions and 0700 directory permissions on Unix-like systems. Future enhancement could add OS-specific keychain support via FFI

**Risk**: User confusion about auth requirements
- **Mitigation**: Clear error messages indicating auth is required, show exact command to run

**Risk**: Token refresh failures during active sessions
- **Mitigation**: MCP SDK handles refresh automatically, fall back to re-auth if refresh fails

## Success Criteria
- OAuth discovery automatically obtains authorization endpoints
- `toolscript auth <server>` command completes Authorization Code flow with dynamic client registration
- Tokens are stored securely and persist between gateway restarts
- Token refresh happens automatically via MCP SDK
- Tool calls to unauthenticated servers fail with clear, actionable error messages
- All OAuth2 operations are logged appropriately
