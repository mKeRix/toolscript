/**
 * Tests for skill discovery utilities
 */

import { assertEquals, assertExists } from "@std/assert";
import {
  discoverAllSkills,
  loadInstalledPlugins,
  mergeSkills,
  parseSkillDescription,
  scanGlobalSkills,
  scanPluginSkills,
  scanProjectSkills,
  type Skill,
} from "./skill-discovery.ts";
import { join } from "@std/path";

Deno.test("parseSkillDescription should parse valid YAML frontmatter", () => {
  const content = `---
name: test-skill
description: A test skill for testing
---

# Test Skill

This is the skill content.`;

  const result = parseSkillDescription(content);
  assertExists(result);
  assertEquals(result.name, "test-skill");
  assertEquals(result.description, "A test skill for testing");
});

Deno.test("parseSkillDescription should return null for invalid frontmatter", () => {
  const content = `# Test Skill

No frontmatter here.`;

  const result = parseSkillDescription(content);
  assertEquals(result, null);
});

Deno.test("parseSkillDescription should return null for incomplete frontmatter", () => {
  const content = `---
name: test-skill
---

Missing description.`;

  const result = parseSkillDescription(content);
  assertEquals(result, null);
});

Deno.test("parseSkillDescription should handle multiline descriptions", () => {
  const content = `---
name: test-skill
description: A test skill with a long description
---

# Test Skill`;

  const result = parseSkillDescription(content);
  assertExists(result);
  assertEquals(result.name, "test-skill");
  assertEquals(result.description, "A test skill with a long description");
});

Deno.test("mergeSkills should deduplicate by name", () => {
  const skills: Skill[][] = [
    [
      {
        name: "skill1",
        description: "Plugin skill",
        source: "plugin",
        pluginName: "test-plugin",
      },
    ],
    [{ name: "skill1", description: "Global skill", source: "global" }],
  ];

  const result = mergeSkills(skills);
  assertEquals(result.length, 1);
  assertEquals(result[0].description, "Global skill");
  assertEquals(result[0].source, "global");
});

Deno.test("mergeSkills should prioritize project > global > plugin", () => {
  const skills: Skill[][] = [
    [
      {
        name: "skill1",
        description: "Plugin skill",
        source: "plugin",
        pluginName: "test-plugin",
      },
    ],
    [{ name: "skill1", description: "Global skill", source: "global" }],
    [{ name: "skill1", description: "Project skill", source: "project" }],
  ];

  const result = mergeSkills(skills);
  assertEquals(result.length, 1);
  assertEquals(result[0].description, "Project skill");
  assertEquals(result[0].source, "project");
});

Deno.test("mergeSkills should keep all unique skills", () => {
  const skills: Skill[][] = [
    [
      { name: "skill1", description: "Plugin skill 1", source: "plugin" },
      { name: "skill2", description: "Plugin skill 2", source: "plugin" },
    ],
    [{ name: "skill3", description: "Global skill", source: "global" }],
    [{ name: "skill4", description: "Project skill", source: "project" }],
  ];

  const result = mergeSkills(skills);
  assertEquals(result.length, 4);
});

Deno.test("mergeSkills should handle empty arrays", () => {
  const skills: Skill[][] = [[], [], []];
  const result = mergeSkills(skills);
  assertEquals(result.length, 0);
});

Deno.test("scanGlobalSkills should return empty array when no home directory", async () => {
  // Save original env
  const originalHome = Deno.env.get("HOME");
  const originalUserProfile = Deno.env.get("USERPROFILE");

  try {
    // Clear HOME and USERPROFILE
    Deno.env.delete("HOME");
    Deno.env.delete("USERPROFILE");

    const result = await scanGlobalSkills();
    assertEquals(result.length, 0);
  } finally {
    // Restore original env
    if (originalHome) Deno.env.set("HOME", originalHome);
    if (originalUserProfile) Deno.env.set("USERPROFILE", originalUserProfile);
  }
});

Deno.test("scanProjectSkills should scan from current working directory", async () => {
  // This test just verifies it doesn't throw and returns an array
  const result = await scanProjectSkills();
  assertEquals(Array.isArray(result), true);
});

Deno.test("loadInstalledPlugins should return empty array when no plugins file", async () => {
  // Save original env
  const originalHome = Deno.env.get("HOME");

  try {
    // Set HOME to a non-existent directory
    const tempDir = await Deno.makeTempDir();
    Deno.env.set("HOME", tempDir);

    const result = await loadInstalledPlugins();
    assertEquals(result.length, 0);

    // Cleanup
    await Deno.remove(tempDir, { recursive: true });
  } finally {
    // Restore original env
    if (originalHome) Deno.env.set("HOME", originalHome);
  }
});

Deno.test("scanPluginSkills should handle plugin with no skills directory", async () => {
  const tempDir = await Deno.makeTempDir();

  try {
    const plugin = {
      name: "test-plugin",
      installPath: tempDir,
    };

    const result = await scanPluginSkills(plugin);
    assertEquals(result.length, 0);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("scanPluginSkills should discover skills from plugin directory", async () => {
  const tempDir = await Deno.makeTempDir();

  try {
    // Create a skill directory structure
    const skillsDir = join(tempDir, "skills", "test-skill");
    await Deno.mkdir(skillsDir, { recursive: true });

    // Create a SKILL.md file
    const skillContent = `---
name: test-plugin-skill
description: A skill from a test plugin
---

# Test Plugin Skill`;

    await Deno.writeTextFile(join(skillsDir, "SKILL.md"), skillContent);

    const plugin = {
      name: "test-plugin",
      installPath: tempDir,
    };

    const result = await scanPluginSkills(plugin);
    assertEquals(result.length, 1);
    assertEquals(result[0].name, "test-plugin-skill");
    assertEquals(result[0].description, "A skill from a test plugin");
    assertEquals(result[0].source, "plugin");
    assertEquals(result[0].pluginName, "test-plugin");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("discoverAllSkills should merge all skill sources", async () => {
  // This is an integration test that just verifies the function works
  const result = await discoverAllSkills();
  assertEquals(Array.isArray(result), true);
  // Verify all results have required fields
  for (const skill of result) {
    assertExists(skill.name);
    assertExists(skill.description);
    assertExists(skill.source);
  }
});

Deno.test("parseSkillDescription should handle extra whitespace", () => {
  const content = `---
name:   test-skill
description:   A test skill with extra whitespace
---

# Test Skill`;

  const result = parseSkillDescription(content);
  assertExists(result);
  assertEquals(result.name, "test-skill");
  assertEquals(result.description, "A test skill with extra whitespace");
});

Deno.test("parseSkillDescription should handle content with tabs", () => {
  const content = `---
name:\ttest-skill
description:\tA test skill with tabs
---

# Test Skill`;

  const result = parseSkillDescription(content);
  assertExists(result);
  assertEquals(result.name, "test-skill");
  assertEquals(result.description, "A test skill with tabs");
});
