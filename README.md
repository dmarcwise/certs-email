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
- `MAILTRAP_API_KEY`: Mailtrap API token for sending email.
- `WEBSITE_URL`: Base URL used in email links.
- `PORT`: HTTP port for the Node server (defaults to `3000`).

### Docker

Build and run the production image:

```bash
docker build -t certs-email .
docker run --rm -p 3000:3000 certs-email
```
