# CLAUDE.md

Source for **x-amz.dev**. Business context — what X-AMZ LLC is, how `x-amz.dev` relates to the other product domains, voice conventions, and the in-flight overhaul — lives in `~/x-amz/prod/CLAUDE.md`. Read it first.

## Current state

A minimal placeholder from Aug 2025 that predates most of the past year's shipping. No build system — raw Markdown rendered by GitHub Pages' default Jekyll pipeline.

```
index.md              # landing page
blob/index.md         # product page for the blob iOS app
blob/privacy/         # blob privacy policy
support/index.md      # support contact
CNAME                 # → x-amz.dev
x-amz.png             # primary logo
x-amz_mono.png        # monochrome variant
```

## Overhaul

In progress. The site is being rebuilt into a **holding-company** site for X-AMZ LLC — business identity on the root, outbound links to the domain sites (`byte.glass`, `requiem.rest`, `http-files.org`). The structural approach is still open; check with Brandon before making big choices.

## Deployment

GitHub Pages. Push to `main` publishes.
