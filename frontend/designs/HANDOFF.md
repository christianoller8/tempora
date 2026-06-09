# Tempora · Handoff de diseño para Claude

Contexto para asistentes (Claude Code) que trabajen en el repositorio.
Resume **qué se ha creado**, **por qué**, y **cómo llevarlo al código** del
proyecto real: **Angular 21 + PrimeNG + @ngrx/signals**, control horario para el
sector sanitario español.

---

## 1. Objetivo del trabajo

Renovar la piel visual de Tempora (el modo oscuro previo "no gustaba") y crear
un **sistema de diseño violeta premium**, con **dark + light** coherentes, y
artefactos listos para integrar en Angular.

Resultado: **9 pantallas en dark + 9 en light**, una **hoja de tokens** única,
un **ThemeService** y documentación.

---

## 2. Decisiones de diseño (el "por qué")

- **Violeta de marca como ADN.** Se descartó el verde genérico del tema previo.
  `--primary:#401BBB` / `--primary-hover:#5229D4` son idénticos en ambos temas;
  todo lo demás (superficies, texto, estados) cambia por tema.
- **Dark profundo, no negro.** Fondo `#150F26`, superficies `#1E1640`, bordes
  `#3F336A`. Sombras y glow violetas suaves para sensación premium.
- **Light lavanda, no blanco puro.** Fondo `#F4F2FB` con tarjetas blancas y
  tinta violeta-oscura `#1B1430`. Da calidez y evita el blanco clínico.
- **Estados oscurecidos en light** (`--ok/warn/danger`) para contraste AA sobre
  blanco; en dark son más luminosos.
- **Tokens espejo.** Mismos nombres de variable en ambos temas → los componentes
  usan `var(--token)` y cambian de tema sin tocar su CSS.
- **Color semántico por dominio.** Tokens dedicados para **categorías
  profesionales** (`--cat-*`: enfermería, TCAE, médico, fisio, celador, admin) y
  **tipos de turno** (`--shift-*`: mañana/tarde/noche/libre). Antes había chips
  negros ilegibles; ahora cada categoría tiene color propio con buen contraste.
- **Cumplimiento legal visible.** En Configuración e Informes se referencian
  límites del Estatuto de los Trabajadores (Art. 34.3, 34.1, 37.1) y RD 8/2019
  (conservación de registros) — es un producto de control horario regulado.
- **Iconografía de línea** (stroke 1.6, sin relleno) y radios 10–16px en todo el
  sistema para consistencia.

---

## 3. Archivos y su rol

### Integrables en el proyecto (producción)
| Archivo | Rol | Notas de integración |
|---|---|---|
| `tokens.css` | Fuente única de color/espaciado; 2 paletas espejo `data-theme`. | `@import` en `styles.css`. Incluye bridge a variables PrimeNG y primitivas `.tmp-*`. |
| `theme.service.ts` | Servicio Angular (Signals) para alternar/persistir tema. | `inject(ThemeService)`; `toggle()`, `set()`, `isDark()`. Escribe `data-theme` en `<html>`. |
| `README.md` | Guía de integración paso a paso. | Incluye checklist de portado por pantalla. |

### Referencia visual (NO son código de producción)
9 pantallas, cada una en dark y light (`* (Light).html`):

1. **Dashboard** — KPIs, gráfico semanal, fichajes en curso, recientes,
   incidencias. (El dark incluye además la **vista móvil de login**.)
2. **Turnos** — cuadrante semanal con chips de turno y gestión de cambios.
3. **Control horario** — reloj con anillo de jornada, fichar entrada/pausa/salida,
   equipo en tiempo real, timeline, corrección de fichaje.
4. **Ausencias** — saldos, aprobaciones pendientes, tabla y formulario de solicitud.
5. **Mi ficha horaria** — registro diario, totales, firma mensual.
6. **Estado de fichas** — supervisión de equipo: estado, horas, saldo, firma,
   incidencias; filtros + buscador.
7. **Empleados** — plantilla con chips de categoría/contrato + drawer "Añadir".
8. **Informes** — pestañas (fichas/cumplimiento/ausencias/horas extra) con KPIs,
   gráfico y tabla; export Excel/PDF.
9. **Configuración** — sub-nav: reglas de jornada, fichaje, notificaciones,
   organización, seguridad.

| Archivo | Rol |
|---|---|
| `Tempora — Tokens.html` | Demo visual de la paleta con conmutador dark/light en vivo. |
| `screenshots/` | Capturas de verificación (descartable). |
| `uploads/` | Imágenes de referencia aportadas por el usuario (descartable). |

---

## 4. Cómo integrar (resumen accionable)

1. Copiar `tokens.css` y `theme.service.ts` al proyecto (`src/styles/` y
   `src/app/core/`, por ejemplo).
2. `@import './styles/tokens.css';` en el `styles.css` global.
3. `<html lang="es" data-theme="dark">` en `index.html`.
4. `inject(ThemeService)` donde haya un botón de tema (topbar).
5. Al maquetar cada componente Angular, **replicar la estructura de la pantalla
   HTML correspondiente** y sustituir colores por `var(--…)`.
6. Mapear el preset de PrimeNG a los tokens (ver §"Puente con PrimeNG" del README).

---

## 5. Convenciones que Claude debe respetar al ampliar

- **Nunca** introducir colores nuevos a mano: usar tokens; si falta uno, añadirlo
  a `tokens.css` en **ambas** paletas.
- Mantener el violeta de marca para acciones primarias y nav activa.
- Estados `:focus` con ring `0 0 0 3px rgba(64,27,187,.30)`.
- Chips con `--cat-*` / `--shift-*`, nunca fondos negros.
- Verificar contraste en dark **y** light antes de dar por buena una pantalla.
- Iconos de línea, radios 10–16px, sombras violeta suaves.
- Copys en español (es-ES); terminología sanitaria (enfermería, TCAE, celador,
  turnos, fichaje, incidencia, ficha mensual).

---

## 6. Estado / pendientes sugeridos

- [ ] `definePreset()` concreto de PrimeNG (p. ej. sobre Aura) consumiendo tokens.
- [ ] Tipados/constantes TS para `--cat-*` y `--shift-*` (evitar strings sueltos).
- [ ] Tests de contraste automatizados (axe) por tema.
