// The `astro-relatinator/emdash-plugin` entry point. It has no import, so
// the EmDash config can load it before EmDash starts.

/** The parts of the EmDash `PluginDescriptor` that this plugin sets. */
export interface RelatinatorTopicsDescriptor {
  readonly id: string;
  readonly version: string;
  readonly format: "standard";
  readonly entrypoint: string;
  readonly capabilities: string[];
  readonly routes: { name: string; permission: string }[];
  readonly editorPanels: {
    id: string;
    title: string;
    route: string;
    collections?: string[];
  }[];
}

export interface RelatinatorTopicsOptions {
  /** The collections that show the panel. By default, all collections. */
  readonly collections?: readonly string[];
}

/**
 * The EmDash plugin that suggests taxonomy terms for the saved text of an
 * entry. Put it in `plugins: []` of the EmDash integration.
 */
export default function relatinatorTopics({
  collections,
}: RelatinatorTopicsOptions = {}): RelatinatorTopicsDescriptor {
  const panel = {
    id: "suggested-topics",
    title: "Suggested topics",
    route: "panel",
  };
  return Object.freeze({
    id: "relatinator-topics",
    version: "3.1.0",
    format: "standard",
    entrypoint: "astro-relatinator/emdash-plugin/sandbox",
    capabilities: ["content:read", "taxonomies:write"],
    // Editors with `content:edit_own` can use the panel. EmDash also
    // checks that the user can edit the entry before it calls the route.
    routes: [{ name: "panel", permission: "content:edit_own" }],
    editorPanels: [
      collections ? { ...panel, collections: [...collections] } : panel,
    ],
  });
}
