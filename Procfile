web: cd "REST frameworks/ReservaProject" && gunicorn ReservaProject.wsgi --log-file -
release: bash build.sh && cd "REST frameworks/ReservaProject" && python manage.py migrate && python manage.py collectstatic --noinput
