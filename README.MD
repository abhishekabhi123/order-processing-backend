# OrderFlow Backend

A production-style distributed order processing system.

Tech Stack

Node

Express

Postgres

Redis

RabbitMQ

Docker

TypeScript

## Tests

Vitest and Supertest cover the Orders API against a dedicated database. Copy `.env.test.example` to `.env.test`, set `TEST_DATABASE_URL` to a database that is not used for development, then run:

```bash
npm test
```

`npm test` applies the Prisma migrations to the test database and clears test data between cases.

## Product caching

Product reads use cache-aside Redis caching when `REDIS_URL` is configured. Set `REDIS_CACHE_TTL_SECONDS` to a positive number of seconds (default: `60`). Redis is optional: cache failures fall back to PostgreSQL, which remains the source of truth.

Individual products use `products:<id>` keys. Product-list keys include a Redis-backed version and pagination (`products:list:v<version>:page:<page>:limit:<limit>`). Product writes and order stock changes invalidate the individual product key and increment the collection version.
