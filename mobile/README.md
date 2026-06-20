# gPawa Android App

Native Android client (Expo / React Native).

## Documentation

**Read this first:** [`../docs/MOBILE_APP.md`](../docs/MOBILE_APP.md)

That single guide covers:

- Phone + local PC (step-by-step with `ipconfig`, firewall, rebuild APK)
- Phone + hosted production server
- Building and installing `gpawa-debug.apk`
- Using the app (login, buy units, STS tokens)
- Troubleshooting

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
