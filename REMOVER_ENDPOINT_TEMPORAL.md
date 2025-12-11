# ⚠️ IMPORTANTE: Remover Endpoint Temporal

Después de poblar los datos, ejecuta estos comandos para eliminar el endpoint temporal:

```bash
# 1. Eliminar archivos temporales
git rm backend/mainApp/views_admin.py

# 2. Editar backend/config/urls.py y remover:
#    - La línea: from mainApp import views_admin
#    - La línea: path('api/admin/poblar-datos/', views_admin.poblar_datos_railway, name='poblar-datos-temp'),

# 3. Commit y push
git add backend/config/urls.py
git commit -m "chore: Remover endpoint temporal de población de datos"
git push
```

## O déjame saber cuando termines y yo lo hago automáticamente.
