Step,Backend (Django),Frontend (Next.js),Notes

1. Clone Repo,"git clone url,
   cd backend",cd frontend (from repo root),Clone once; use git pull for updates.

2. Environment Setup,"- Activate/create venv: python -m venv venv

- venv\Scripts\activate (Windows) or source venv/bin/activate (macOS/Linux).
- Install deps: pip install -r requirements.txt",- Install deps: npm install (or yarn install if using Yarn).,"Copy .env.example to .env in both dirs—fill secrets (e.g., DATABASE_URL, MTN_MOMO_API_KEY). Never commit .env (add to .gitignore)."

3. Database Setup,"- Install/run Postgres.

- Run migrations: python manage.py migrate.
- Create superuser: python manage.py createsuperuser.

4. Start Servers,"- Terminal 1: python manage.py runserver (runs on localhost:8000).
