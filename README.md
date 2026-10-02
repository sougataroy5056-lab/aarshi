# ARS SHI Parfums

Storefront design for ARS SHI Eau de Parfum (six fragrances, 50 ml, ₹899).

- `site/index.html` is the page. It is written as a fragment so it also previews as a Claude artifact.
- `site/img/w/` holds the WebP images (600 px and full size), `site/fonts/` the self-hosted Palatino-style fallback font (TeX Gyre Pagella, GUST Font License).
- `assets/original-mockups/` are the original box photos.

## Build

```
npm run build
```

Writes the full site to `public/`. Vercel runs this automatically on every push (see `vercel.json`).
