# Shipping Wallpaparr (GHCR + GitHub Release APK)

The product version is **1.1.0** (`VERSION`). Binaries are **not** committed to git. They are published by GitHub Actions.

| What you want | Where it lives |
| --- | --- |
| Container image | [`ghcr.io/imanunator/wallpaparr`](https://github.com/iManunator/projectivy-live-wallpaper-suite/pkgs/container/wallpaparr) |
| Finished plugin APK | GitHub **Release** asset `wallpaparr-plugin-release.apk` (not the Actions artifact, which expires) |
| Source | this repository (`main`) |

## Permissions (why `packages: write` exists)

Both workflows declare:

```yaml
permissions:
  contents: read   # CI — checkout
  packages: write  # GHCR push with GITHUB_TOKEN
```

Release also needs `contents: write` so it can create the GitHub Release and upload APKs.

| Workflow | Trigger | GHCR | APK |
| --- | --- | --- | --- |
| [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) | `push` to `main`, PRs, `workflow_dispatch` | **Yes on `main`** — tags `:latest`, `:ci`, `:sha-<git>`. PRs **build** the image and upload artifact `wallpaparr-image` (no push). | Actions artifact `wallpaparr-plugin-apk` (ephemeral) |
| [`.github/workflows/release.yml`](../.github/workflows/release.yml) | `v*` tag push (or `workflow_dispatch`) | **Yes** — `:latest`, `:vX.Y.Z`, `:X.Y.Z`, `:sha-<git>` | **GitHub Release assets** (durable): `wallpaparr-plugin-release.apk` + debug |

The image is named **`wallpaparr`** (lowercase). GHCR package names are case-sensitive and must be lowercase.

OCI labels `org.opencontainers.image.source` / `.url` point at this repo so GitHub **links the package** under the repository Packages sidebar. Login uses `github.repository_owner` + `secrets.GITHUB_TOKEN` against `ghcr.io`.

If a GHCR push is denied, check **Settings → Actions → General → Workflow permissions** (must allow read/write) and that the workflow YAML still has `packages: write`. First publish creates the package; visibility is already **public** for `wallpaparr`.

## Tag `v1.1.0` (creates the Release + versioned image)

Merge the flagship docs/packaging PR to `main` first so the Release notes and workflows match what ships. Then, on a machine with push access:

```bash
git checkout main
git pull origin main
git tag -a v1.1.0 -m "Wallpaparr 1.1.0"
git push origin v1.1.0
```

That single tag push runs **Release**: publishes `ghcr.io/imanunator/wallpaparr:v1.1.0` (and `:1.1.0`, `:latest`) and attaches **`wallpaparr-plugin-release.apk`** to https://github.com/iManunator/projectivy-live-wallpaper-suite/releases/tag/v1.1.0

Do **not** retag `v1.1.0` if it already exists. Bump `VERSION` + `CHANGELOG.md` and tag `v1.1.1` (or later) instead.

`workflow_dispatch` on Release (from `main`) rebuilds and pushes `:latest` without creating a GitHub Release. Use a `v*` tag when you want the APK on the Releases page.

## Pull the published image

```bash
docker pull ghcr.io/imanunator/wallpaparr:latest
# after the v1.1.0 tag:
docker pull ghcr.io/imanunator/wallpaparr:1.1.0
```

Compose in this repo still **builds the Dockerfile** by default (`pull_policy: build`) so `./scripts/verify.sh` works before GHCR exists. To run the published image:

```bash
export PUBLIC_BASE_URL=http://YOUR_LAN_IP:8787
docker compose pull
# or:
docker run --rm -p 8787:8787 \
  -e PUBLIC_BASE_URL=http://YOUR_LAN_IP:8787 \
  -v "$PWD/data:/data" \
  ghcr.io/imanunator/wallpaparr:latest
```

## Download the plugin APK

Primary (after the tag):

```text
https://github.com/iManunator/projectivy-live-wallpaper-suite/releases/latest/download/wallpaparr-plugin-release.apk
```

Until the first `v*` tag exists, grab **`wallpaparr-plugin-apk`** from the latest green **CI** run on `main` (same filenames). Sideload:

```bash
adb connect TV_IP
adb install -r wallpaparr-plugin-release.apk
```

Then Projectivy → Appearance → Wallpaper → **Wallpaparr**.

## What we refuse to put in git

APKs and container tarballs are large binaries. They belong on **Releases** / **GHCR** / Actions artifacts — not in git history.
