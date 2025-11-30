/**
 * Tests for OAuth storage layer
 */

import { assertEquals, assertExists, assertRejects } from "@std/assert";
import { FileOAuthStorage } from "./storage.ts";
import { join } from "https://deno.land/std@0.224.0/path/mod.ts";
import type { OAuthData } from "./types.ts";

Deno.test("FileOAuthStorage - saves and loads OAuth data", async () => {
  const tempDir = await Deno.makeTempDir();
  const storage = new FileOAuthStorage(tempDir);

  const testData: OAuthData = {
    clientInformation: {
      client_id: "test-client-id",
      client_secret: "test-secret",
    },
    tokens: {
      access_token: "test-access-token",
      token_type: "Bearer",
      expires_in: 3600,
    },
  };

  try {
    // Save data
    await storage.saveOAuthData("test-server", testData);

    // Load data
    const loaded = await storage.getOAuthData("test-server");
    assertExists(loaded);
    assertEquals(loaded.clientInformation?.client_id, "test-client-id");
    assertEquals(loaded.clientInformation?.client_secret, "test-secret");
    assertEquals(loaded.tokens?.access_token, "test-access-token");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("FileOAuthStorage - returns undefined for non-existent server", async () => {
  const tempDir = await Deno.makeTempDir();
  const storage = new FileOAuthStorage(tempDir);

  try {
    const data = await storage.getOAuthData("nonexistent");
    assertEquals(data, undefined);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("FileOAuthStorage - deletes OAuth data", async () => {
  const tempDir = await Deno.makeTempDir();
  const storage = new FileOAuthStorage(tempDir);

  const testData: OAuthData = {
    clientInformation: {
      client_id: "test-client-id",
    },
  };

  try {
    // Save data
    await storage.saveOAuthData("test-server", testData);

    // Verify it exists
    let loaded = await storage.getOAuthData("test-server");
    assertExists(loaded);

    // Delete it
    await storage.deleteOAuthData("test-server");

    // Verify it's gone
    loaded = await storage.getOAuthData("test-server");
    assertEquals(loaded, undefined);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("FileOAuthStorage - sanitizes server names", async () => {
  const tempDir = await Deno.makeTempDir();
  const storage = new FileOAuthStorage(tempDir);

  const testData: OAuthData = {
    clientInformation: {
      client_id: "test-client-id",
    },
  };

  try {
    // Save with special characters (should be sanitized)
    await storage.saveOAuthData("../../../malicious", testData);

    // Verify file was created in safe location (sanitized name)
    const files = [];
    for await (const file of Deno.readDir(tempDir)) {
      files.push(file.name);
    }

    // Should only be one file with sanitized name
    // "../../../malicious" has 9 non-alphanumeric characters that become underscores
    assertEquals(files.length, 1);
    assertEquals(files[0], "_________malicious.json");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("FileOAuthStorage - sets secure file permissions on Unix", async () => {
  // Skip on Windows
  if (Deno.build.os === "windows") {
    return;
  }

  const tempDir = await Deno.makeTempDir();
  const storage = new FileOAuthStorage(tempDir);

  const testData: OAuthData = {
    clientInformation: {
      client_id: "test-client-id",
    },
  };

  try {
    await storage.saveOAuthData("test-server", testData);

    // Check file permissions
    const filePath = join(tempDir, "test-server.json");
    const fileInfo = await Deno.stat(filePath);

    // Permissions should be 0600 (owner read/write only)
    // Note: mode includes file type bits, so we mask with 0o777
    const permissions = fileInfo.mode! & 0o777;
    assertEquals(permissions, 0o600);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("FileOAuthStorage - updates existing data", async () => {
  const tempDir = await Deno.makeTempDir();
  const storage = new FileOAuthStorage(tempDir);

  const initialData: OAuthData = {
    clientInformation: {
      client_id: "initial-client-id",
    },
  };

  const updatedData: OAuthData = {
    clientInformation: {
      client_id: "initial-client-id",
    },
    tokens: {
      access_token: "new-token",
      token_type: "Bearer",
      expires_in: 3600,
    },
  };

  try {
    // Save initial data
    await storage.saveOAuthData("test-server", initialData);

    // Update with tokens
    await storage.saveOAuthData("test-server", updatedData);

    // Load and verify
    const loaded = await storage.getOAuthData("test-server");
    assertExists(loaded);
    assertEquals(loaded.clientInformation?.client_id, "initial-client-id");
    assertEquals(loaded.tokens?.access_token, "new-token");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("FileOAuthStorage - handles JSON parse errors gracefully", async () => {
  const tempDir = await Deno.makeTempDir();
  const storage = new FileOAuthStorage(tempDir);

  try {
    // Manually write invalid JSON
    const filePath = join(tempDir, "corrupt.json");
    await Deno.writeTextFile(filePath, "{ invalid json }");

    // Should throw error
    await assertRejects(
      () => storage.getOAuthData("corrupt"),
      Error,
      "Failed to read OAuth data",
    );
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("FileOAuthStorage - creates storage directory if it doesn't exist", async () => {
  const tempDir = await Deno.makeTempDir();
  const storageDir = join(tempDir, "oauth");
  const storage = new FileOAuthStorage(storageDir);

  const testData: OAuthData = {
    clientInformation: {
      client_id: "test-client-id",
    },
  };

  try {
    // Storage dir doesn't exist yet
    let dirExists = false;
    try {
      await Deno.stat(storageDir);
      dirExists = true;
    } catch {
      dirExists = false;
    }
    assertEquals(dirExists, false);

    // Save data (should create directory)
    await storage.saveOAuthData("test-server", testData);

    // Directory should now exist
    const dirInfo = await Deno.stat(storageDir);
    assertEquals(dirInfo.isDirectory, true);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("FileOAuthStorage - saves client information without tokens", async () => {
  const tempDir = await Deno.makeTempDir();
  const storage = new FileOAuthStorage(tempDir);

  const testData: OAuthData = {
    clientInformation: {
      client_id: "test-client-id",
      client_secret: "test-secret",
    },
  };

  try {
    await storage.saveOAuthData("test-server", testData);

    const loaded = await storage.getOAuthData("test-server");
    assertExists(loaded);
    assertExists(loaded.clientInformation);
    assertEquals(loaded.clientInformation.client_id, "test-client-id");
    assertEquals(loaded.tokens, undefined);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("FileOAuthStorage - saves tokens without client information", async () => {
  const tempDir = await Deno.makeTempDir();
  const storage = new FileOAuthStorage(tempDir);

  const testData: OAuthData = {
    tokens: {
      access_token: "test-access-token",
      token_type: "Bearer",
      expires_in: 3600,
    },
  };

  try {
    await storage.saveOAuthData("test-server", testData);

    const loaded = await storage.getOAuthData("test-server");
    assertExists(loaded);
    assertExists(loaded.tokens);
    assertEquals(loaded.tokens.access_token, "test-access-token");
    assertEquals(loaded.clientInformation, undefined);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("FileOAuthStorage - saves complete OAuth data with both client and tokens", async () => {
  const tempDir = await Deno.makeTempDir();
  const storage = new FileOAuthStorage(tempDir);

  const testData: OAuthData = {
    clientInformation: {
      client_id: "test-client-id",
      client_secret: "test-secret",
    },
    tokens: {
      access_token: "test-access-token",
      token_type: "Bearer",
      expires_in: 3600,
      refresh_token: "test-refresh-token",
    },
  };

  try {
    await storage.saveOAuthData("test-server", testData);

    const loaded = await storage.getOAuthData("test-server");
    assertExists(loaded);
    assertExists(loaded.clientInformation);
    assertExists(loaded.tokens);
    assertEquals(loaded.clientInformation.client_id, "test-client-id");
    assertEquals(loaded.tokens.access_token, "test-access-token");
    assertEquals(loaded.tokens.refresh_token, "test-refresh-token");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("FileOAuthStorage - handles multiple servers independently", async () => {
  const tempDir = await Deno.makeTempDir();
  const storage = new FileOAuthStorage(tempDir);

  try {
    // Save data for multiple servers
    await storage.saveOAuthData("server1", {
      clientInformation: {
        client_id: "client1",
      },
      tokens: {
        access_token: "token1",
        token_type: "Bearer",
        expires_in: 3600,
      },
    });

    await storage.saveOAuthData("server2", {
      clientInformation: {
        client_id: "client2",
      },
      tokens: {
        access_token: "token2",
        token_type: "Bearer",
        expires_in: 7200,
      },
    });

    // Load and verify each server's data
    const data1 = await storage.getOAuthData("server1");
    const data2 = await storage.getOAuthData("server2");

    assertExists(data1);
    assertExists(data2);

    assertEquals(data1.clientInformation?.client_id, "client1");
    assertEquals(data1.tokens?.access_token, "token1");

    assertEquals(data2.clientInformation?.client_id, "client2");
    assertEquals(data2.tokens?.access_token, "token2");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("FileOAuthStorage - delete operation doesn't affect other servers", async () => {
  const tempDir = await Deno.makeTempDir();
  const storage = new FileOAuthStorage(tempDir);

  try {
    // Save data for two servers
    await storage.saveOAuthData("server1", {
      clientInformation: { client_id: "client1" },
    });
    await storage.saveOAuthData("server2", {
      clientInformation: { client_id: "client2" },
    });

    // Delete one server
    await storage.deleteOAuthData("server1");

    // server1 should be gone
    const data1 = await storage.getOAuthData("server1");
    assertEquals(data1, undefined);

    // server2 should still exist
    const data2 = await storage.getOAuthData("server2");
    assertExists(data2);
    assertEquals(data2.clientInformation?.client_id, "client2");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("FileOAuthStorage - delete non-existent server doesn't throw", async () => {
  const tempDir = await Deno.makeTempDir();
  const storage = new FileOAuthStorage(tempDir);

  try {
    // Deleting non-existent server should not throw
    await storage.deleteOAuthData("nonexistent-server");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("FileOAuthStorage - handles server names with allowed special characters", async () => {
  const tempDir = await Deno.makeTempDir();
  const storage = new FileOAuthStorage(tempDir);

  try {
    // Server names with hyphens and underscores should work
    await storage.saveOAuthData("my-server_test", {
      clientInformation: { client_id: "test" },
    });

    const data = await storage.getOAuthData("my-server_test");
    assertExists(data);
    assertEquals(data.clientInformation?.client_id, "test");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("FileOAuthStorage - saves with scope field in tokens", async () => {
  const tempDir = await Deno.makeTempDir();
  const storage = new FileOAuthStorage(tempDir);

  try {
    await storage.saveOAuthData("test-server", {
      tokens: {
        access_token: "test-token",
        token_type: "Bearer",
        expires_in: 3600,
        scope: "read write",
      },
    });

    const loaded = await storage.getOAuthData("test-server");
    assertExists(loaded);
    assertExists(loaded.tokens);
    assertEquals(loaded.tokens.scope, "read write");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("FileOAuthStorage - preserves all OAuthClientInformation fields", async () => {
  const tempDir = await Deno.makeTempDir();
  const storage = new FileOAuthStorage(tempDir);

  try {
    await storage.saveOAuthData("test-server", {
      clientInformation: {
        client_id: "test-client-id",
        client_secret: "test-secret",
        client_id_issued_at: 1234567890,
        client_secret_expires_at: 1234577890,
      },
    });

    const loaded = await storage.getOAuthData("test-server");
    assertExists(loaded);
    assertExists(loaded.clientInformation);
    assertEquals(loaded.clientInformation.client_id, "test-client-id");
    assertEquals(loaded.clientInformation.client_secret, "test-secret");
    assertEquals(loaded.clientInformation.client_id_issued_at, 1234567890);
    assertEquals(loaded.clientInformation.client_secret_expires_at, 1234577890);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});
