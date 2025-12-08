web: cd backend && gunicorn config.wsgi --log-file -
release: bash build.sh && cd backend && python manage.py migrate && python manage.py collectstatic --noinput
