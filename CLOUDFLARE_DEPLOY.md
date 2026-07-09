# Full Cloudflare deployment

The repository contains two editions:

- `docs/` is the static presentation edition for GitHub Pages.
- The repository root is the full vinext app with the interactive dashboard and `/api/prices` route.

For the full app in Cloudflare Workers:

1. Import this GitHub repository under **Workers & Pages â†’ Create application â†’ Import a repository**.
2. Project name: `all-sport-price-ledger`.
3. Build command: `npm run build`.
4. Deploy command: `npx wrangler deploy`.
5. After the Worker is created, add a D1 database binding named `DB` under **Settings â†’ Bindings**. The API uses that binding for shared price overrides and history.
6. Redeploy after adding the binding.

The `wrangler.jsonc` file points Cloudflare at the vinext Worker output and static assets. Price edits are shared once the `DB` binding is connected.

