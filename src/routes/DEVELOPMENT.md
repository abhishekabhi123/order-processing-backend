# OrderFlow Development Context

## Current Status

Completed:
- Node.js + Express backend
- TypeScript
- PostgreSQL 17 via Docker
- Redis 7 via Docker
- Prisma + PostgreSQL
- Environment configuration
- API routing structure
- Health check
- Backend running on port 5000
- Docker Compose working

## Current Phase

Orders module.

## Immediate Next Steps

1. Add Order and OrderItem models
2. Run Prisma migration
3. Create order repository, service, controller, and routes
4. Enforce stock availability during order creation and restore stock when an order is cancelled
5. Add status-transition rules and admin authorization
6. Test:
   - POST /api/orders
   - GET /api/orders
   - GET /api/orders/:id
   - PATCH /api/orders/:id/status

## Upcoming

### Orders
- Order model
- Order CRUD
- Order status transitions
- Authorization

### Redis
- Introduce caching / temporary state where useful

### Async Processing
- Order events
- Message broker
- Background workers

### Testing
- Unit tests
- Integration tests
- API tests

### Production
- Validation
- Error handling
- Logging
- Rate limiting
- Security
- Graceful shutdown
- Docker optimization
- CI/CD
- Deployment

## Architecture Direction

Controller
    ↓
Service
    ↓
Repository
    ↓
Prisma
    ↓
PostgreSQL

Redis should be introduced where there is an actual use case,
not just because Redis is available.
