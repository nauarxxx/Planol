// Fa que Node trobi «three» igual que el navegador (importmap de l'index.html).
import { register } from 'node:module';
register('./hooks.mjs', import.meta.url);
