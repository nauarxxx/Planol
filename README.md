# Planta 3D · Muebles a medida

Web app estática para ver el piso en 3D a escala, crear muebles con medidas personalizadas, colocarlos en cada habitación y pedir propuestas automáticas de distribución.

## Uso

- **Muebles:** elige tipo (silla, mesa, TV, sofá, cama, armario...), ajusta ancho, fondo, alto, elevación y color, y añádelo a una habitación.
- **Mover:** arrastra el mueble con el ratón. R gira 90°, Q/E giran 15°, las flechas lo mueven 1 cm (Shift: 10 cm), Supr lo borra, Ctrl+D lo duplica y Ctrl+Z deshace.
- **Distribuir:** elige una habitación y pulsa *Generar propuestas*. Haz clic en una propuesta para aplicarla. Los muebles marcados como *Fijo* no se mueven.
- **Plano:** todas las medidas de las habitaciones, la altura del techo y las puertas y ventanas se pueden editar. Las medidas que no salían en el plano original están marcadas como *estimadas*.
- **Datos:** todo se guarda en el navegador. Se puede exportar e importar un `.json` y sacar una captura.

## Publicar en GitHub Pages

No necesita compilación. En el repositorio: *Settings → Pages → Deploy from a branch → `main` / raíz*.
La app queda en https://nauarxxx.github.io/Planol/

## Estructura

- `index.html`, `css/style.css`
- `js/plan.js`: plano por defecto (medidas en cm)
- `js/furniture.js`: catálogo y modelos 3D de los muebles
- `js/layout.js`: generador de distribuciones
- `js/geom.js`: geometría 2D (choques, huecos)
- `js/main.js`: escena 3D, interacción e interfaz
- `vendor/`: Three.js r169 (licencia MIT)

## Inicio de sesión (Firebase)

La app usa Firebase Auth con Google y guarda el plano en Firestore, en el documento `planta3d/estado`.
Solo entran las cuentas de `js/config.js` con el correo verificado. La regla de Firestore está en `firestore.rules`.
Mientras `js/config.js` no tenga el `firebaseConfig`, la app funciona sin inicio de sesión y guarda solo en el navegador.
