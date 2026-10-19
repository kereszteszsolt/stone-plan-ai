# StonePlan AI branding

[`branding.json`](branding.json) follows the TypeNudge display-branding contract. Edit project metadata here. It contains no credentials or runtime provider configuration.

| Field | Meaning |
| --- | --- |
| `appName` | Display name |
| `appTagline` | Short tagline displayed in the header |
| `appDescription` | Project description displayed in About |
| `appWebsite` | Project website; empty when none is configured |
| `appGithubUrl` | Project repository |
| `appFavicon` | Optional local favicon |
| `appIcon` | Optional local project mark |
| `appPoster` | Optional local project poster |
| `authorName` | Author display name |
| `authorWebsite` | Author website |
| `authorWebsiteLanguages` | Ordered language codes displayed in website/support tooltips |
| `authorGithub` | Author GitHub profile |
| `authorWaysToSupportUrl` | General ways to support the author |
| `authorBuyMeACoffeeUrl` | Direct Buy Me a Coffee link |
| `supportRemarkText` | Voluntary-support notice displayed in About |

Asset paths are relative to this `brand/` directory and must stay inside `assets/`. Empty paths mean no image. These are source paths, not public URLs: consumers must package or map them to their own public base. Do not fetch remote artwork or resolve arbitrary filesystem paths.

The SVG and PNG posters are unchanged copies of `kereszteszsolt/project-cards/stoneplan-ai-poster.*` from the profile repository. `appPoster` selects the vector version; the PNG is the social-preview alternative. The new `stoneplan-ai-favicon.svg` translates the poster's indigo background, rising cream/lavender/mint cards and golden star into a compact shared favicon/app mark. Both icon fields select that asset. Preserve original artwork when adding variants.

The web app's `npm start`, `npm run build`, `npm run watch` and `npm test` first run the dependency-free `scripts/prepare-brand.cjs`. It copies the metadata/artwork into the ignored `apps/web/.brand/` build directory because Angular requires asset inputs inside its workspace. Edit this source directory, not that generated copy; restart development or run `npm run brand:prepare` after branding changes.

Angular imports the prepared JSON at build time through `apps/web/src/app/brand.ts`. The app name supplies the header, browser title and About heading; author fields supply the sidebar copyright and About links. The copyright year comes from the current browser date. Empty optional links are omitted. Ways to support and Buy Me a Coffee are voluntary ways to support the author's work.

The sidebar and About website labels are derived from `authorWebsite`'s hostname. About shows the large poster above the configured description and compact filled buttons with small icons. The two voluntary support buttons share a row, followed by the configured support notice. Speech-bubble tooltips explain each link and show its complete configured URL on hover or keyboard focus; the author's website and ways-to-support page also list `authorWebsiteLanguages` in order, separated by ` | `. An empty language list omits the availability sentence. Tooltips stay within the viewport/dialog edges, allow hovering their content, and dismiss with Escape. The copyright identifies the author and ends with an inline license link, rather than a license button.

The About collection uses a filled coffee button with an inline cup icon; its destination comes from `authorBuyMeACoffeeUrl`. The former standalone coffee-button PNG was removed because the app no longer uses it. The PNG poster remains as the documented social-preview alternative, while the app uses the configured SVG poster.

Angular packages `brand/assets/` under `assets/brand/`; the source paths above are mapped to that public base. The web Docker build includes this directory, so a branding change needs a new web build/deployment. There is no runtime request for the JSON or external artwork.

The header tagline, About description and support notice use `appTagline`, `appDescription` and `supportRemarkText` directly from the configuration.

License identifiers and URLs are not part of the branding contract. The legal source of truth remains the root `LICENSE` and existing SPDX notices; branding edits must not rewrite those or rename stable storage/package identifiers.
