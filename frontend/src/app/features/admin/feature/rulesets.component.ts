import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { ApiService } from '../../../core/http/api.service';
import { firstValueFrom } from 'rxjs';

export interface RuleSetDto {
  id: string;
  name: string;
  isDefault: boolean;
  minRestHours: number;
  maxDailyHours: number;
  maxAnnualOvertime: number;
  weeklyRestDays: number;
  params: Record<string, unknown>;
}

type SettingsSection = 'reglas' | 'fichaje' | 'notif' | 'org' | 'seg';

@Component({
  selector: 'app-rulesets',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, FormsModule, CommonModule, TranslatePipe, ToggleSwitchModule],
  styles: [`
    :host { display: block; }

    /* ── Page header ─────────────────────────────────────────── */
    .page-header { margin-bottom: 1.5rem; }
    .page-title  { font-size: 1.5625rem; font-weight: 700; letter-spacing: -.02em; color: var(--text); }
    .page-sub    { font-size: 0.8125rem; color: var(--text-2); margin-top: 4px; }

    /* ── Settings two-column layout ──────────────────────────── */
    .settings {
      display: grid;
      grid-template-columns: 220px 1fr;
      gap: 24px;
      align-items: start;
    }

    /* ── Sub-navigation panel ────────────────────────────────── */
    .subnav {
      background: var(--surface);
      border: 1px solid var(--border-soft);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow);
      padding: 8px;
      position: sticky;
      top: 80px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .sub-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 11px 14px;
      border-radius: 10px;
      color: var(--text-2);
      font-size: 0.84375rem;
      font-weight: 500;
      cursor: pointer;
      transition: background var(--transition), color var(--transition), border-color var(--transition);
      border: 1px solid transparent;
      background: transparent;
      width: 100%;
      text-align: left;
      font-family: inherit;
    }

    .sub-item:hover {
      background: var(--primary-soft);
      color: var(--text);
    }

    .sub-item.active {
      background: var(--primary-soft);
      border-color: var(--border-soft);
      color: var(--text);
    }

    .sub-item .sub-icon {
      font-size: 0.875rem;
      flex-shrink: 0;
      color: var(--text-3);
      transition: color var(--transition);
    }

    .sub-item:hover .sub-icon,
    .sub-item.active .sub-icon { color: var(--accent-ico); }

    /* ── Content area ────────────────────────────────────────── */
    .content-area { min-width: 0; }

    /* ── Section card ────────────────────────────────────────── */
    .sec-card {
      background: var(--surface);
      border: 1px solid var(--border-soft);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow);
      margin-bottom: 18px;
      overflow: hidden;
    }

    .sec-head {
      padding: 20px 22px;
      border-bottom: 1px solid var(--border-soft);
    }

    .sec-head h2 { font-size: 1rem; font-weight: 700; color: var(--text); }
    .sec-head p  { font-size: 0.78125rem; color: var(--text-2); margin-top: 3px; }

    /* ── Banners ─────────────────────────────────────────────── */
    .banner {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      border-radius: var(--radius-sm);
      font-size: 0.875rem;
      margin-bottom: 14px;
      border: 1px solid transparent;
    }
    .banner--success { background: var(--ok-soft);     border-color: var(--ok);     color: var(--ok);     }
    .banner--error   { background: var(--danger-soft); border-color: var(--danger); color: var(--danger); }

    /* ── Rules 2-column grid ─────────────────────────────────── */
    .rules-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      padding: 18px 22px;
    }

    .rule-card {
      background: var(--bg);
      border: 1px solid var(--border-soft);
      border-radius: 13px;
      padding: 16px;
      transition: border-color var(--transition), box-shadow var(--transition);
    }

    .rule-card--selected {
      border-color: var(--primary);
      box-shadow: 0 0 0 2px var(--primary-soft);
    }

    .rule-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }

    .rule-name {
      display: flex;
      align-items: center;
      gap: 9px;
      font-size: 0.875rem;
      font-weight: 700;
      color: var(--text);
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .rule-dot {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: var(--ok);
      flex-shrink: 0;
    }

    .rule-actions { display: flex; gap: 6px; flex-shrink: 0; }

    .rule-btn {
      width: 30px;
      height: 30px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-3);
      border: 1px solid var(--border-soft);
      background: transparent;
      cursor: pointer;
      font-size: 0.8125rem;
      transition: all var(--transition);
      font-family: inherit;
    }

    .rule-btn:hover:not(:disabled) { color: var(--text); background: var(--surface-2); border-color: var(--border); }
    .rule-btn--delete:hover:not(:disabled) { color: var(--danger); border-color: var(--danger-soft); background: var(--danger-soft); }
    .rule-btn:disabled { opacity: 0.4; cursor: not-allowed; }

    /* ── Rule metrics 2×2 grid ───────────────────────────────── */
    .rule-metrics {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }

    .metric {
      background: var(--surface);
      border-radius: 9px;
      padding: 10px 12px;
    }

    .metric-value { font-size: 1.0625rem; font-weight: 700; color: var(--text); font-variant-numeric: tabular-nums; }
    .metric-label { font-size: 0.625rem; color: var(--text-3); text-transform: uppercase; letter-spacing: .05em; margin-top: 3px; }

    /* ── Empty / loading state ───────────────────────────────── */
    .state-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 48px 1rem;
      color: var(--text-3);
      font-size: 0.8125rem;
      text-align: center;
    }
    .state-box .pi { font-size: 2rem; }

    /* ── Form 3-column grid ──────────────────────────────────── */
    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 16px;
      padding: 18px 22px;
    }

    .form-field { display: flex; flex-direction: column; gap: 8px; }
    .form-field--full { grid-column: 1 / -1; }

    .form-field label {
      font-size: 0.6875rem;
      font-weight: 700;
      letter-spacing: .06em;
      color: var(--text-2);
      text-transform: uppercase;
    }

    .form-field label .req { color: var(--danger); }

    .form-input {
      height: 44px;
      padding: 0 14px;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text);
      font-size: 0.84375rem;
      font-family: inherit;
      outline: none;
      width: 100%;
      box-sizing: border-box;
      transition: border-color var(--transition), box-shadow var(--transition);
    }

    .form-input:focus {
      border-color: var(--primary-hover);
      box-shadow: 0 0 0 3px var(--primary-soft);
    }

    .form-input--num {
      width: 96px;
      text-align: center;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }

    .form-input--textarea {
      height: auto;
      min-height: 80px;
      padding: 12px 14px;
      resize: vertical;
      line-height: 1.5;
    }

    .field-hint  { font-size: 0.6875rem; font-weight: 600; color: var(--accent-ico); }
    .field-error { font-size: 0.6875rem; color: var(--danger); }

    /* ── Form footer ─────────────────────────────────────────── */
    .form-foot {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 10px;
      padding: 0 22px 20px;
    }

    .btn-cancel {
      display: flex;
      align-items: center;
      gap: 8px;
      height: 44px;
      padding: 0 18px;
      border-radius: 11px;
      border: 1px solid var(--border-soft);
      background: transparent;
      color: var(--text-2);
      font-size: 0.8125rem;
      font-weight: 600;
      cursor: pointer;
      transition: all var(--transition);
      font-family: inherit;
    }

    .btn-cancel:hover { border-color: var(--border); color: var(--text); background: var(--surface-2); }

    .btn-submit {
      display: flex;
      align-items: center;
      gap: 8px;
      height: 44px;
      padding: 0 18px;
      border-radius: 11px;
      border: none;
      background: var(--primary);
      color: #fff;
      font-size: 0.8125rem;
      font-weight: 600;
      cursor: pointer;
      box-shadow: var(--glow);
      transition: background var(--transition);
      font-family: inherit;
    }

    .btn-submit:hover:not(:disabled) { background: var(--primary-hover); }
    .btn-submit:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; }

    /* ── Setting rows (fichaje / notif / org / seg) ─────────── */
    .setting-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
      padding: 16px 22px;
      border-bottom: 1px solid var(--border-soft);
    }

    .setting-row:last-child { border-bottom: none; }

    .setting-info { flex: 1; min-width: 0; }

    .setting-label {
      font-size: 0.84375rem;
      font-weight: 600;
      color: var(--text);
    }

    .setting-desc {
      font-size: 0.75rem;
      color: var(--text-2);
      margin-top: 3px;
    }

    .setting-ctrl {
      flex: none;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .num-input {
      width: 80px;
      height: 44px;
      padding: 0 12px;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text);
      font-size: 0.875rem;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      text-align: center;
      outline: none;
      font-family: inherit;
      transition: border-color var(--transition), box-shadow var(--transition);
    }

    .num-input:focus {
      border-color: var(--primary-hover);
      box-shadow: 0 0 0 3px var(--primary-soft);
    }

    .unit-label {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--text-3);
    }

    /* ── Save bar ────────────────────────────────────────────── */
    .save-bar {
      background: var(--surface);
      border: 1px solid var(--border-soft);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 22px;
    }

    .save-note {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.75rem;
      color: var(--text-3);
    }

    /* ── Coming-soon placeholder ─────────────────────────────── */
    .coming-soon {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 56px 1rem;
      color: var(--text-3);
      font-size: 0.8125rem;
      text-align: center;
    }
    .coming-soon .pi { font-size: 2rem; }

    /* ── Responsive ──────────────────────────────────────────── */
    @media (max-width: 960px) {
      .settings { grid-template-columns: 1fr; }
      .subnav   { position: static; flex-direction: row; flex-wrap: wrap; }
    }

    @media (max-width: 700px) {
      .rules-grid { grid-template-columns: 1fr; }
      .form-grid  { grid-template-columns: 1fr 1fr; }
    }
  `],
  template: `
    <!-- ── Page header ───────────────────────────────────────── -->
    <div class="page-header">
      <div class="page-title">Configuración</div>
      <div class="page-sub">Ajustes de la organización, reglas de jornada y fichaje</div>
    </div>

    <!-- ── Settings layout ───────────────────────────────────── -->
    <div class="settings">

      <!-- Sub-navigation -->
      <nav class="subnav" aria-label="Secciones de configuración">
        <button type="button" class="sub-item" [class.active]="activeSection() === 'reglas'" (click)="activeSection.set('reglas')">
          <i class="pi pi-check-square sub-icon" aria-hidden="true"></i>
          Reglas de jornada
        </button>
        <button type="button" class="sub-item" [class.active]="activeSection() === 'fichaje'" (click)="activeSection.set('fichaje')">
          <i class="pi pi-clock sub-icon" aria-hidden="true"></i>
          Fichaje
        </button>
        <button type="button" class="sub-item" [class.active]="activeSection() === 'notif'" (click)="activeSection.set('notif')">
          <i class="pi pi-bell sub-icon" aria-hidden="true"></i>
          Notificaciones
        </button>
        <button type="button" class="sub-item" [class.active]="activeSection() === 'org'" (click)="activeSection.set('org')">
          <i class="pi pi-building sub-icon" aria-hidden="true"></i>
          Organización
        </button>
        <button type="button" class="sub-item" [class.active]="activeSection() === 'seg'" (click)="activeSection.set('seg')">
          <i class="pi pi-shield sub-icon" aria-hidden="true"></i>
          Seguridad
        </button>
      </nav>

      <!-- Content panels -->
      <div class="content-area">

        <!-- ── REGLAS DE JORNADA ─────────────────────────────── -->
        @if (activeSection() === 'reglas') {

          @if (submitError()) {
            <div role="alert" class="banner banner--error">
              <i class="pi pi-exclamation-triangle" aria-hidden="true"></i>
              {{ submitError() }}
            </div>
          }

          @if (submitSuccess()) {
            <div role="status" class="banner banner--success">
              <i class="pi pi-check-circle" aria-hidden="true"></i>
              {{ 'ADMIN.TOAST_SAVED_SUMMARY' | translate }}
            </div>
          }

          <!-- Active rules -->
          <div class="sec-card">
            <div class="sec-head">
              <h2>Reglas de jornada activas</h2>
              <p>Límites legales y de convenio aplicados al cómputo de horas (Estatuto de los Trabajadores).</p>
            </div>

            @if (loading() && ruleSets().length === 0) {
              <div class="state-box" role="status" aria-live="polite">
                <i class="pi pi-spin pi-spinner" aria-hidden="true"></i>
                <span>{{ 'COMMON.LOADING' | translate }}</span>
              </div>
            }

            @if (ruleSets().length > 0) {
              <div class="rules-grid">
                @for (rs of ruleSets(); track rs.id) {
                  <div class="rule-card" [class.rule-card--selected]="selectedId() === rs.id">
                    <div class="rule-top">
                      <div class="rule-name">
                        <span class="rule-dot"></span>
                        {{ rs.name }}
                      </div>
                      <div class="rule-actions">
                        <button
                          type="button"
                          class="rule-btn"
                          (click)="selectRuleSet(rs)"
                          [attr.aria-label]="'Editar ' + rs.name"
                          [disabled]="deletingId() !== null"
                        >
                          <i class="pi pi-pencil" aria-hidden="true"></i>
                        </button>
                        <button
                          type="button"
                          class="rule-btn rule-btn--delete"
                          (click)="deleteRuleSet(rs.id)"
                          [attr.aria-label]="'Eliminar ' + rs.name"
                          [disabled]="deletingId() !== null"
                        >
                          @if (deletingId() === rs.id) {
                            <i class="pi pi-spin pi-spinner" aria-hidden="true"></i>
                          } @else {
                            <i class="pi pi-trash" aria-hidden="true"></i>
                          }
                        </button>
                      </div>
                    </div>
                    <div class="rule-metrics">
                      <div class="metric">
                        <div class="metric-value">{{ rs.minRestHours }} h</div>
                        <div class="metric-label">Descanso entre turnos</div>
                      </div>
                      <div class="metric">
                        <div class="metric-value">{{ rs.maxDailyHours }} h</div>
                        <div class="metric-label">Máx. diario</div>
                      </div>
                      <div class="metric">
                        <div class="metric-value">{{ rs.maxAnnualOvertime }} h</div>
                        <div class="metric-label">Máx. horas extra</div>
                      </div>
                      <div class="metric">
                        <div class="metric-value">{{ rs.weeklyRestDays }} d</div>
                        <div class="metric-label">Descanso semanal</div>
                      </div>
                    </div>
                  </div>
                }
              </div>
            }

            @if (!loading() && ruleSets().length === 0) {
              <div class="state-box">
                <i class="pi pi-inbox" aria-hidden="true"></i>
                <span>No hay reglas de jornada configuradas</span>
              </div>
            }
          </div>

          <!-- Add / Edit form -->
          <div class="sec-card">
            <div class="sec-head">
              <h2>{{ selectedId() ? ('ADMIN.EDIT_RULESET' | translate) : ('ADMIN.ADD_RULESET' | translate) }}</h2>
              <p>Define un nuevo perfil de jornada. Los campos muestran el mínimo/máximo legal de referencia.</p>
            </div>

            <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
              <div class="form-grid">

                <!-- Nombre — full width, first -->
                <div class="form-field form-field--full">
                  <label for="rs-name">
                    {{ 'ADMIN.RULESET_NAME' | translate }}
                    <span class="req" aria-hidden="true"> *</span>
                  </label>
                  <input
                    class="form-input"
                    id="rs-name"
                    type="text"
                    formControlName="name"
                    placeholder="p. ej. Convenio Atención Primaria"
                    aria-required="true"
                  />
                  @if (f['name']?.invalid && f['name']?.touched) {
                    <span class="field-error" role="alert">{{ 'COMMON.REQUIRED' | translate }}</span>
                  }
                </div>

                <!-- 3-column numeric row -->
                <div class="form-field">
                  <label for="rs-minRest">Descanso mínimo entre turnos</label>
                  <input
                    class="form-input form-input--num"
                    id="rs-minRest"
                    type="number"
                    formControlName="minRestHours"
                    min="0"
                    step="0.5"
                    aria-describedby="rs-minRest-hint"
                  />
                  <span class="field-hint" id="rs-minRest-hint">Mínimo legal: 12 h (Art. 34.3 ET)</span>
                </div>

                <div class="form-field">
                  <label for="rs-maxDaily">Máx. horas diarias</label>
                  <input
                    class="form-input form-input--num"
                    id="rs-maxDaily"
                    type="number"
                    formControlName="maxDailyHours"
                    min="0"
                    step="0.5"
                    aria-describedby="rs-maxDaily-hint"
                  />
                  <span class="field-hint" id="rs-maxDaily-hint">Máximo legal: 9 h (Art. 34.3 ET)</span>
                </div>

                <div class="form-field">
                  <label for="rs-maxOT">Máx. horas extra anuales</label>
                  <input
                    class="form-input form-input--num"
                    id="rs-maxOT"
                    type="number"
                    formControlName="maxAnnualOvertime"
                    min="0"
                    aria-describedby="rs-maxOT-hint"
                  />
                  <span class="field-hint" id="rs-maxOT-hint">Máximo legal: 80 h (Art. 35.2 ET)</span>
                </div>

                <!-- Descanso semanal — col 1 of new row -->
                <div class="form-field">
                  <label for="rs-weekly">Descanso semanal mínimo</label>
                  <input
                    class="form-input form-input--num"
                    id="rs-weekly"
                    type="number"
                    formControlName="weeklyRestDays"
                    min="0"
                    step="0.5"
                    aria-describedby="rs-weekly-hint"
                  />
                  <span class="field-hint" id="rs-weekly-hint">Mínimo legal: 1,5 días (Art. 37.1 ET)</span>
                </div>

                <!-- JSON params — full width, last -->
                <div class="form-field form-field--full">
                  <label for="rs-params">Parámetros del convenio (JSON)</label>
                  <textarea
                    class="form-input form-input--textarea"
                    id="rs-params"
                    formControlName="params"
                    rows="4"
                    placeholder='{"festivos_anuales": 14, "plus_nocturnidad": true, "computo": "anual"}'
                    aria-describedby="rs-params-hint"
                  ></textarea>
                  <span class="field-hint" id="rs-params-hint" style="color: var(--text-3)">
                    Parámetros específicos del convenio en formato JSON.
                  </span>
                  @if (f['params']?.errors?.['jsonInvalid']) {
                    <span class="field-error" role="alert">{{ 'COMMON.ERROR' | translate }}</span>
                  }
                </div>

              </div>

              <div class="form-foot">
                @if (selectedId()) {
                  <button type="button" class="btn-cancel" (click)="clearSelection()">
                    {{ 'COMMON.CANCEL' | translate }}
                  </button>
                }
                <button type="submit" class="btn-submit" [disabled]="form.invalid || loading()">
                  @if (loading()) {
                    <i class="pi pi-spin pi-spinner" aria-hidden="true"></i>
                  } @else {
                    <i class="pi pi-check" aria-hidden="true"></i>
                  }
                  {{ selectedId() ? ('ADMIN.EDIT_RULESET' | translate) : ('ADMIN.ADD_RULESET' | translate) }}
                </button>
              </div>
            </form>
          </div>

        }

        <!-- ── FICHAJE ───────────────────────────────────────── -->
        @else if (activeSection() === 'fichaje') {

          <div class="sec-card">
            <div class="sec-head">
              <h2>Reglas de fichaje</h2>
              <p>Cómo y desde dónde puede fichar el personal.</p>
            </div>

            <div class="setting-row">
              <div class="setting-info">
                <div class="setting-label">Geolocalización al fichar</div>
                <div class="setting-desc">Solicita la ubicación del dispositivo en cada fichaje.</div>
              </div>
              <div class="setting-ctrl">
                <p-toggleswitch
                  [ngModel]="fichajeGeo()"
                  (ngModelChange)="fichajeGeo.set($event)"
                  aria-label="Geolocalización al fichar"
                />
              </div>
            </div>

            <div class="setting-row">
              <div class="setting-info">
                <div class="setting-label">Restringir a centros autorizados</div>
                <div class="setting-desc">Solo permite fichar dentro del radio de las sedes registradas.</div>
              </div>
              <div class="setting-ctrl">
                <p-toggleswitch
                  [ngModel]="fichajeRestrict()"
                  (ngModelChange)="fichajeRestrict.set($event)"
                  aria-label="Restringir a centros autorizados"
                />
              </div>
            </div>

            <div class="setting-row">
              <div class="setting-info">
                <div class="setting-label">Pausa de comida automática</div>
                <div class="setting-desc">Descuenta el tiempo de pausa configurado en jornadas largas.</div>
              </div>
              <div class="setting-ctrl">
                <input
                  class="num-input"
                  type="number"
                  [ngModel]="fichajeLunch()"
                  (ngModelChange)="fichajeLunch.set($event)"
                  min="0"
                  aria-label="Pausa de comida en minutos"
                />
                <span class="unit-label">min</span>
              </div>
            </div>

            <div class="setting-row">
              <div class="setting-info">
                <div class="setting-label">Tolerancia de entrada</div>
                <div class="setting-desc">Margen sin marcar incidencia respecto al turno previsto.</div>
              </div>
              <div class="setting-ctrl">
                <input
                  class="num-input"
                  type="number"
                  [ngModel]="fichajeTolerance()"
                  (ngModelChange)="fichajeTolerance.set($event)"
                  min="0"
                  aria-label="Tolerancia de entrada en minutos"
                />
                <span class="unit-label">min</span>
              </div>
            </div>

            <div class="setting-row">
              <div class="setting-info">
                <div class="setting-label">Cierre automático de fichajes abiertos</div>
                <div class="setting-desc">Cierra fichas sin salida pasada la medianoche y genera incidencia.</div>
              </div>
              <div class="setting-ctrl">
                <p-toggleswitch
                  [ngModel]="fichajeAutoClose()"
                  (ngModelChange)="fichajeAutoClose.set($event)"
                  aria-label="Cierre automático de fichajes abiertos"
                />
              </div>
            </div>
          </div>

          <div class="save-bar">
            <div class="save-note">
              <i class="pi pi-info-circle" aria-hidden="true"></i>
              Los cambios se aplican a toda la organización.
            </div>
            <button type="button" class="btn-submit" (click)="onSaveFichaje()">
              <i class="pi pi-save" aria-hidden="true"></i>
              Guardar cambios
            </button>
          </div>

        }

        <!-- ── NOTIFICACIONES ────────────────────────────────── -->
        @else if (activeSection() === 'notif') {

          <div class="sec-card">
            <div class="sec-head">
              <h2>Notificaciones</h2>
              <p>Avisos por correo y dentro de la aplicación.</p>
            </div>

            <div class="setting-row">
              <div class="setting-info">
                <div class="setting-label">Fichaje sin cerrar</div>
                <div class="setting-desc">Avisar al responsable cuando una ficha queda abierta.</div>
              </div>
              <div class="setting-ctrl">
                <p-toggleswitch
                  [ngModel]="notifOpenEntry()"
                  (ngModelChange)="notifOpenEntry.set($event)"
                  aria-label="Fichaje sin cerrar"
                />
              </div>
            </div>

            <div class="setting-row">
              <div class="setting-info">
                <div class="setting-label">Solicitudes de ausencia</div>
                <div class="setting-desc">Notificar nuevas solicitudes pendientes de aprobación.</div>
              </div>
              <div class="setting-ctrl">
                <p-toggleswitch
                  [ngModel]="notifAbsenceRequests()"
                  (ngModelChange)="notifAbsenceRequests.set($event)"
                  aria-label="Solicitudes de ausencia"
                />
              </div>
            </div>

            <div class="setting-row">
              <div class="setting-info">
                <div class="setting-label">Cambios de turno</div>
                <div class="setting-desc">Avisar de solicitudes de intercambio entre empleados.</div>
              </div>
              <div class="setting-ctrl">
                <p-toggleswitch
                  [ngModel]="notifShiftSwaps()"
                  (ngModelChange)="notifShiftSwaps.set($event)"
                  aria-label="Cambios de turno"
                />
              </div>
            </div>

            <div class="setting-row">
              <div class="setting-info">
                <div class="setting-label">Exceso de jornada</div>
                <div class="setting-desc">Alertar cuando se superen los límites de la regla aplicada.</div>
              </div>
              <div class="setting-ctrl">
                <p-toggleswitch
                  [ngModel]="notifOvertime()"
                  (ngModelChange)="notifOvertime.set($event)"
                  aria-label="Exceso de jornada"
                />
              </div>
            </div>

            <div class="setting-row">
              <div class="setting-info">
                <div class="setting-label">Resumen semanal por correo</div>
                <div class="setting-desc">Enviar cada lunes el resumen de horas e incidencias.</div>
              </div>
              <div class="setting-ctrl">
                <p-toggleswitch
                  [ngModel]="notifWeeklySummary()"
                  (ngModelChange)="notifWeeklySummary.set($event)"
                  aria-label="Resumen semanal por correo"
                />
              </div>
            </div>
          </div>

          <div class="save-bar">
            <div class="save-note">
              <i class="pi pi-info-circle" aria-hidden="true"></i>
              Los cambios se aplican a toda la organización.
            </div>
            <button type="button" class="btn-submit" (click)="onSaveNotif()">
              <i class="pi pi-save" aria-hidden="true"></i>
              Guardar cambios
            </button>
          </div>

        }

        <!-- ── OTHER SECTIONS (placeholder) ─────────────────── -->
        @else {
          <div class="sec-card">
            <div class="coming-soon">
              <i class="pi pi-wrench" aria-hidden="true"></i>
              <span>Esta sección estará disponible próximamente</span>
            </div>
          </div>
        }

      </div>
    </div>
  `,
})
export class RulesetsComponent implements OnInit {
  private readonly api       = inject(ApiService);
  private readonly fb        = inject(FormBuilder);
  private readonly translate = inject(TranslateService);

