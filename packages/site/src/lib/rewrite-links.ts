// Markdown plugins for the docs pages. They run at build time on every Markdown
// file the site renders, so repository links become site routes and tables get
// the wrapper that global.css scrolls.
import { existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type SatteriProcessorOptions } from "@astrojs/markdown-satteri";

// One entry of the `hastPlugins` option list: the shape the markdown processor
// accepts.
type PluginDefinition = NonNullable<SatteriProcessorOptions["hastPlugins"]>[0];

const OWNER = "DBozhinovski";
const REPO = "relatinator";
const BLOB = `https://github.com/${OWNER}/${REPO}/blob/master/`;

// Each rendered Markdown file and the site route it renders to.
const DOC_ROUTES: Record<string, string> = {
  "packages/relatinator/README.md": "/docs/relatinator/",
  "packages/astro-relatinator/README.md": "/docs/astro-relatinator/",
  "docs/architecture.md": "/docs/architecture/",
};

function splitHref(href: string): [target: string, fragment: string] {
  const mark = href.indexOf("#");
  if (mark === -1) {
    return [href, ""];
  }
  return [href.slice(0, mark), href.slice(mark + 1)];
}

function withFragment(path: string, fragment: string): string {
  return fragment === "" ? path : `${path}#${fragment}`;
}

// The repository path a link names, or undefined when the link points outside
// this repository.
function repoTarget(source: string, target: string, repoRoot: string): string | undefined {
  if (target.startsWith("http://") || target.startsWith("https://")) {
    return githubTarget(target);
  }
  const joined = relative(repoRoot, resolve(dirname(source), target));
  if (joined.startsWith("..")) {
    return undefined;
  }
  if (joined in DOC_ROUTES || existsSync(join(repoRoot, joined))) {
    return joined;
  }
  const rooted = target.startsWith("/") ? target.slice(1) : target;
  if (rooted in DOC_ROUTES || existsSync(join(repoRoot, rooted))) {
    return rooted;
  }
  return joined;
}

// A GitHub URL of this repository, as the repository path it names.
function githubTarget(url: string): string | undefined {
  if (!URL.canParse(url)) {
    return undefined;
  }
  const parsed = new URL(url);
  if (parsed.hostname !== "github.com") {
    return undefined;
  }
  const parts = parsed.pathname.split("/");
  const named = parts[1] === OWNER && parts[2] === REPO;
  if (!named || (parts[3] !== "blob" && parts[3] !== "tree")) {
    return undefined;
  }
  return parts.slice(5).join("/");
}

// The site route or GitHub URL an author link should point at, or undefined to
// leave the link as the author wrote it.
function anchorHref(source: string, href: string, repoRoot: string): string | undefined {
  const [target, fragment] = splitHref(href);
  if (target === "") {
    return undefined;
  }
  const fromGitHub = target.startsWith("http://") || target.startsWith("https://");
  const repoPath = repoTarget(source, target, repoRoot);
  if (repoPath === undefined) {
    return undefined;
  }
  const route = DOC_ROUTES[repoPath] ?? DOC_ROUTES[`${repoPath}/README.md`];
  if (route !== undefined) {
    return withFragment(route, fragment);
  }
  if (fromGitHub) {
    return undefined;
  }
  return withFragment(`${BLOB}${repoPath}`, fragment);
}

export function createLinkPlugin(repoRoot: string): PluginDefinition {
  return {
    name: "rewrite-links",
    element: {
      filter: ["a"],
      visit: (node, ctx) => {
        const href = node.properties.href;
        if (href === undefined || ctx.fileURL === undefined) {
          return;
        }
        const rewritten = anchorHref(fileURLToPath(ctx.fileURL), href, repoRoot);
        if (rewritten !== undefined && rewritten !== href) {
          ctx.setProperty(node, "href", rewritten);
        }
      },
    },
  };
}

// Tables need a wrapper element so each one scrolls on its own.
export function createTablePlugin(): PluginDefinition {
  return {
    name: "wrap-tables",
    element: {
      filter: ["table"],
      visit: (node, ctx) => {
        ctx.wrapNode(
          node,
          {
            type: "element",
            tagName: "div",
            properties: { className: ["table-wrap"] },
            children: [],
          },
        );
      },
    },
  };
}
