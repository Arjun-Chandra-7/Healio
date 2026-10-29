# Healio

Human and pet care storefront built with HTML, CSS and vanilla JavaScript. Includes a compact product preview, full 30-item catalogue, price comparisons, persistent cart, prescription review, AI shopping assistant and tree-reward calculator.

## Run locally

Requires Node.js 22 or later. No dependency installation is needed.

```sh
npm start
```

Open http://localhost:8081/. If it is already running, use the existing server. To choose another port:

```sh
PORT=8082 npm start
```

For chat and prescription reading, copy `.env.example` to `.env` and set `GEMINI_API_KEY`. Credentials stay on the server. `GEMINI_MODEL` defaults to `auto`.

## Verify and build

```sh
npm test
npm run build
```

The build copies only the public website into `public/`. That directory is generated and ignored by Git.

## Deploy on Vercel

The repository's `vercel.json` configures the build, static output and Node API functions. Configure `GEMINI_API_KEY` privately in the Vercel project for each deployed environment. Do not commit `.env` files.

## Structure

- `index.html`, `css/`, `js/`, `assets/`: browser UI and local images/fonts.
- `server.js`: local HTTP server.
- `api/`: Vercel endpoints for chat, prescriptions and configuration status.
- `lib/`: shared private API handler and conservative prescription matching.
- `test/`: backend and release integration checks using Node's built-in test runner.

## Function boundaries

Product imagery and retailer prices are illustrative. Cart quantities persist locally. Prescription documents are sent for reading only on explicit submission; exact matches and quantities require user review. Chat messages use Google Gemini.

Appointments, checkout and planting are previews rather than completed transactions. Rewards model one tree per ten completed orders, five points per complete ₹100 spent, and an additional tree per fifty redeemed points. The calculator does not fabricate earned points or planting confirmations.
