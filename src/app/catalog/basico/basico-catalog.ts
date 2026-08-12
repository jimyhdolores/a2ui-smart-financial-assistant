import { Type } from '@angular/core';

import { BasicoComponent } from '../../models/basico.model';
import { PlainAnswer } from './plain-answer/plain-answer';
import { SimpleList } from './simple-list/simple-list';
import { StatCard } from './stat-card/stat-card';

/**
 * Registro mínimo string→clase del nivel Básico (espejo reducido de
 * `INTERMEDIO_REGISTRY`). Traduce el nombre que eligió Gemini Nano al componente
 * Angular que `NgComponentOutlet` instanciará. Tres entradas, cero magia.
 */
export const BASICO_REGISTRY: Record<BasicoComponent, Type<unknown>> = {
  PlainAnswer,
  StatCard,
  SimpleList,
};
