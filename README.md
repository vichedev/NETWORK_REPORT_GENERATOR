# Network Report Generator

Generador de informes técnicos de infraestructura de red. Subes las gráficas de
tráfico, una IA con visión extrae los datos y redacta el análisis, y el sistema
produce el informe en **Word y PDF** y lo archiva en el historial del cliente.

- 🔐 **Acceso con login** — usuario `admin` creado solo, y gestión de usuarios desde la interfaz.
- 🔑 **API keys gestionadas desde la interfaz** — sin `.env`, cifradas en la base de datos.
- 🏢 **Empresas y nodos** — catálogo propio, con historial por cliente y por nodo.
- 🗂️ **Historial** — cada informe queda archivado con sus imágenes y se puede volver a descargar.

---

## Arquitectura

```
┌─ Navegador (React + Vite) ────────────────────────────────┐
│  Login · Generador · Empresas · Historial · Ajustes        │
│  Construye el DOCX y el PDF en el cliente                  │
└───────────────────────┬───────────────────────────────────┘
                        │  /api/*  (cookie de sesión httpOnly)
┌───────────────────────▼───────────────────────────────────┐
│  Backend Express (Node)                                    │
│   · Sesiones + contraseña con scrypt                       │
│   · API keys cifradas con AES-256-GCM                      │
│   · Llama al proveedor de IA (la clave nunca sale de aquí)  │
└───────────────────────┬───────────────────────────────────┘
                        │
              data/  ← volumen persistente
                ├── report.db      SQLite (cuenta, empresas, nodos, informes)
                ├── uploads/       imágenes archivadas de cada informe
                └── .secret        clave maestra de cifrado (autogenerada)
```

**La API key de IA nunca llega al navegador.** El frontend envía las imágenes al
backend y es este quien habla con el proveedor.

---

## Puesta en marcha

### Desarrollo

```bash
npm install
npm run dev
```

Levanta el backend en `http://localhost:3001` y Vite en `http://localhost:5173`
(con proxy de `/api`). Abre **http://localhost:5173**.

### Producción (local)

```bash
npm run build
npm start        # sirve el frontend compilado y la API en el puerto 3001
```

### Docker

```bash
docker compose up -d --build
```

Disponible en **http://localhost:8888**. No requiere ninguna variable de entorno.

> ⚠️ El volumen `report_data` contiene la cuenta, las empresas, el historial y la
> clave de cifrado. **Si lo borras, se pierde todo** — incluida la posibilidad de
> descifrar las API keys guardadas.

---

## Primeros pasos

1. **Entra con el usuario por defecto.** En el primer arranque el sistema crea
   solo esta cuenta:

   | Usuario | Contraseña |
   |---|---|
   | `admin` | `admin123` |

   La pantalla de login te las muestra y tiene un botón para rellenarlas. En
   cuanto entres, ve a **Ajustes → Mi cuenta** y cambia el nombre de usuario y la
   contraseña: hasta que lo hagas verás un aviso naranja en la cabecera, y
   cualquiera que llegue al login puede entrar con esas credenciales conocidas.

2. **Configura una API key** en **Ajustes**. Elige proveedor y modelo, pega la
   clave y pulsa *Probar conexión* para verificar que funciona. Puedes guardar
   varias y cambiar cuál está activa cuando quieras.

3. **Crea la empresa y sus nodos** en **Empresas** (o directamente desde el
   generador — los nodos que escribas a mano se dan de alta solos).

4. **Genera el informe** en **Generador**: elige empresa, sube las gráficas,
   detalla cada una y pulsa generar. El informe se descarga en Word y PDF y
   queda archivado en **Historial**.

---

## Usuarios

Todo se gestiona desde **Ajustes**. Todos los usuarios tienen los mismos
permisos: no hay roles.

**Mi cuenta** — cambia tu propio nombre de usuario y tu contraseña. Para la
contraseña hace falta la actual, y al cambiarla se cierran tus demás sesiones
abiertas.

**Usuarios del sistema** — crea cuentas nuevas con una contraseña inicial,
renómbralas, restablece su contraseña o elimínalas.

Reglas que aplica el servidor:

