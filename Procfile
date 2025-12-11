web: cd backend && daphne -b 0.0.0.0 -p $PORT config.asgi:application
release: cd backend && python manage.py migrate && python manage.py collectstatic --noinput
