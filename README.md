# Pharmacy Stock and Dosette Management System

AI-enhanced pharmacy stock optimisation and patient dosette management system
built with React, Django REST Framework, JWT authentication, and PostgreSQL.

## Local Development

1. Copy `backend/.env.example` to `backend/.env` and enter your local PostgreSQL
   credentials.
2. Install backend dependencies with
   `pip install -r backend/requirements.txt`.
3. Run migrations from `backend` with `python manage.py migrate`.
4. Start Django with `python manage.py runserver`.
5. Install frontend dependencies with `npm install` from `frontend`.
6. Start Vite with `npm run dev`.

The local frontend defaults to `http://localhost:5173` and the API defaults to
`http://127.0.0.1:8000/api`.

## Deployment

Production deployment instructions for Render or Railway, Vercel, PostgreSQL,
environment variables, migrations, and verification are in
[docs/deployment.md](docs/deployment.md).

## Staff Roles

The system includes Django Group-based access for Managers, Pharmacists,
Dispensers, Stock Assistants, and Read-only Users. The access matrix and account
assignment steps are documented in
[docs/access-control.md](docs/access-control.md).
