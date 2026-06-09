# Tempora · Sistema visual e integración

Referencia de estilos para **Tempora** (Angular 21 + PrimeNG + @ngrx/signals),
sector sanitario. Incluye las maquetas HTML (dark + light), la hoja de tokens y
un servicio de tema para Angular.

---

## 1. Qué hay en este paquete

| Archivo | Para qué sirve |
|---|---|
| `tokens.css` | **Única fuente de color/espaciado.** Dos paletas espejo (`data-theme="dark"` / `"light"`). |
| `theme.service.ts` | Servicio Angular con Signals: alterna tema, persiste en `localStorage`, sigue al sistema. |
| `Tempora — *.html` | Maquetas de referencia visual (9 pantallas en dark). |
| `Tempora — * (Light).html` | Las mismas 9 pantallas en light mode. |
| `Tempora — Tokens.html` | Demo visual de la paleta con conmutador en vivo. |

> Las maquetas son **referencia visual**, no código de producción. Copia los
> valores/estructura a tus componentes Angular + PrimeNG.

---

## 2. Paleta (resumen)

| Token | Dark | Light |
|---|---|---|
| `--bg` | `#150F26` | `#F4F2FB` |
| `--surface` | `#1E1640` | `#FFFFFF` |
| `--surface-2` | `#241A4D` | `#F0EDF9` |
| `--border` | `#3F336A` | `#E4E0F2` |
| `--text` | `#FFFFFF` | `#1B1430` |
| `--text-2` | `rgba(255,255,255,.60)` | `rgba(27,20,48,.62)` |
| `--primary` | `#401BBB` | `#401BBB` |
| `--primary-hover` | `#5229D4` | `#5229D4` |

El **violeta de marca** (`--primary` / `--primary-hover`) es idéntico en ambos
temas. Los estados (`--ok/warn/danger`) se **oscurecen en light** para mantener
contraste AA sobre blanco. Hay tokens dedicados para **categorías
profesionales** (`--cat-*`) y **tipos de turno** (`--shift-*`).

---

## 3. Integración en Angular

### 3.1 Importar los tokens
En `src/styles.css` (o `styles.scss`):

```css
@import './tokens.css';
```

### 3.2 Declarar el tema en el host
En `src/index.html`:

```html
<html lang="es" data-theme="dark">
```

`ThemeService` sobrescribe este atributo en arranque, así que el valor inicial
solo evita un parpadeo.

### 3.3 Usar el servicio

```ts
import { Component, inject } from '@angular/core';
import { ThemeService } from './core/theme.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  template: `
    <button class="icon-btn" (click)="theme.toggle()">
      {{ theme.isDark() ? '☾' : '☀' }}
    </button>
  `,
})
export class TopbarComponent {
  readonly theme = inject(ThemeService);
}
```

El servicio:
- lee `localStorage('tempora-theme')` al arrancar;
- si no hay valor, usa **dark** por defecto (configurable en `resolveInitial`);
- escribe `data-theme` en `<html>` vía `effect()`;
- reacciona a `prefers-color-scheme` mientras el usuario no fije preferencia.

---

## 4. Puente con PrimeNG

`tokens.css` ya mapea variables del preset de PrimeNG a los tokens de Tempora:

```css
:root{
  --p-primary-color:var(--primary);
  --p-content-background:var(--surface);
  --p-text-color:var(--text);
  /* … */
}
```

Ajusta los nombres a tu preset (Aura / Lara / …). Si usas el sistema de
**design tokens de PrimeNG v4+**, define el preset con `definePreset()` y apunta
sus `colorScheme.dark` / `colorScheme.light` a estas variables, o sobreescribe
las CSS vars del preset como arriba.

> Recomendación: deja que PrimeNG gestione sus componentes vía sus propias
> variables y usa los tokens de Tempora para tu **layout propio** (sidebar,
> topbar, cards, KPIs, chips). Así evitas pelear con la especificidad del tema.

---

## 5. Primitivas listas para usar

`tokens.css` incluye atajos opcionales: `.tmp-card`, `.tmp-btn-primary`,
`.tmp-input`, `.tmp-chip`. Combínalas con los tokens de categoría/turno:

```html
<span class="tmp-chip" style="color:var(--cat-enf);background:var(--cat-enf-bg)">
  ENFERMERÍA
</span>
```

---

## 6. Convenciones de la maqueta

- **Radios**: 10–16 px (`--radius` / `--radius-lg`).
- **Sombras**: violeta muy suaves (`--shadow`, `--glow`).
- **Iconos**: línea, `stroke-width:1.6`, sin relleno.
- **Tabla**: cabecera en `--surface-2`, hover de fila `rgba(64,27,187,.04)` (light).
- **Ítem de nav activo**: fondo `--primary-soft`, texto/icono `--primary`.

---

## 7. Checklist al portar una pantalla

- [ ] Sustituir colores hardcodeados por `var(--…)`.
- [ ] Verificar contraste en **ambos** temas (sobre todo chips y estados).
- [ ] Estados `:hover` / `:focus` usando `--primary-hover` y el ring
      `0 0 0 3px rgba(64,27,187,.30)`.
- [ ] Quitar cualquier verde genérico heredado del tema anterior.
