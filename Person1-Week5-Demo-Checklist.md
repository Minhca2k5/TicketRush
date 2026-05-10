# Person 1 Week 5 Demo Checklist

## Scope

Person 1 owns Auth Service, API Gateway, login/register, route guard, profile, and the admin shell.

Week 5 is mostly final bug fixing and demo preparation. No new feature should be added unless it fixes the demo path.

## Run Order

1. Start PostgreSQL with database `ticketrush`.
2. Start `auth-service` on port `8081`.
3. Start `event-service` on port `8082`.
4. Start `booking-service` on port `8083`.
5. Start `queue-service` on port `8084`.
6. Start `api-gateway` on port `8080`.
7. Start `eventhaven-ui` on port `5173`.

## Demo Accounts

Admin seed account:

```text
username: admin
password: admin123
```

Customer account:

```text
Register through /register, then sign in through /login.
```

## Gateway Routes

```text
/auth/**          -> auth-service:8081
/api/events/**    -> event-service:8082
/api/booking/**   -> booking-service:8083
/api/queue/**     -> queue-service:8084
```

## Auth Flow To Demo

1. Register a customer.
2. Login as customer.
3. Open profile and update age/gender.
4. Logout.
5. Login as admin.
6. Open `/admin/dashboard`.
7. Confirm admin dashboard shows user/profile demographic metrics.

## Gateway Talking Points

- The frontend calls only the gateway on `localhost:8080`.
- Gateway validates JWT for protected endpoints.
- Public endpoints are limited to login, register, and GET event browsing.
- Gateway forwards identity through `X-User-Id` and `X-User-Role`.
- Gateway adds `X-Trace-Id` so downstream services can correlate requests.
- Queue service uses `X-User-Id` from the gateway instead of trusting a user id from the browser.

## Week 5 Checks

Run before demo:

```powershell
cd auth-service
mvn test

cd ..\api-gateway
mvn test

cd ..\queue-service
mvn test

cd ..\eventhaven-ui
npm run build
```

## Known Boundaries

- Auth Service still permits profile/dashboard at Spring Security level because the controller validates bearer tokens directly; the gateway is the main auth enforcement layer.
- Dashboard revenue charts are outside Person 1 scope and belong to the dashboard/event/booking owner.
- Full concurrency and checkout correctness depend on Booking Service and Event Service.
