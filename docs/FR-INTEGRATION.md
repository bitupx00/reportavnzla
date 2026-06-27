# Integración de Reconocimiento Facial (anti-duplicado al registrar)

Al registrar una persona en reportavnzla, **antes de crear el reporte** se compara
la foto con los reportes existentes (reconocimiento facial). Si coincide, se le
pregunta al usuario *"creemos que ya está registrada, ¿es la misma persona?"*.

## Arquitectura (servidor-a-servidor, la clave nunca en el navegador)
```
Navegador (reportavnzla.com, HTTPS)
   │  sube la foto en el modal de registro
   ▼
/api/fr/check-duplicate   (route handler de reportavnzla, MISMO origen)
   │  reenvía la foto con la API key (server-side)
   ▼
FR-API  http://IP:8808/v1/check-duplicate   (Debian13, InsightFace + faiss)
   │  busca rostros parecidos
   ▼  { possible_duplicate, candidates:[{person_name, image_url, score}], message }
```
- El navegador solo habla con reportavnzla (HTTPS, mismo origen): sin CORS, sin
  mixed-content, sin exponer la clave.
- La clave vive en `FR_API_KEY` (env del servidor / Vercel).

## Variables de entorno
```
FR_API_URL=http://201.189.205.53:8808     # microservicio FR (Debian13)
FR_API_KEY=<api key de reportavnzla>       # secreta, server-side
```
En Vercel: añadir ambas en Project Settings → Environment Variables.

## Archivos
- `src/app/api/fr/check-duplicate/route.ts` — proxy server-side al FR-API.
- `src/components/AddPersonModal.tsx` — al subir la foto llama al proxy y, si
  `possible_duplicate`, muestra el aviso con candidatos + "Sí, ya está registrada"
  (cierra) / "No, es otra persona" (continúa).

## Probar la integridad
```bash
# (1) FR-API directo + (2) proxy de reportavnzla
bash scripts/test-fr-integration.sh /ruta/a/una/foto.jpg http://localhost:3005
```
O manual:
```bash
curl -s -F "file=@foto.jpg" http://localhost:3005/api/fr/check-duplicate
```

## Endurecimiento pendiente (TLS)
El FR-API hoy es HTTP. La llamada reportavnzla→FR es servidor-a-servidor (no hay
mixed-content), pero la clave viaja en claro. Para producción conviene TLS en el
FR-API con un subdominio (p. ej. `fr-api.reportavnzla.com` → IP del server) y
cert por DNS-01 (el puerto 80 del server está ocupado por otro servicio). Ver
`service/deploy/` del proyecto FR.