  protected readonly ruleSets      = signal<RuleSetDto[]>([]);
  protected readonly loading       = signal(false);
  protected readonly submitError   = signal<string | null>(null);
  protected readonly submitSuccess = signal(false);
  protected readonly selectedId    = signal<string | null>(null);
  protected readonly activeSection = signal<SettingsSection>('reglas');
  protected readonly deletingId    = signal<string | null>(null);

  // Fichaje settings state
  protected readonly fichajeGeo        = signal(true);
  protected readonly fichajeRestrict   = signal(true);
  protected readonly fichajeLunch      = signal(30);
  protected readonly fichajeTolerance  = signal(10);
  protected readonly fichajeAutoClose  = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    name:              ['', Validators.required],
    isDefault:         [false],
    minRestHours:      [12,  [Validators.required, Validators.min(0)]],
    maxDailyHours:     [9,   [Validators.required, Validators.min(0)]],
    maxAnnualOvertime: [80,  [Validators.required, Validators.min(0)]],
    weeklyRestDays:    [1.5, [Validators.required, Validators.min(0)]],
    params:            ['{}'],
  });

  get f() { return this.form.controls; }

  // Notificaciones settings state
  protected readonly notifOpenEntry       = signal(true);
  protected readonly notifAbsenceRequests = signal(true);
  protected readonly notifShiftSwaps      = signal(true);
  protected readonly notifOvertime        = signal(true);
  protected readonly notifWeeklySummary   = signal(false);

  protected onSaveFichaje(): void {
    // TODO: wire to PATCH /settings/fichaje when backend endpoint is available
  }

  protected onSaveNotif(): void {
    // TODO: wire to PATCH /settings/notificaciones when backend endpoint is available
  }

  async ngOnInit(): Promise<void> {
    await this.loadRuleSets();
  }

  private async loadRuleSets(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await firstValueFrom(this.api.get<{ data: RuleSetDto[] }>('/rule-sets'));
      this.ruleSets.set(res.data);
    } catch {
      this.submitError.set(this.translate.instant('ADMIN.TOAST_ERROR_DETAIL'));
    } finally {
      this.loading.set(false);
    }
  }

  protected selectRuleSet(rs: RuleSetDto): void {
    this.selectedId.set(rs.id);
    this.submitSuccess.set(false);
    this.submitError.set(null);
    this.form.setValue({
      name:              rs.name,
      isDefault:         rs.isDefault,
      minRestHours:      rs.minRestHours,
      maxDailyHours:     rs.maxDailyHours,
      maxAnnualOvertime: rs.maxAnnualOvertime,
      weeklyRestDays:    rs.weeklyRestDays,
      params:            JSON.stringify(rs.params, null, 2),
    });
  }

  protected clearSelection(): void {
    this.selectedId.set(null);
    this.form.reset({
      name:              '',
      isDefault:         false,
      minRestHours:      12,
      maxDailyHours:     9,
      maxAnnualOvertime: 80,
      weeklyRestDays:    1.5,
      params:            '{}',
    });
  }

  protected async deleteRuleSet(id: string): Promise<void> {
    this.deletingId.set(id);
    this.submitError.set(null);
    try {
      await firstValueFrom(this.api.delete<void>(`/rule-sets/${id}`));
      await this.loadRuleSets();
      if (this.selectedId() === id) this.clearSelection();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : this.translate.instant('ADMIN.TOAST_ERROR_DETAIL');
      this.submitError.set(message);
    } finally {
      this.deletingId.set(null);
    }
  }

  protected async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const rawParams = this.form.getRawValue().params;
    let parsedParams: Record<string, unknown> = {};
    try {
      parsedParams = JSON.parse(rawParams) as Record<string, unknown>;
    } catch {
      this.f['params']?.setErrors({ jsonInvalid: true });
      return;
    }

    this.loading.set(true);
    this.submitError.set(null);
    this.submitSuccess.set(false);

    const { name, isDefault, minRestHours, maxDailyHours, maxAnnualOvertime, weeklyRestDays } =
      this.form.getRawValue();
    const payload = { name, isDefault, minRestHours, maxDailyHours, maxAnnualOvertime, weeklyRestDays, params: parsedParams };

    try {
      const id = this.selectedId();
      if (id) {
        await firstValueFrom(this.api.patch<{ data: RuleSetDto }>(`/rule-sets/${id}`, payload));
      } else {
        await firstValueFrom(this.api.post<{ data: RuleSetDto }>('/rule-sets', payload));
      }
      this.submitSuccess.set(true);
      await this.loadRuleSets();
      this.clearSelection();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : this.translate.instant('ADMIN.TOAST_ERROR_DETAIL');
      this.submitError.set(message);
    } finally {
      this.loading.set(false);
    }
  }
}
