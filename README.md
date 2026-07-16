# certs.email

This repository contains the source code for [certs.email](https://certs.email).

## Development

Install dependencies with `npm install`, then run:

```bash
npm run dev
```

Or start the server and open the app in a new browser tab:

```bash
npm run dev -- --open
```

### Formatting and linting

Code formatting is handled by [Prettier](https://prettier.io/). To format the whole repository:

```bash
npm run format
```

To check formatting and run [ESLint](https://eslint.org/):

```bash
npm run lint
```

TypeScript, accessibility, and Svelte compiler errors are caught by [`svelte-check`](https://www.npmjs.com/package/svelte-check):

```bash
npm run check
```

- **VS Code**: install the recommended [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) and [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) extensions (see `.vscode/extensions.json`).
- **WebStorm**: works out of the box via `.idea/prettier.xml` and `.idea/jsLinters/eslint.xml`. Both set a custom file pattern, because WebStorm's default omits `.svelte`.

## Build

Create a production build:

```bash
npm run build
```

Run it with:

```bash
node build
```

### Environment variables

- `DATABASE_URL`: PostgreSQL connection string.
- `LETTERMINT_API_TOKEN`: Lettermint API token for sending email.
- `WEBSITE_URL`: Base URL used in email links.
- `PORT`: HTTP port for the Node server (defaults to `3000`).

### Docker

Build and run the production image:

```bash
docker build -t certs-email .
docker run --rm -p 3000:3000 certs-email
```
