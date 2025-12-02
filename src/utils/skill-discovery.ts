/**
 * Skill discovery utility for finding and parsing SKILL.md files
 * from global, project, and plugin sources.
 */

import { join } from "@std/path";
import { exists } from "@std/fs";
import { getLogger } from "@logtape/logtape";

const logger = getLogger(["toolscript", "utils", "skill-discovery"]);

/**
 * Get the global .claude directory path
 */
function getGlobalClaudeDirectory(): string | null {
  const home = Deno.env.get("HOME") || Deno.env.get("USERPROFILE");
  if (!home) {
    return null;
  }
  return join(home, ".claude");
}

export interface Skill {
  name: string;
  description: string;
  source: "global" | "project" | "plugin";
  pluginName?: string;
}

interface PluginMetadata {
  installPath: string;
  name: string;
}

/**
 * Parse YAML frontmatter from SKILL.md content
 */
export function parseSkillDescription(
  content: string,
): { name: string; description: string } | null {
  // Match YAML frontmatter between --- delimiters
  const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return null;
  }

  const frontmatter = match[1];
  let name: string | null = null;
  let description: string | null = null;

  // Parse name and description from YAML
  for (const line of frontmatter.split("\n")) {
    const nameMatch = line.match(/^name:\s*(.+)$/);
    if (nameMatch) {
      name = nameMatch[1].trim();
      continue;
    }

    const descMatch = line.match(/^description:\s*(.+)$/);
    if (descMatch) {
      description = descMatch[1].trim();
      continue;
    }
  }

  if (name && description) {
    return { name, description };
  }

  return null;
}

/**
 * Scan a directory for SKILL.md files
 */
async function scanSkillDirectory(
  basePath: string,
  source: "global" | "project" | "plugin",
  pluginName?: string,
): Promise<Skill[]> {
  const skills: Skill[] = [];

  try {
    const skillsPath = join(basePath, "skills");

    if (!await exists(skillsPath)) {
      return skills;
    }

    // Iterate over subdirectories in skills/
    for await (const entry of Deno.readDir(skillsPath)) {
      if (!entry.isDirectory) continue;

      const skillMdPath = join(skillsPath, entry.name, "SKILL.md");

      if (await exists(skillMdPath)) {
        try {
          const content = await Deno.readTextFile(skillMdPath);
          const parsed = parseSkillDescription(content);

          if (parsed) {
            logger.debug(
              `Found skill: ${parsed.name} (${source}${pluginName ? ` - ${pluginName}` : ""})`,
            );
            skills.push({
              ...parsed,
              source,
              pluginName,
            });
          }
        } catch {
          // Skip malformed files
          logger.debug(`Failed to parse skill file: ${skillMdPath}`);
        }
      }
    }
  } catch {
    // Directory doesn't exist or not accessible, return empty
  }

  return skills;
}

/**
 * Scan global skills from ~/.claude/skills
 */
export async function scanGlobalSkills(): Promise<Skill[]> {
  const claudeDir = getGlobalClaudeDirectory();
  if (!claudeDir) {
    return [];
  }

  const result = await scanSkillDirectory(claudeDir, "global");
  logger.debug(`Found ${result.length} global skills`);
  return result;
}

/**
 * Scan project skills from .claude/skills
 */
export async function scanProjectSkills(): Promise<Skill[]> {
  const cwd = Deno.cwd();
  const claudeDir = join(cwd, ".claude");
  return await scanSkillDirectory(claudeDir, "project");
}

/**
 * Load enabled plugins from ~/.claude/settings.json
 */
