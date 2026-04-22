# Conventions dự án TicketRush

## Branch Naming
- `main`: Production code.
- `develop`: Integration branch.
- `feature/xyz`: New features (vd: feature/auth-login).
- `hotfix/xyz`: Bug fixes (vd: hotfix/jwt-bug).

## Commit Messages
- Format: `type(scope): description`
- Types: `feat` (new feature), `fix` (bug fix), `docs` (docs), `style` (formatting), `refactor` (refactor), `test` (tests), `chore` (maintenance).
- Examples: `feat(auth): add user registration`, `fix(booking): handle lock timeout`, `docs: update README`.

## API Format
- **Response:** `{ "success": true, "data": {...}, "error": null }`
- **Errors:** `{ "success": false, "error": "message" }` với HTTP codes (400 Bad Request, 401 Unauthorized, 500 Internal Server Error).

## Code Style
- **Java (Backend):** camelCase cho variables/methods, PascalCase cho classes, 4 spaces indentation, Google Java Style Guide.
- **JavaScript (Frontend):** PascalCase cho components, camelCase cho variables, kebab-case cho files, sử dụng ESLint + Prettier.
- **General:** Comments tiếng Anh, meaningful variable names, avoid magic numbers.