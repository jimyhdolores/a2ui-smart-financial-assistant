/// <reference types="dom-chromium-ai" />
// Trae los tipos globales de la IA integrada de Chrome (`LanguageModel`, `Availability`, etc.).
// Como `tsconfig.app.json` usa `"types": []`, debemos referenciarlos explícitamente aquí.

import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
