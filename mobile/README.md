# gPawa Android App

Native Android client for gPawa (Expo / React Native).

**Full documentation:** [`../docs/MOBILE_APP.md`](../docs/MOBILE_APP.md) — local dev, hosted setup, building APKs, and end-user guide.

## Quick start

```bash
cd mobile
cp .env.example .env    # edit EXPO_PUBLIC_API_URL
npm install
npm run android         # requires backend at http://localhost:8000
```

## API URL (set in `.env` before build)

| Target | `EXPO_PUBLIC_API_URL` |
|--------|------------------------|
| Android emulator | `http://10.0.2.2:8000/api/v1` |
| Phone + local backend | `http://<YOUR_PC_IP>:8000/api/v1` |
| Production | `https://energy-share.sun.ac.ug/api/v1` |

## Build debug APK

```bash
npm run prebuild:android
npm run apk:debug
# → android/app/build/outputs/apk/debug/app-debug.apk
```

## Screens (v1)

Login · Register · Dashboard · Buy Units · STS Tokens · Loans · Account

## Related

- [`../docs/MOBILE_APP.md`](../docs/MOBILE_APP.md)
- [`../docs/LOCAL_DEVELOPMENT.md`](../docs/LOCAL_DEVELOPMENT.md)
- [`../API_ROUTE_CATALOG.md`](../API_ROUTE_CATALOG.md)
