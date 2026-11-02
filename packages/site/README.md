# Site

This package holds the static Astro 7 site for relatinator.darko.io: the landing page, the demo page, and the docs pages. `astro build` writes static files to `packages/site/dist`. The `Dockerfile` at the repository root serves those files with nginx.

## Develop

Run these commands from the repository root:

| Command                      | What it does                                                        |
| ---------------------------- | ------------------------------------------------------------------- |
| `pnpm install`               | Installs the dependencies of every package.                         |
| `pnpm --filter site dev`     | Starts the Astro dev server at `http://localhost:4321`.             |
| `pnpm --filter site preview` | Serves the last build at `http://localhost:4321`.                   |
| `pnpm --filter site check`   | Builds the libraries, then runs `astro check` over the site source. |

Astro 7 can run the dev server in the background. `astro dev status`, `astro dev logs`, and `astro dev stop` control it. Run them with `pnpm --filter site exec`.

The docs pages render the Markdown files of this repository in place: the two package READMEs and `docs/architecture.md`. Edit those files to change the docs pages.

## Test

The suite holds 38 Playwright tests for the landing page, the demo page, and the docs pages. Each test fails when the page logs a console warning or error.

| Command                                                  | What it does                                                                  |
| -------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `pnpm --filter site test`                                | Builds the libraries, starts the dev server on port 4329, and runs the suite. |
| `SITE_URL=http://127.0.0.1:8080 pnpm --filter site test` | Runs the suite against the site at that origin.                               |

Use the second form to test the container. With no server on port 4329, the first run can print `Process from config.webServer exited early.` because Astro 7 detaches its dev server. Run the command again.

## Build

Run these commands from the repository root, in this order:

1. `pnpm --filter relatinator build`
2. `pnpm --filter site build`

The site imports the `relatinator` workspace package from its `dist` output, so that package builds first. The site build writes HTML pages, `logo.svg`, and hashed assets under `dist/_astro/`. Any static file server can serve the output.

## Container

The `Dockerfile` at the repository root builds the image in two stages. Stage 1 runs the two build steps above on Node 24. Stage 2 copies the output into `nginxinc/nginx-unprivileged`. The final image has no Node.js and is about 62 MB.

Run these commands from the repository root:

```sh
podman build --format docker -t relatinator-site .
podman run -d --rm --name site -p 8080:8080 relatinator-site
podman inspect site --format '{{.State.Health.Status}}'
```

The inspect command prints `healthy` about 40 seconds after the start. When host port 8080 is taken, map another host port, for example `-p 18080:8080`, and set `SITE_URL` to match.

About the image:

- nginx listens on port 8080 and runs as uid 101. The image needs no `USER` line and no privileged port.
- `packages/site/nginx.conf` is the one `server` block. HTML gets `Cache-Control: no-cache`. Assets under `/_astro/` carry a hash in their name, so they get `Cache-Control: public, max-age=31536000, immutable`. Every response gets `X-Content-Type-Options: nosniff`, and `server_tokens off` hides the nginx version.
- nginx redirects `/docs/` to `/docs/relatinator/` with a 301, and a path without a trailing slash to the path with one.
- gzip covers CSS, JavaScript, SVG, JSON, and text.
- Podman writes OCI images by default and drops the `HEALTHCHECK` line, so pass `--format docker`. Docker and Coolify keep the health check without a flag.

## Deploy on Coolify

1. In Coolify, add a new resource of type Public Repository, or Private Repository with the GitHub app. Set the repository to `https://github.com/DBozhinovski/relatinator` and the branch to `master`.
2. Set Build Pack to `Dockerfile`. Leave the Base Directory at `/` and the Dockerfile Location at `/Dockerfile`.
3. Set Ports Exposes to `8080`.
4. Set the domain to `https://relatinator.darko.io`. Coolify issues the certificate. The domain must match `site` in `astro.config.mjs`.
5. Deploy. Coolify waits for the container's health check before it routes traffic.

NOTE: The image is a static nginx server. It has no environment variables and no volumes.
