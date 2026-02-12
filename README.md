# HeySous

AI assistant that plans meals, tracks recipes, learns your preferences, and reminds you to defrost the chicken.

HeySous is a Telegram bot powered by Claude that acts as your kitchen sidekick. It remembers your recipes, dietary preferences, and cooking history, then reasons over that knowledge to plan meals, generate grocery lists, and send cooking reminders. Users interact through Telegram chat and a companion Mini App.

## Features

**Chat (Telegram Bot)**
- Save recipes by pasting a URL or describing them in conversation
- Browse and search your recipe collection
- Generate weekly meal plans based on your preferences and history
- Grocery lists auto-generated from meal plans, organized by store section
- Cooking reminders -- morning summaries, prep alerts, dinner nudges
- Dietary preferences and allergy tracking
- Multi-user households with invite-gated access
- Guided onboarding for new users
- Meal feedback that influences future suggestions

**Mini App**
- Hub dashboard with at-a-glance meal plan and grocery summary
- Interactive grocery list with tap-to-check
- Recipe browser with search
- Weekly meal plan viewer
- Feedback form and help page

## Tech Stack

- **Runtime:** Node.js >= 22, TypeScript (ESM)
- **Bot:** grammY
- **AI:** Anthropic Claude SDK
- **Database:** SQLite (better-sqlite3 + Drizzle ORM + FTS5 full-text search)
- **Server:** Express 5
- **Mini App:** React 19, React Router 7, Vite, @tma.js/sdk-react

## Quick Start

### Prerequisites

- Node.js >= 22
- A Telegram bot token (create one via [@BotFather](https://t.me/BotFather))
- An [Anthropic API key](https://console.anthropic.com)

### Setup

```bash
git clone <repo-url> heysous
cd heysous
cp .env.example .env
# Edit .env -- fill in BOT_TOKEN, ANTHROPIC_API_KEY, and ADMIN_USER_IDS

npm install
cd mini-app && npm install && cd ..

npm run dev
```

Message your bot on Telegram -- `/start` triggers the onboarding flow.

### Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start in dev mode (tsx watch, polling) |
| `npm start` | Start production build |
| `npm run build` | Compile TypeScript |
| `npm run build:app` | Build Mini App (Vite) |
| `npm run build:all` | Build server + Mini App |
| `npm test` | Run tests (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run typecheck` | Type check without emitting |
| `npm run db:studio` | Open Drizzle Studio (DB browser) |

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BOT_TOKEN` | Yes | -- | Telegram bot token from @BotFather |
| `ANTHROPIC_API_KEY` | Yes | -- | Anthropic API key |
| `ADMIN_USER_IDS` | Yes | -- | Comma-separated Telegram numeric user IDs |
| `BOT_MODE` | No | `polling` | `polling` (dev) or `webhook` (prod) |
| `PORT` | No | `3000` | Express server port |
| `WEBHOOK_URL` | Webhook only | -- | Public HTTPS URL for webhook mode |
| `MINI_APP_URL` | No | -- | Public URL for Mini App (e.g. `https://your-domain.com/app`) |
| `DB_FILE_NAME` | No | `data/heysous.db` | SQLite database file path |
| `ANTHROPIC_MODEL` | No | `claude-haiku-4-5-20251001` | Claude model ID |
| `LOG_LEVEL` | No | `info` | Pino log level |
| `NODE_ENV` | No | `development` | Set to `production` for prod |

## Architecture

```
User sends message
  -> grammY receives update
  -> Access gate checks registration (blocks uninvited users)
  -> Message queue debounces (1500ms batching)
  -> Processor builds context (conversation history, preferences, plans, grocery list)
  -> Claude call with tools (knowledge search, recipe/plan/grocery/reminder CRUD)
  -> Response formatted (HTML) and sent to user
  -> Token usage logged
```

The Mini App is a React SPA served at `/app/*` from the same Express server. API routes at `/api/*` are authenticated via Telegram initData HMAC validation.

## Project Structure

```
src/
  ai/             Claude client, system prompt, tool definitions
  bot/            grammY bot setup, command handlers, middleware
  pipeline/       Message queue + processor (Claude call orchestration)
  knowledge/      Recipe/preference storage, FTS5 search
  planning/       Meal plan generation and storage
  grocery/        Grocery list management
  reminders/      Reminder scheduling and delivery
  feedback/       Meal feedback check-ins
  onboarding/     First-run conversational flow
  invites/        Invite-gated access system
  users/          User/household management
  mini-app/       Express API routes for Mini App
  db/             Drizzle schema, database init

mini-app/src/
  pages/          Hub, GroceryList, Recipes, MealPlan, Feedback, Help
  components/     Shared React components
  hooks/          Custom hooks
  theme/          Styling and theme variables
```

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for production setup on DigitalOcean.

## License

ISC
