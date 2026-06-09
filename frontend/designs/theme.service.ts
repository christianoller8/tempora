import { Injectable, signal, computed, effect } from '@angular/core';

/**
 * Tempora · ThemeService
 * ----------------------------------------------------------------
 * Gestiona el tema (dark / light) de la aplicación:
 *   - Fuente de verdad reactiva con Angular Signals.
 *   - Persiste la elección en localStorage.
 *   - Si no hay preferencia guardada, respeta la del sistema
 *     (prefers-color-scheme) y reacciona a sus cambios.
 *   - Refleja el tema en <html data-theme="..."> para que
 *     tokens.css aplique la paleta correcta.
 *
 * Uso típico:
 *   private theme = inject(ThemeService);
 *   this.theme.toggle();
 *   <button (click)="theme.toggle()">{{ theme.theme() }}</button>
 */

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'tempora-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  /** Tema activo (signal de solo lectura para los consumidores). */
  readonly theme = signal<Theme>(this.resolveInitial());

  /** Conveniencia: true cuando el tema es oscuro. */
  readonly isDark = computed(() => this.theme() === 'dark');

  private readonly media = window.matchMedia('(prefers-color-scheme: dark)');

  constructor() {
    // Aplica el atributo en <html> cada vez que cambia el tema.
    effect(() => {
      const t = this.theme();
      document.documentElement.setAttribute('data-theme', t);
    });

    // Si el usuario no ha fijado preferencia, sigue al sistema.
    this.media.addEventListener('change', (e) => {
      if (!localStorage.getItem(STORAGE_KEY)) {
        this.theme.set(e.matches ? 'dark' : 'light');
      }
    });
  }

  /** Cambia a un tema concreto y lo persiste. */
  set(theme: Theme): void {
    this.theme.set(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }

  /** Alterna entre dark y light. */
  toggle(): void {
    this.set(this.isDark() ? 'light' : 'dark');
  }

  /** Vuelve a la preferencia del sistema (borra la elección manual). */
  useSystem(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.theme.set(this.media.matches ? 'dark' : 'light');
  }

  private resolveInitial(): Theme {
    const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (saved === 'dark' || saved === 'light') return saved;
    // Por defecto del producto: oscuro. Cambia a la línea comentada
    // si prefieres respetar siempre el sistema en el primer arranque.
    return 'dark';
    // return this.media.matches ? 'dark' : 'light';
  }
}