async function loadEnabledPlugins(): Promise<Set<string>> {
  try {
    const claudeDir = getGlobalClaudeDirectory();
    if (!claudeDir) return new Set();

    const settingsFile = join(claudeDir, "settings.json");

    if (!await exists(settingsFile)) {
      return new Set();
    }

    const content = await Deno.readTextFile(settingsFile);
    const settings = JSON.parse(content);

    if (
      settings && typeof settings.enabledPlugins === "object" && settings.enabledPlugins !== null
    ) {
      // enabledPlugins is an object with plugin names as keys and boolean values
      const enabledList = Object.entries(settings.enabledPlugins)
        .filter(([_name, enabled]) => enabled === true)
        .map(([name, _enabled]) => name);

      logger.debug(`Found ${enabledList.length} enabled plugins`);
      return new Set(enabledList);
    }

    return new Set();
  } catch (error) {
    logger.error("Error loading plugin settings", { error });
    return new Set();
  }
}

/**
 * Load installed plugins metadata from ~/.claude/plugins/installed_plugins.json
 */
export async function loadInstalledPlugins(): Promise<PluginMetadata[]> {
  try {
    const claudeDir = getGlobalClaudeDirectory();
    if (!claudeDir) {
      return [];
    }

    const pluginsFile = join(claudeDir, "plugins", "installed_plugins.json");

    if (!await exists(pluginsFile)) {
      return [];
    }

    const content = await Deno.readTextFile(pluginsFile);
    const data = JSON.parse(content);

    // Handle wrapper format with "plugins" key
    let pluginsData = data;
    if (typeof data === "object" && data !== null && "plugins" in data) {
      pluginsData = data.plugins;
    }

    // Load enabled plugins from settings
    const enabledPlugins = await loadEnabledPlugins();

    // pluginsData is an object with plugin names as keys
    if (typeof pluginsData === "object" && pluginsData !== null) {
      const plugins = Object.entries(pluginsData)
        .filter(([name, _meta]: [string, unknown]) => {
          // If enabledPlugins is empty, allow all (no settings file or no list)
          if (enabledPlugins.size === 0) return true;

          // Otherwise, only include if it's in the enabled list
          return enabledPlugins.has(name);
        })
        .map(([name, meta]: [string, unknown]) => ({
          name,
          installPath: typeof meta === "object" && meta !== null && "installPath" in meta
            ? String(meta.installPath)
            : typeof meta === "object" && meta !== null && "path" in meta
            ? String(meta.path)
            : "",
        }));
      logger.debug(`Loaded ${plugins.length} enabled plugins`);
      return plugins;
    }

    return [];
  } catch (error) {
    logger.error("Error loading plugins", { error });
    return [];
  }
}

/**
 * Scan skills from a single plugin
 */
export async function scanPluginSkills(plugin: PluginMetadata): Promise<Skill[]> {
  return await scanSkillDirectory(plugin.installPath, "plugin", plugin.name);
}

/**
 * Merge skills from all sources and deduplicate by name
 * Priority: project > global > plugin
 */
export function mergeSkills(skillLists: Skill[][]): Skill[] {
  const skillMap = new Map<string, Skill>();

  // Process in reverse priority order (plugin, global, project)
  // so later entries overwrite earlier ones
  for (const skills of skillLists) {
    for (const skill of skills) {
      // Project skills have highest priority, then global, then plugin
      const existing = skillMap.get(skill.name);

      if (!existing) {
        skillMap.set(skill.name, skill);
      } else {
        const priorityOrder = { "project": 3, "global": 2, "plugin": 1 };
        if (priorityOrder[skill.source] > priorityOrder[existing.source]) {
          skillMap.set(skill.name, skill);
        }
      }
    }
  }

  return Array.from(skillMap.values());
}

/**
 * Discover all skills from global, project, and plugin sources
 */
export async function discoverAllSkills(): Promise<Skill[]> {
  // Scan global skills
  const globalSkills = await scanGlobalSkills();

  // Scan project skills
  const projectSkills = await scanProjectSkills();

  // Scan plugin skills
  const plugins = await loadInstalledPlugins();
  const pluginSkillsLists = await Promise.all(
    plugins.map((plugin) => scanPluginSkills(plugin)),
  );
  const pluginSkills = pluginSkillsLists.flat();

  // Merge all skills with priority: project > global > plugin
  return mergeSkills([pluginSkills, globalSkills, projectSkills]);
}
