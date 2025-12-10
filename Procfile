web: cd backend && gunicorn -w 4 -b 0.0.0.0:$PORT config.wsgi:application
release: bash build.sh && cd backend && python manage.py migrate && python manage.py collectstatic --noinput
