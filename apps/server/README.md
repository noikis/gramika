# Getting Started with [Fastify-CLI](https://www.npmjs.com/package/fastify-cli)
This project was bootstrapped with Fastify-CLI.

## Available Scripts

Run these from the repository root:

- `npm run lint -w apps/server`: check server source, tests and ESLint config.
- `npm run lint:fix -w apps/server`: apply available ESLint fixes.
- `npm run format -w apps/server`: format server source, tests and ESLint config
  using Prettier (two spaces, single quotes, no semicolons, 100-column target).
- `npm run format:check -w apps/server`: check formatting without changing files.

Lint checks code quality; format handles readability and line wrapping. These
commands target code explicitly and do not read env files or saved database data.

In the project directory, you can run:

### `npm run dev`

To start the app in dev mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

### `npm start`

For production mode

### `npm run test`

Run the test cases.

## Learn More

To learn Fastify, check out the [Fastify documentation](https://fastify.dev/docs/latest/).
