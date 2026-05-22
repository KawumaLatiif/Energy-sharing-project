# USSD Features Report

## Output

| File | Description |
|------|-------------|
| `USSD_Features_Report.docx` | Word report with feature descriptions and screenshots |
| `screenshots/` | PNG assets embedded in the report |

## Regenerate

1. Start backend: `cd backend && .\venv\Scripts\python.exe manage.py runserver`
2. Start frontend (for simulator screenshots): `cd frontend && npm run dev`
3. Run:

```powershell
cd D:\Energy-sharing-project
.\backend\venv\Scripts\python.exe scripts\generate_ussd_report.py
```

Requires: `python-docx`, `pillow`, `requests`, `playwright` (in backend venv). First-time Playwright: `.\backend\venv\Scripts\playwright.exe install chromium`.

Test phone used in report: `+256701234567` (seed user jane@powercred.local).