- Los usuarios nuevos y los que reciben una contraseña restablecida quedan
  marcados con **⚠️ contraseña sin cambiar** hasta que la cambien ellos mismos.
- Restablecer la contraseña de alguien **cierra todas sus sesiones** al instante.
- No puedes eliminar tu propia cuenta, ni dejar el sistema sin ningún usuario.
- No puedes usar el restablecimiento sobre tu propia cuenta para saltarte la
  comprobación de la contraseña actual.
- Los nombres de usuario no distinguen mayúsculas: `Admin` y `admin` son el mismo.

Si olvidas todas las contraseñas, la única salida es borrar `data/report.db`
— pero eso se lleva por delante empresas, nodos, historial y API keys.

---

## Proveedores de IA soportados

Todos necesitan un modelo **con visión**. La lista de modelos son sugerencias:
puedes escribir cualquier identificador, porque los proveedores retiran y añaden
modelos con frecuencia.

| Proveedor | Sugerencia | Dónde obtener la clave |
|---|---|---|
| Groq | `qwen/qwen3.6-27b` | https://console.groq.com/keys |
| OpenAI | `gpt-4o` | https://platform.openai.com/api-keys |
| Google Gemini | `gemini-2.5-flash` | https://aistudio.google.com/app/apikey |
| Anthropic Claude | `claude-opus-5` | https://console.anthropic.com/settings/keys |

**Sobre los límites de uso:** cada gráfica consume varios miles de tokens de
entrada. Los planes gratuitos (Groq, por ejemplo, con 8.000 tokens/minuto) se
agotan con dos o tres imágenes seguidas. El backend detecta el error 429 y
reintenta automáticamente respetando la espera que pide el proveedor, pero un
informe con muchas gráficas irá lento en un plan gratuito.

---

## Seguridad

| Qué | Cómo |
|---|---|
| Contraseñas | `scrypt` con sal aleatoria, nunca en texto plano |
| Contraseña por defecto | Aviso permanente en la cabecera y en Ajustes hasta que se cambia |
| Sesión | Cookie `httpOnly` + `sameSite=lax`, token aleatorio de 32 bytes en BD, caduca a los 30 días |
| Fuerza bruta | 8 intentos fallidos por IP → bloqueo de 10 minutos |
| API keys | AES-256-GCM; solo se devuelven los 4 últimos caracteres |
| Clave maestra | `data/.secret`, generada sola en el primer arranque con permisos `600` |
| Endpoints | Todo bajo `/api` salvo `/api/auth/*` exige sesión — incluidas las imágenes archivadas |
| Cambio de contraseña | Cierra el resto de sesiones abiertas |

Si cambias de servidor, **copia el directorio `data/` entero**: sin `.secret` las
API keys guardadas no se pueden descifrar y habrá que volver a introducirlas.

---

## Estructura

```
server/
  index.js            Express: API + sirve el frontend compilado
  config.js           Rutas, puerto, límites
  crypto.js           Cifrado AES-256-GCM, hash de contraseñas, tokens
  db.js               Esquema SQLite y migraciones
  auth.js             Usuario por defecto, login, sesiones, rate limit
  providers.js        Abstracción de proveedores de IA + reintentos
  routes/
    users.js          CRUD de usuarios
    settings.js       CRUD de API keys
    empresas.js       CRUD de empresas y nodos
    reports.js        Generación de informes e historial

src/
  context/            AuthContext (sesión) · AppContext (catálogo y flujo)
  pages/              LoginPage · GeneratorPage · EmpresasPage · HistorialPage · SettingsPage
  components/         Header, ConfigSection, DropZone, ImageDetailCard, AnalysisPreview, ui
  lib/
    api.js            Cliente HTTP del backend
    docxBuilder.js    Generación del Word
    pdfBuilder.jsx    Generación del PDF
    exportReport.jsx  Construye ambos formatos y dispara la descarga
    periods.js        Cálculo de períodos legibles
```

---

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Backend + Vite en paralelo |
| `npm run dev:api` | Solo el backend, con recarga automática |
| `npm run build` | Compila el frontend a `dist/` |
| `npm start` | Sirve API y frontend compilado |
| `npm run lint` | ESLint sobre `src/` y `server/` |
