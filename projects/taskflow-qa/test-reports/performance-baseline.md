# TaskFlow API - Performance Baseline (autocannon)

Executed: 2026-10-14T00:21:14.544Z  
Environment: Local Windows machine, single Node.js process, file-backed SQLite (node:sqlite), loopback network.  
Profile: 10 connections, 5s per target, pipelining 1.

| Target | Req/s (avg) | Total requests | p50 | p97.5 | p99 | Max | Errors | Timeouts | Non-2xx |
|--------|------------:|---------------:|----:|------:|----:|----:|-------:|---------:|--------:|
| GET /api/v1/health | 8803 | 44003 | 1 ms | 1 ms | 2 ms | 9 ms | 0 | 0 | 0 |
| GET /api/v1/projects/1/tasks (authenticated, 12 tasks) | 1470 | 7349 | 6 ms | 9 ms | 10 ms | 19 ms | 0 | 0 | 0 |

Raw machine-readable data: `test-reports/performance-baseline.json`.

> **Caveat:** this is a local demo baseline on a single Node.js process with file-backed SQLite over loopback. It is useful to detect regressions between commits on the same machine - it is NOT production capacity, and no claim about production performance is made.
