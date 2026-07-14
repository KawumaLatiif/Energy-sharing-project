# gPawa Android App

Native Android client (Expo / React Native).

## Documentation

**Read this first:** [`../docs/MOBILE_APP.md`](../docs/MOBILE_APP.md)

That single guide covers:

- Phone + local PC (step-by-step with `ipconfig`, firewall, rebuild APK)
- Phone + hosted production server
- Building and installing `gpawa-debug.apk`
- Using the app (login, buy units, share, loans, STS/AMI tokens, **My Meters** register/check/load/remove, alerts, transactions)
- ThingsBoard / AMI notes (server-side integration)
- Troubleshooting

**Tabs:** Home · **Meters** · TopUp Wallet · **Load/Share** · Tokens · Usage · Loans · Account

**AMI Energy Usage:** see [`../docs/POWER_USAGE.md`](../docs/POWER_USAGE.md)

**Related:** [`../docs/PLATFORM_ALIGNMENT.md`](../docs/PLATFORM_ALIGNMENT.md) — migrations & deploy checklist · [`../docs/THINGSBOARD_INTEGRATION_GUIDE.md`](../docs/THINGSBOARD_INTEGRATION_GUIDE.md) — AMI / ThingsBoard

## Quick reference

| Target | `mobile/.env` |
|--------|----------------|
| Physical phone + PC | `http://<YOUR_WIFI_IP>:8000/api/v1` |
| Emulator | `http://10.0.2.2:8000/api/v1` |
| Production | `https://energy-share.sun.ac.ug/api/v1` |

**PC must run Django** when using a local IP:

```powershell
cd backend
.\venv\Scripts\Activate.ps1
python manage.py runserver 0.0.0.0:8000
```

**Rebuild APK after changing `.env`:**

```powershell
cd mobile\android
.\gradlew.bat assembleDebug
```

APK: `dist/gpawa-debug.apk`
