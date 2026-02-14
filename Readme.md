### Energy-sharing-project with next(typescript), Django and postgres
Step,Backend (Django),Frontend (Next.js),Notes

1. Clone Repo,"git clone url,
   cd backend",cd frontend (from repo root),Clone once; use git pull for updates.

2. Environment Setup,"- Activate/create venv: python -m venv venv

- venv\Scripts\activate (Windows) or source venv/bin/activate (macOS/Linux).
- Install deps: pip install -r requirements.txt",- Install deps: npm install."

3. Database Setup,"- Install/run Postgres.

- Run migrations: python manage.py migrate.
- Create superuser: python manage.py createsuperuser.

# make sure the virtual environment is started
4. Start Servers,"
- Terminal 1: python manage.py runserver (runs on localhost:8000).
- Terminal 2: npm run dev (runs on localhost:3000).
- Terminal 3: (redis server)
- Terminal 4: (celery server)
