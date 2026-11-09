<picture>
    <source srcset="./.github/logo-dark.png" media="(prefers-color-scheme: light)">
    <source srcset="./.github/logo-white.png" media="(prefers-color-scheme: dark)">
    <img src="./.github/logo-dark.png" alt="IT Tools logo">
</picture>

# IT Tools (fork)

A collection of handy online tools for developers and IT people, served as a static web app.

This is a fork of [sharevb/it-tools](https://github.com/sharevb/it-tools), itself a fork of [CorentinTh/it-tools](https://github.com/CorentinTh/it-tools), maintained at [PabloVTM/it-tools](https://github.com/PabloVTM/it-tools). It adds many tools, full UI translations and runtime customisation for the Docker image.

The interface uses the PabloSystems theme shared by the PabloVTM tools: Deep Sage Green `#4B5A50`, Warm Ivory `#F1EEE3` and Vibrant Vermillion Red `#F20B0B` for details, system monospace fonts and a `pablo@systems:~/tools` prompt as title, in light and dark modes.

## Image

Images are published to GitHub Container Registry for `linux/amd64` and `linux/arm64`:

| Tag | Content |
| --- | --- |
| `ghcr.io/pablovtm/it-tools:latest` | Latest build of `master`. |
| `ghcr.io/pablovtm/it-tools:YYYY-MM-DD` | Dated version, e.g. `2026-11-07`. Each build upgrades the Alpine packages, so a new dated version also brings the latest security fixes. |

The image is based on `nginx-unprivileged` and listens on port **8080** (not 80).

## Quick start

```yaml
services:
  it-tools:
    container_name: it-tools
    image: ghcr.io/pablovtm/it-tools:latest
    restart: unless-stopped
    ports:
      - 8080:8080
```

or

```bash
docker run -d --name it-tools --restart unless-stopped -p 8080:8080 ghcr.io/pablovtm/it-tools:latest
```

Then open http://localhost:8080.

**HTTPS is recommended**, even on an internal network: some tools (PGP encryption, anything using the WebCrypto API) and the PWA only work over HTTPS. Put the container behind a reverse proxy with a certificate (for example Let's Encrypt with a DNS challenge).

The app has no authentication. To restrict access, use forward-auth on your reverse proxy (for example [authentik](https://docs.goauthentik.io/docs/add-secure-apps/providers/proxy/server_nginx)).

## Runtime settings

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `8080` | Port nginx listens on. |
| `BASE_URL` | `/` | Path the app is served under, e.g. `/it-tools/`. See [Host in a subfolder](#host-in-a-subfolder). |

IPv6 listening needs IPv6 enabled on the host. Otherwise the container drops the `[::]` listener itself.

## Customisation

Mount the following files in `/usr/share/nginx/html`. Full examples are in [docker-tools-filter-and-home-content](docker-tools-filter-and-home-content) and [docker-with-services](docker-with-services).

### Custom home page content: `home.custom.md`

Markdown shown on the home page.

### Filter tools: `tools-filter.json`

```json
{
  "excludeCategoryFilterRegex": "",
  "includeCategoryFilterRegex": "",
  "excludeToolsFilterRegex": "",
  "includeToolsFilterRegex": ""
}
```

Category regexes match English category names; tool regexes match the tool path.

### Add external tools: `external-tools.json`

Each entry is either a link (`href`) or a Markdown page (`markdownContent`):

```json
[
  {
    "name": "GitHub",
    "path": "/github",
    "description": "Link to Github",
    "keywords": ["github"],
    "category": "Links",
    "href": "https://github.com"
  },
  {
    "name": "Some text",
    "path": "/some-text",
    "description": "Some description",
    "keywords": ["some"],
    "category": "Links",
    "markdownContent": "Some useful **text**\n\nin *markdown*"
  }
]
```

### Default tool parameters and UI language: `tools-settings.json`

The first level is the tool name, the second the parameter name. `default_locale` sets the UI language:

```json
{
  "default_locale": "fr",
  "regex-tester": {
    "multi": true,
    "regex": "some regex",
    "global": false
  }
}
```

Tool and parameter names are in each tool's source under `src/tools/`. They come from calls like:

* `useQueryParamOrStorage({ storageName: 'regex-tester:g', name: 'global', ... })` → `"regex-tester": { "global": false }`
* `useQueryParam({ tool: 'barcode-gen', name: 'text', ... })` → `"barcode-gen": { "text": "4356" }`
* `useITStorage('ascii-text-drawer:width', 80)` → `"ascii-text-drawer": { "width": 80 }`

### Companion services

Some tools need extra self-hosted services: HTTPS/DNS tools and ping, HTML to PDF, Docker image download, multi-link download, short URL expander, and TCP/UDP port tester. See [docker-with-services](docker-with-services) for a complete compose file.

## Offline / air-gapped deployments

Fonts, editor extensions, the ffmpeg core, the ONNX runtime and the Tesseract OCR engine (with English and Simplified Chinese data) ship with the app; nothing comes from a third-party CDN. Large assets are downloaded only when their tool is opened.

Add `"offline": true` to `tools-settings.json` on a network without internet access. Tools that need the internet are then hidden (my-ip, ip-geo-location, dns-query, dns-queries, dnsbl-checker, dns-propagation-tester, online-wiktionary, iana-whois-checker), and tools with a bundled fallback switch to it:

* gitignore-generator and gitattributes-generator use a bundled template snapshot (refresh it with `pnpm script:update:git-templates`).
* ocr-image offers only the bundled languages.
* JSON/YAML schema validation offers only a custom schema.
* geo-coordinates-converter works without a map.

Other tools work offline when pointed at an intranet mirror, and are hidden otherwise. Mirrors can also be used online:

```json
{
  "offline": true,
  "transformers": { "models-url": "https://intranet.example/hf-mirror/" },
  "ocr-image": { "lang-url": "https://intranet.example/tessdata/" },
  "json-schemas": { "catalog-url": "https://intranet.example/schemastore/api/json/catalog.json" },
  "currency-converter": { "url": "https://intranet.example/currency-api/" },
  "geo-coordinates-converter": {
    "tile-url": "https://tiles.intranet.example/{z}/{x}/{y}.png",
    "tile-attribution": "&copy; OpenStreetMap contributors"
  },
  "explainchain": { "url": "https://explainshell.intranet.example" }
}
```

| Setting | Used by | Expected content |
| --- | --- | --- |
| `transformers.models-url` | translator, remove-background, math-ocr | A Hugging Face mirror with the same layout: `<url>/<org>/<model>/resolve/main/<file>`. Relative URLs resolve against the app. |
| `ocr-image.lang-url` | ocr-image | A directory of `<lang>.traineddata.gz` files (`4.0.0_best_int` variant of `@tesseract.js-data/<lang>`). May contain a `{lang}` placeholder. |
| `json-schemas.catalog-url` | json-viewer, yaml-viewer, json-editor, json-linter | A copy of the [SchemaStore](https://www.schemastore.org) catalog; its schema URLs must be reachable too. |
| `currency-converter.url` | currency-converter | A mirror of `@fawazahmed0/currency-api`, serving `v1/currencies/<code>.json`. |
| `geo-coordinates-converter.tile-url` | geo-coordinates-converter | A Leaflet tile URL template; `tile-attribution` is optional. |
| `explainchain.url` | explainshell | A self-hosted [explainshell](https://github.com/idank/explainshell). |

Tools using the companion services stay available offline and work against intranet targets.

## Host in a subfolder

Set `BASE_URL` at run time; the same image works for any path:

```yaml
services:
  it-tools:
    image: ghcr.io/pablovtm/it-tools:latest
    restart: unless-stopped
    environment:
      BASE_URL: /it-tools/
    ports:
      - 8080:8080
```

`BASE_URL` accepts `it-tools`, `/it-tools` and `/it-tools/`.

Put a reverse proxy in front that forwards `/it-tools/` to the container. The proxy may strip the prefix (`proxy_pass http://it-tools:8080/;`) or forward it as is (`proxy_pass http://it-tools:8080;`). When it strips the prefix, it must also redirect `/it-tools` to `/it-tools/` itself. A working example is in [docker-subfolder-sample](docker-subfolder-sample):

```bash
cd docker-subfolder-sample/
docker compose up
```

Then open http://localhost/it-tools/.

On a read-only root filesystem, `BASE_URL` and `PORT` only take effect if `/etc/nginx/conf.d` is writable (mount a tmpfs there). The container logs a warning otherwise.

## Releasing

Images are built by GitHub Actions. A push to `master` publishes `latest`; a dated version is published by pushing a tag named after the day:

```bash
git tag 2026-11-09
git push origin 2026-11-09
```

The workflow tests the image first, then publishes `ghcr.io/pablovtm/it-tools:2026-11-09` and `latest` for `linux/amd64` and `linux/arm64`. There is no scheduled rebuild: tag a new version when you want one.

## Building

```bash
docker build -t it-tools:local .
```

Build arguments:

* `VITE_AVAILABLE_LOCALES`: comma-separated list of UI languages to include, e.g. `en,fr`. All are included by default.
* `BASE_URL`: changes the image's default subfolder (the runtime variable still wins).

Building needs about 8 GB of RAM.

## Development

Requires Node (see `.nvmrc`), pnpm, and `python3 make g++` for native dependencies. On Windows, use WSL2.

```bash
pnpm install --ignore-scripts   # install dependencies
pnpm dev                        # dev server with hot reload
pnpm build                      # production build in dist/
pnpm test:unit                  # unit tests (Vitest)
pnpm build && pnpm test:e2e     # end-to-end tests (Playwright)
pnpm lint                       # Oxlint
pnpm fmt                        # Oxfmt
pnpm typecheck                  # vue-tsc
```

Before pushing, `pnpm precommit` runs the same lint and type checks as CI.

To run end-to-end tests against the dev server instead, keep `pnpm dev` running and use `E2E_BASE_URL=http://localhost:5173 pnpm test:e2e`.

To create a new tool:

```bash
pnpm run script:create:tool my-tool-name
```

This creates `src/tools/my-tool-name/`. Fill in `index.ts` (name, category, description) and implement the tool.

## Credits

Original project by [Corentin Thomasset](https://github.com/CorentinTh/it-tools). Most additions come from [ShareVB](https://github.com/sharevb/it-tools) and its contributors.

## License

[GNU GPLv3](LICENSE).
