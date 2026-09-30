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
