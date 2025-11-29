# configuration Specification Delta

## Purpose
Extend configuration schema to support optional OAuth2 authentication parameters, with dynamic client registration as the default path.

## MODIFIED Requirements

### Requirement: MCP Server Configuration
The config file SHALL follow Claude Code's MCP server configuration format.

#### Scenario: Server with no oauth field (zero config)
- **WHEN** server config has no oauth field
- **THEN** server uses OAuth discovery and dynamic client registration when `toolscript auth` is run

#### Scenario: Server with oauth.clientId only (pre-registered public client)
- **WHEN** server config includes oauth field with only clientId
- **THEN** server uses Authorization Code flow with pre-registered client

#### Scenario: Server with oauth.clientId and clientSecret (confidential client)
- **WHEN** server config includes oauth field with clientId and clientSecret
- **THEN** server uses Client Credentials flow with automatic authentication

#### Scenario: OAuth2 config with environment variable substitution
- **WHEN** oauth config fields use ${VAR} syntax
- **THEN** system substitutes values from environment (e.g., ${GITHUB_CLIENT_ID})

#### Scenario: Optional scopes in OAuth2 config
- **WHEN** oauth config includes scopes array
- **THEN** system requests specified scopes during authentication

#### Scenario: Server config without oauth field works normally
- **WHEN** server config has no oauth field
- **THEN** server connection proceeds normally, OAuth only required if server responds with 401

#### Scenario: OAuth2 uses discovery not manual endpoints
- **WHEN** oauth config is specified (or not)
- **THEN** system uses MCP server's OAuth discovery endpoint, never manual authorizationUrl/tokenUrl configuration

### Requirement: Configuration Validation
The system SHALL validate configuration against schema before use.

#### Scenario: OAuth field is completely optional
- **WHEN** server config is validated
- **THEN** oauth field is optional

#### Scenario: ClientId is optional within oauth field
- **WHEN** oauth object is present
- **THEN** clientId is optional (dynamic registration provides it)

#### Scenario: ClientSecret presence determines flow
- **WHEN** clientSecret is provided in oauth config
- **THEN** system infers client_credentials flow

#### Scenario: ClientSecret absence determines flow
- **WHEN** clientSecret is not provided or no oauth field
- **THEN** system infers authorization_code flow

#### Scenario: Optional scopes array
- **WHEN** oauth config includes scopes
- **THEN** scopes must be array of strings

#### Scenario: Reject manual endpoint configuration
- **WHEN** oauth config includes authorizationUrl, tokenUrl, redirectUri, or flow fields
- **THEN** validation fails indicating these fields are not supported (discovery-only)

#### Scenario: Environment variable substitution for secrets
- **WHEN** clientId or clientSecret use ${VAR} syntax
- **THEN** system substitutes from environment before validation

### Requirement: Configuration Examples
The system SHALL provide example configurations for common scenarios.

#### Scenario: Example zero config (dynamic registration)
- **WHEN** user needs OAuth2 zero config example
- **THEN** example shows server with only type and url, no oauth field

#### Scenario: Example OAuth2 authorization_code (pre-registered)
- **WHEN** user needs OAuth2 authorization_code example
- **THEN** example shows minimal config with only clientId from environment variable

#### Scenario: Example OAuth2 client_credentials (confidential client)
- **WHEN** user needs OAuth2 client_credentials example
- **THEN** example shows config with clientId and clientSecret from environment variables

#### Scenario: Example with scopes
- **WHEN** user needs example with specific scopes
- **THEN** example shows oauth config with scopes array

#### Scenario: Example with multiple servers and mixed auth
- **WHEN** user needs mixed authentication example
- **THEN** example shows config with OAuth2 and non-OAuth2 servers

### Requirement: Configuration Schema
The system SHALL define configuration structure with TypeScript types.

#### Scenario: OAuth2Config type definition
- **WHEN** OAuth2 configuration is defined
- **THEN** TypeScript type includes clientId (optional), clientSecret (optional), scopes (optional)

#### Scenario: ServerConfig extends with optional oauth field
- **WHEN** ServerConfig is defined
- **THEN** type includes optional oauth field of type OAuth2Config

#### Scenario: Type-safe OAuth2 config access
- **WHEN** code accesses oauth config
- **THEN** TypeScript provides autocomplete and type checking for clientId, clientSecret, scopes

#### Scenario: No flow field in OAuth2Config type
- **WHEN** OAuth2Config type is defined
- **THEN** flow field is not included (inferred from clientSecret presence)

#### Scenario: All oauth fields are optional
- **WHEN** OAuth2Config type is defined
- **THEN** all fields (clientId, clientSecret, scopes) are optional