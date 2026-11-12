# Hábitos

Matriz de hábitos diarios: cada fila es un hábito, cada columna un día del mes. Un toque marca o desmarca el día. Funciona sin conexión y se instala como app en el iPhone y en el ordenador.

## Desarrollo

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # typecheck + build de producción en dist/
npm run preview   # sirve dist/ para probar la PWA
```

## Cómo se instala

- **iPhone**: abrir la URL en **Safari** → botón Compartir → *Añadir a pantalla de inicio*. Ábrela siempre desde ese icono: en iOS la PWA instalada tiene su propio almacenamiento, distinto del de Safari.
- **Mac/PC**: Chrome o Edge → icono de instalar en la barra de direcciones, o menú → *Instalar Hábitos*.

## Datos

Todo se guarda en **IndexedDB** dentro del dispositivo. No hay cuentas ni servidores todavía, así que cada dispositivo tiene su propia copia: la sincronización con Supabase es la fase 2. Ojo con borrar los datos del sitio o desinstalar la PWA, porque se pierde el historial.

Los días futuros aparecen atenuados y no se pueden marcar. Los días pasados sí, para poder corregir olvidos.

## Desplegar en Vercel

1. Subir el proyecto a un repositorio de GitHub.
2. En Vercel: *Add New → Project* e importar el repositorio.
3. Framework: **Vite**. Build: `npm run build`. Output: `dist`.
4. Deploy. Dominio gratuito `*.vercel.app` (o uno propio).

`vercel.json` ya deja `sw.js` y el manifest sin caché para que las actualizaciones de la PWA lleguen.

## Estructura

```
src/
  db/        IndexedDB: esquema, repositorio y datos de ejemplo
  lib/       fechas en hora local y paleta de colores/iconos
  ui/        matriz, navegación de mes y hoja de edición
  main.ts    arranque y registro del service worker
public/      iconos PWA
```

## Siguiente fase

Sincronización entre dispositivos con Supabase (login por código OTP, RLS por usuario y cola de cambios offline). Requiere `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en Vercel.
