# Backend Repo Setup (Docker + Piston + Shared)

## 1) Install and Configure

```bash
npm install
cp .env.example .env
```

Update `.env` with your real secrets (JWT, SMTP, DB, Redis).

## 2) Local Infrastructure (Postgres + Redis + Piston)

```bash
npm run docker:up
```

Services:

- Postgres: `localhost:5432`
- Redis: `localhost:16379`
- Piston: `localhost:10200`

## 3) Backend Runtime

```bash
npm run db:generate
npm run db:migrate
npm run dev
```

## 4) Production-like Docker Deployment

```bash
npm run docker:deploy:up
```

This uses `docker-compose.prod.yml` and includes:

- backend API
- postgres
- redis
- piston
- piston-init

Stop it with:

```bash
npm run docker:deploy:down
```

## 5) Shared Package Management

This repo includes a local `shared/` package for split-repo compatibility.

### Build shared package

```bash
npm run shared:build
```

### Type-check shared package

```bash
npm run shared:typecheck
```

### Build backend + shared together

```bash
npm run build:all
```

## 6) Optional: keep shared synchronized

If your frontend repo also has `shared/`, keep both in sync by one of these approaches:

1. Promote `shared` to a third repo and publish versions.
2. Use git subtree for `shared` in both repos.
3. Mirror only source files under `shared/src` with a sync script.
