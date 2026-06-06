# Trae Preflight

This folder is prepared for `wangxt-772-1`.

Use `.env` for stable local ports and compose project identity:

- APP_PORT: 18072
- API_PORT: 19072
- WEB_PORT: 20072
- DB_PORT: 21072
- REDIS_PORT: 22072

Smoke entry:

```bash
bash scripts/smoke.sh
```

The preflight files are environment scaffolding only. The generated business
project can replace or extend them when needed.
