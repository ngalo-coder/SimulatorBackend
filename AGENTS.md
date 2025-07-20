## Backend Task Automation

This document outlines the steps to automate backend tasks for the project.

### Redis Integration

- **Dependency:** `redis`, `express-redis-cache`
- **Configuration:** The Redis connection is configured in `src/config/redis.js`. The following environment variables are used:
  - `REDIS_HOST`: The Redis host (default: `localhost`)
  - `REDIS_PORT`: The Redis port (default: `6379`)
- **Usage:** The Redis cache middleware is applied to the `simulationRoutes` in `index.js`.
