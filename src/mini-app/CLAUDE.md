# Mini App API

## Adding an API route

1. Create route factory in `src/mini-app/routes/your-route.ts`
2. Register in `src/mini-app/router.ts`
3. Routes receive `sqlite` via closure, use `res.locals.householdId` for data access

## Auth

API routes at `/api/*` are protected by Telegram initData HMAC validation. The middleware sets `res.locals.chatId` and `res.locals.householdId` for downstream handlers.
