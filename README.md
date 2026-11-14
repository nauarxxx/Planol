# Planta 3D · Mobles a mida

Web app estàtica per veure el pis en 3D a escala, crear mobles amb mides personalitzades, col·locar-los a cada habitació i demanar propostes automàtiques de distribució.

## Ús

- **Mobles:** tria el tipus (cadira, taula, TV, sofà, llit, armari...), ajusta amplada, fons, alçada, elevació i color, i afegeix-lo a una habitació.
- **Moure:** arrossega el moble amb el ratolí. R gira 90°, Q/E giren 15°, les fletxes el mouen 1 cm (Maj: 10 cm), Supr l'esborra, Ctrl+D el duplica i Ctrl+Z desfà.
- **Distribuir:** tria una habitació i prem *Genera propostes*. Fes clic en una proposta per aplicar-la. Els mobles marcats com a *Fix* no es mouen.
- **Plànol:** totes les mides de les habitacions, l'alçada del sostre i les portes i finestres es poden editar. Les mides que no sortien al plànol original estan marcades com a *estimades*.
- **Dades:** tot es desa al navegador i al núvol. Es pot exportar i importar un `.json` i treure una captura.

## Publicar a GitHub Pages

No necessita compilació. Al repositori: *Settings → Pages → Deploy from a branch → `main` / arrel*.
L'app queda a https://nauarxxx.github.io/Planol/

## Estructura

- `index.html`, `css/style.css`
- `js/plan.js`: plànol per defecte (mides en cm)
- `js/furniture.js`: catàleg i models 3D dels mobles
- `js/layout.js`: generador de distribucions
- `js/geom.js`: geometria 2D (xocs, buits)
- `js/main.js`: escena 3D, interacció i interfície
- `js/state.js`: càrrega de l'estat i migració del plànol
- `js/preview.js`: miniatures en planta (propostes)
- `js/goals.js`: objectius de les propostes i la seva explicació
- `js/social.js`: notes, vots, propostes per votar i historial de canvis
- `js/ar.js`: realitat augmentada (WebXR, Chrome d'Android)
- `js/sheet.js`: fitxa en PDF i plànol a escala (1:50…)
- `js/tape.js`, `js/zones.js`, `js/fit.js`, `js/shop.js`: cinta mètrica, zones d'ús, «hi passa?» i llista de compra
- `vendor/`: Three.js r169 (llicència MIT)

## Inici de sessió (Firebase)

L'app fa servir Firebase Auth amb Google i desa el plànol a Firestore, al document `planta3d/estado`.
Només hi entren els comptes de `js/config.js` amb el correu verificat. La regla de Firestore és a `firestore.rules`.
Mentre `js/config.js` no tingui el `firebaseConfig`, l'app funciona sense inici de sessió i desa només al navegador.


## App instal·lable (PWA)

L’app té `manifest.webmanifest` i `sw.js`: es pot instal·lar al PC (Chrome/Edge → Instal·la), a Android (botó Instal·la) i a l’iPhone (Safari → Compartir → Afegeix a la pantalla d’inici), i obre sense connexió. Els fitxers propis es guarden a la memòria cau i s’actualitzen en segon pla; Firebase sempre va per xarxa.

## Proves automàtiques

- `npm test`: proves de la lògica (fusió de canvis, historial, «hi passa?», zones, escala, propostes, migració), sense navegador.
- `npm run test:e2e`: obre l'app en un Chromium (Playwright) i comprova les funcions principals sense errors.
- A GitHub, `.github/workflows/proves.yml` les executa a cada canvi i a cada pull request.
