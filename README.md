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
- `vendor/`: Three.js r169 (llicència MIT)

## Inici de sessió (Firebase)

L'app fa servir Firebase Auth amb Google i desa el plànol a Firestore, al document `planta3d/estado`.
Només hi entren els comptes de `js/config.js` amb el correu verificat. La regla de Firestore és a `firestore.rules`.
Mentre `js/config.js` no tingui el `firebaseConfig`, l'app funciona sense inici de sessió i desa només al navegador.
