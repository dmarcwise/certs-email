# certs.email development guide for AI agents

certs.email is a free SSL/TLS certificate monitoring service.

This repository contains the full-stack frontend application:

- Built with SvelteKit.
- Fully uses Svelte 5 with runes.
- Uses Tailwind CSS 4 for styling.
- Uses @lucide/svelte for icons.
- SvelteKit remote functions for server calls.

Verifying changes:
- When you make a change, you should use `npm run check` to verify you didn't make mistakes.

## Imports

Properly use SvelteKit aliases like `$templates` and `$prisma` in imports.
