import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '../../../core/i18n/language.service';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';
import { AbsencesStore } from '../data-access/absences.store';
import type { AbsenceDto, AbsenceType } from '../data-access/absences.api';
import { AuthStore } from '../../../core/auth/auth.store';

const ABSENCE_TYPES: AbsenceType[] = [
  'VACACIONES', 'IT', 'PERMISO_RETRIBUIDO', 'AUSENCIA_INJUSTIFICADA',
  'LACTANCIA', 'REDUCCION_JORNADA', 'ASUNTOS_PROPIOS',
  'PERMISO_NO_RETRIBUIDO', 'MATERNIDAD_PATERNIDAD',
];

/**
 * AbsenceRequestComponent — smart container for creating absence requests.
 *
 * - Reactive Form: type selector, date range, optional cause (IT only).
 * - Calls AbsencesStore.createAbsence() on submit.
 * - Shows validation errors (overlap, balance exhausted) from API response.
 */
type TagSeverity = 'success' | 'info' | 'warn' | 'secondary' | 'contrast' | 'danger';

const STATUS_SEVERITY: Record<AbsenceDto['status'], TagSeverity> = {
  PENDING:   'warn',
  APPROVED:  'success',
  REJECTED:  'danger',
  CANCELLED: 'secondary',
};

@Component({
  selector: 'app-absence-request',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, DatePipe, ButtonModule, TagModule, SkeletonModule, TooltipModule, TranslatePipe],
  styles: [`
    :host { display: block; max-width: 860px; margin: 0 auto; }

    /* ── Page header ──────────────────────────────────────────────── */
    .page-header { margin-bottom: 1.75rem; }
    .page-title  { font-size: 1.375rem; font-weight: 700; letter-spacing: -0.02em; color: var(--text); }
    .page-sub    { font-size: 0.8125rem; color: var(--text-2); margin-top: 0.25rem; }

    /* ── Section headings ─────────────────────────────────────────── */
    .section-title {
      font-size: 0.9375rem; font-weight: 700; color: var(--text);
      display: flex; align-items: center; gap: 0.5rem;
      margin-bottom: 0.875rem; margin-top: 1.5rem;
    }
    .section-title .pi { color: var(--accent-ico); font-size: 0.9rem; }
    .section-title:first-child { margin-top: 0; }

    /* ── Absence history / approval panel ────────────────────────── */
    .abs-panel {
      background: var(--surface);
      border: 1px solid var(--border-soft);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow);
      overflow: hidden;
      margin-bottom: 1.5rem;
    }

    .abs-header-row, .abs-row {
      display: grid;
      grid-template-columns: 2fr 1.5fr 1.5fr 1fr auto;
      align-items: center;
      gap: 0.5rem;
      padding: 0.625rem 1.25rem;
      border-bottom: 1px solid var(--border-soft);
      transition: background var(--transition);
    }

    .abs-header-row {
      background: var(--surface-2);
      padding: 0.5rem 1.25rem 0.375rem;
    }

    .abs-row:last-child { border-bottom: none; }
    .abs-row:hover      { background: var(--primary-soft); }

    .abs-col-label {
      font-size: 0.6875rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.08em; color: var(--text-3);
    }

    .abs-type  { font-size: 0.875rem; font-weight: 600; color: var(--text); }
    .abs-dates { font-size: 0.8125rem; color: var(--text-2); font-variant-numeric: tabular-nums; }
    .abs-actions { display: flex; gap: 0.375rem; }

    /* ── Row wrapper (keeps decision form attached to row) ─────────── */
    .abs-row-wrap { border-bottom: 1px solid var(--border-soft); }
    .abs-row-wrap:last-child { border-bottom: none; }
    .abs-row-wrap .abs-row  { border-bottom: none; }

    /* ── Empty state ──────────────────────────────────────────────── */
    .empty-state {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 0.5rem; padding: 2.5rem 1rem;
      color: var(--text-3); font-size: 0.8125rem;
    }
    .empty-state .pi { font-size: 1.75rem; opacity: 0.4; }

    /* ── Decision inline form ─────────────────────────────────────── */
    .decision-form {
      border-top: 1px solid var(--border-soft);
      padding: 0.625rem 1.25rem 0.75rem;
    }
    .decision-form label {
      display: block;
      font-size: 0.75rem; font-weight: 600;
      margin-bottom: 0.25rem;
      color: var(--text-2);
    }
    .decision-form textarea {
      width: 100%;
      padding: 0.5rem 0.75rem;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text);
      font-size: 0.8125rem;
      outline: none; resize: vertical;
      margin-bottom: 0.5rem;
      transition: border-color var(--transition), box-shadow var(--transition);
    }
    .decision-form textarea:focus {
      border-color: var(--primary-hover);
      box-shadow: 0 0 0 3px var(--primary-soft);
    }
    .decision-form .decision-actions { display: flex; gap: 0.375rem; }

    /* ── Decision comment display ─────────────────────────────────── */
    .decision-comment {
      display: flex; align-items: flex-start; gap: 0.375rem;
      margin-top: 0.375rem;
      font-size: 0.75rem; color: var(--text-2); font-style: italic;
    }
    .decision-comment .pi { margin-top: 2px; flex-shrink: 0; }

    /* ── Request form panel ───────────────────────────────────────── */
    .form-panel {
      background: var(--surface);
      border: 1px solid var(--border-soft);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow);
      padding: 1.5rem;
    }

    .field { margin-bottom: 1rem; }
    .field label {
      display: block; font-size: 0.71875rem; font-weight: 600;
      margin-bottom: 0.5rem; color: var(--text-2);
    }

    .field select,
    .field input[type="date"] {
      width: 100%; height: 46px; padding: 0 0.875rem;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text);
      font-size: 0.84375rem;
      outline: none; appearance: auto;
      transition: border-color var(--transition), box-shadow var(--transition);
    }
    .field select:focus,
    .field input[type="date"]:focus {
      border-color: var(--primary-hover);
      box-shadow: 0 0 0 3px var(--primary-soft);
    }

    .field textarea {
      width: 100%; padding: 0.75rem 0.875rem;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text);
      font-size: 0.84375rem;
      outline: none; resize: vertical;
      transition: border-color var(--transition), box-shadow var(--transition);
    }
    .field textarea:focus {
      border-color: var(--primary-hover);
      box-shadow: 0 0 0 3px var(--primary-soft);
    }

    .field .error {
      font-size: 0.75rem; color: var(--danger);
      margin-top: 0.25rem; display: block;
    }
    .field .hint {
      font-size: 0.75rem; color: var(--text-3); margin-top: 0.25rem;
    }

    .form-actions {
      display: flex; align-items: center; gap: 0.875rem;
      flex-wrap: wrap; margin-top: 1.25rem;
    }
    .submit-feedback { font-size: 0.8125rem; }
    .submit-feedback.success { color: var(--ok); }
    .submit-feedback.error   { color: var(--danger); }

    /* ── Dark mode overrides ──────────────────────────────────────── */
    :host-context([data-theme="dark"]) .abs-panel {
      box-shadow: var(--shadow);
    }

    :host-context([data-theme="dark"]) .abs-header-row {
      background: var(--surface-2);
    }

    :host-context([data-theme="dark"]) .form-panel {
      box-shadow: var(--shadow);
    }

    :host-context([data-theme="dark"]) .field select,
    :host-context([data-theme="dark"]) .field input[type="date"],
    :host-context([data-theme="dark"]) .field textarea,
    :host-context([data-theme="dark"]) .decision-form textarea {
      background: var(--bg);
      border-color: var(--border);
    }

    :host-context([data-theme="dark"]) .field select:focus,
    :host-context([data-theme="dark"]) .field input[type="date"]:focus,
    :host-context([data-theme="dark"]) .field textarea:focus,
    :host-context([data-theme="dark"]) .decision-form textarea:focus {
      border-color: var(--primary-hover);
      box-shadow: 0 0 0 3px var(--primary-soft);
    }
  `],
  template: `
    <!-- ── Page header ─────────────────────────────────────────────── -->
    <div class="page-header">
      <div class="page-title">{{ isAdminOrManager() ? ('ABSENCES.TITLE' | translate) : ('ABSENCES.MY_ABSENCES' | translate) }}</div>
      <div class="page-sub">{{ isAdminOrManager() ? ('ABSENCES.APPROVAL_TITLE' | translate) : ('ABSENCES.MY_ABSENCES' | translate) }}</div>
    </div>

    <!-- ── ADMIN / MANAGER VIEW ────────────────────────────────────── -->
    @if (isAdminOrManager()) {

      <!-- Pending approval queue -->
      <div class="section-title"><i class="pi pi-inbox"></i>{{ 'ABSENCES.APPROVAL_TITLE' | translate }}</div>
      <div class="abs-panel">
        @if (store.loading() && pendingAbsences().length === 0) {
          <div style="padding:1rem; display:flex; flex-direction:column; gap:0.5rem;">
            @for (_ of [1,2]; track $index) { <p-skeleton height="2.5rem" borderRadius="6px" /> }
          </div>
        } @else if (pendingAbsences().length === 0) {
          <div class="empty-state">
            <i class="pi pi-check-circle"></i>
            <span>{{ 'ABSENCES.EMPTY_REQUESTS' | translate }}</span>
          </div>
        } @else {
          <div class="abs-header-row">
            <span class="abs-col-label">{{ 'ABSENCES.TABLE_TYPE' | translate }}</span>
            <span class="abs-col-label">{{ 'ABSENCES.TABLE_FROM' | translate }}</span>
            <span class="abs-col-label">{{ 'ABSENCES.TABLE_TO' | translate }}</span>
            <span class="abs-col-label">{{ 'ABSENCES.TABLE_STATUS' | translate }}</span>
            <span class="abs-col-label">{{ 'ABSENCES.TABLE_ACTIONS' | translate }}</span>
          </div>
          @for (abs of pendingAbsences(); track abs.id) {
            <div class="abs-row-wrap">
              <div class="abs-row">
                <span class="abs-type">{{ 'ABSENCES.TYPES.' + abs.type | translate }}</span>
                <span class="abs-dates">{{ abs.startDate | date:'d MMM y' }}</span>
                <span class="abs-dates">{{ abs.endDate | date:'d MMM y' }}</span>
                <p-tag [value]="abs.status" [severity]="statusSeverity(abs.status)" [rounded]="true" [style]="{ fontSize: '0.7rem' }" />
                <div class="abs-actions">
                  <p-button icon="pi pi-check" severity="success" size="small"
                    [pTooltip]="'COMMON.APPROVE' | translate" [loading]="processingId() === abs.id" [disabled]="processingId() !== null"
                    (onClick)="openDecision(abs.id, 'approve')" />
                  <p-button icon="pi pi-times" severity="danger" size="small"
                    [pTooltip]="'COMMON.REJECT' | translate" [loading]="processingId() === abs.id" [disabled]="processingId() !== null"
                    (onClick)="openDecision(abs.id, 'reject')" />
                </div>
              </div>
              @if (decisionTargetId() === abs.id) {
                <div class="decision-form" style="padding: 0.625rem 1.25rem 0.75rem;">
                  <label [for]="'decision-comment-' + abs.id">{{ 'ABSENCES.FIELD_COMMENT' | translate }}</label>
                  <textarea
                    [id]="'decision-comment-' + abs.id"
                    [attr.aria-label]="'ABSENCES.FIELD_COMMENT' | translate"
                    rows="2"
                    [value]="decisionComment()"
                    (input)="decisionComment.set($any($event.target).value)"
                    [placeholder]="'ABSENCES.FIELD_COMMENT_PLACEHOLDER' | translate"
                    maxlength="500"
                  ></textarea>
                  <div class="decision-actions">
                    <p-button
                      [label]="decisionAction() === 'approve' ? ('ABSENCES.CONFIRM_APPROVE' | translate) : ('ABSENCES.CONFIRM_REJECT' | translate)"
                      [icon]="decisionAction() === 'approve' ? 'pi pi-check' : 'pi pi-times'"
                      [severity]="decisionAction() === 'approve' ? 'success' : 'danger'"
                      size="small"
                      [loading]="processingId() === abs.id"
                      (onClick)="confirmDecision(abs.id)"
                    />
                    <p-button [label]="'COMMON.CANCEL' | translate" severity="secondary" [text]="true" size="small"
                      (onClick)="cancelDecision()" />
                  </div>
                </div>
              }
            </div>
          }
        }
      </div>

      <!-- All absences -->
      <div class="section-title"><i class="pi pi-list"></i>{{ 'ABSENCES.TITLE' | translate }}</div>
      <div class="abs-panel">
        @if (store.loading() && nonPendingAbsences().length === 0) {
          <div style="padding:1rem; display:flex; flex-direction:column; gap:0.5rem;">
            @for (_ of [1,2,3]; track $index) { <p-skeleton height="2.5rem" borderRadius="6px" /> }
          </div>
        } @else if (nonPendingAbsences().length === 0) {
          <div class="empty-state">
            <i class="pi pi-calendar-times"></i>
            <span>{{ 'ABSENCES.EMPTY_REQUESTS' | translate }}</span>
          </div>
        } @else {
          <div class="abs-header-row">
            <span class="abs-col-label">Type</span>
            <span class="abs-col-label">From</span>
            <span class="abs-col-label">To</span>
            <span class="abs-col-label">Status</span>
            <span></span>
          </div>
          @for (abs of nonPendingAbsences(); track abs.id) {
            <div class="abs-row-wrap">
              <div class="abs-row">
                <span class="abs-type">{{ 'ABSENCES.TYPES.' + abs.type | translate }}</span>
                <span class="abs-dates">{{ abs.startDate | date:'d MMM y' }}</span>
                <span class="abs-dates">{{ abs.endDate | date:'d MMM y' }}</span>
                <p-tag [value]="abs.status" [severity]="statusSeverity(abs.status)" [rounded]="true" [style]="{ fontSize: '0.7rem' }" />
                <span></span>
              </div>
              @if (abs.decisionComment) {
                <div class="decision-comment" style="padding: 0.25rem 1.25rem 0.5rem;">
                  <i class="pi pi-comment"></i> {{ abs.decisionComment }}
                </div>
              }
            </div>
          }
        }
      </div>
    }

    <!-- ── EMPLOYEE VIEW ────────────────────────────────────────────── -->
    @if (!isAdminOrManager()) {
      <div class="section-title"><i class="pi pi-list"></i>{{ 'ABSENCES.MY_ABSENCES' | translate }}</div>
      <div class="abs-panel">
        @if (store.loading() && store.absences().length === 0) {
          <div style="padding:1rem; display:flex; flex-direction:column; gap:0.5rem;">
            @for (_ of [1,2]; track $index) { <p-skeleton height="2.5rem" borderRadius="6px" /> }
          </div>
        } @else if (store.absences().length === 0) {
          <div class="empty-state">
            <i class="pi pi-calendar-times"></i>
            <span>{{ 'ABSENCES.EMPTY_REQUESTS' | translate }}</span>
          </div>
        } @else {
          <div class="abs-header-row">
            <span class="abs-col-label">Type</span>
            <span class="abs-col-label">From</span>
            <span class="abs-col-label">To</span>
            <span class="abs-col-label">Status</span>
            <span></span>
          </div>
          @for (abs of store.absences(); track abs.id) {
            <div class="abs-row-wrap">
              <div class="abs-row">
                <span class="abs-type">{{ 'ABSENCES.TYPES.' + abs.type | translate }}</span>
                <span class="abs-dates">{{ abs.startDate | date:'d MMM y' }}</span>
                <span class="abs-dates">{{ abs.endDate | date:'d MMM y' }}</span>
                <p-tag [value]="abs.status" [severity]="statusSeverity(abs.status)" [rounded]="true" [style]="{ fontSize: '0.7rem' }" />
                <span></span>
              </div>
              @if (abs.decisionComment) {
                <div class="decision-comment" style="padding: 0.25rem 1.25rem 0.5rem;">
                  <i class="pi pi-comment"></i> {{ abs.decisionComment }}
                </div>
              }
            </div>
          }
        }
      </div>
    }

    <!-- ── Request form (all roles) ────────────────────────────────── -->
    <div class="section-title"><i class="pi pi-plus-circle"></i>{{ 'ABSENCES.REQUEST_TITLE' | translate }}</div>
    <div class="form-panel">
      <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate aria-label="Absence request form">

        <div class="field">
          <label for="type">{{ 'ABSENCES.FIELD_TYPE' | translate }} <span aria-hidden="true">*</span></label>
          <select id="type" formControlName="type" aria-required="true">
            @for (type of absenceTypes; track type) {
              <option [value]="type">{{ 'ABSENCES.TYPES.' + type | translate }}</option>
            }
          </select>
          @if (f['type']?.invalid && f['type']?.touched) {
            <span class="error" role="alert">{{ 'ABSENCES.REQUIRED_TYPE' | translate }}</span>
          }
        </div>

        <div class="field">
          <label for="startDate">{{ 'ABSENCES.FIELD_DATE_FROM' | translate }} <span aria-hidden="true">*</span></label>
          <input id="startDate" type="date" formControlName="startDate" aria-required="true" />
          @if (f['startDate']?.invalid && f['startDate']?.touched) {
            <span class="error" role="alert">{{ 'ABSENCES.REQUIRED_DATE_FROM' | translate }}</span>
          }
        </div>

        <div class="field">
          <label for="endDate">{{ 'ABSENCES.FIELD_DATE_TO' | translate }} <span aria-hidden="true">*</span></label>
          <input id="endDate" type="date" formControlName="endDate" aria-required="true" />
          @if (f['endDate']?.invalid && f['endDate']?.touched) {
            <span class="error" role="alert">{{ 'ABSENCES.REQUIRED_DATE_TO' | translate }}</span>
          }
        </div>

        @if (isItType()) {
          <div class="field">
            <label for="cause">Medical cause</label>
            <textarea id="cause" formControlName="cause" rows="3"
              aria-label="Medical cause (confidential — GDPR protected)"
              placeholder="Optional: describe the medical cause"></textarea>
            <p class="hint">This information is protected under GDPR Art. 9 and stored encrypted.</p>
          </div>
        }

        <div class="form-actions">
          <p-button
            type="submit"
            [label]="'ABSENCES.REQUEST_ABSENCE' | translate"
            icon="pi pi-send"
            [loading]="store.loading()"
            [disabled]="form.invalid"
          />
          @if (submitSuccess()) {
            <span class="submit-feedback success"><i class="pi pi-check"></i> {{ 'ABSENCES.REQUEST_TITLE' | translate }}</span>
          }
          @if (submitError()) {
            <span class="submit-feedback error"><i class="pi pi-times"></i> {{ submitError() }}</span>
          }
        </div>
      </form>
    </div>
  `,
})
export class AbsenceRequestComponent implements OnInit {
  protected readonly store = inject(AbsencesStore) as unknown as AbsencesStore;
  private  readonly auth  = inject(AuthStore) as unknown as AuthStore;
  private  readonly fb    = inject(FormBuilder);
  readonly lang            = inject(LanguageService);

  protected readonly isAdminOrManager = computed(() =>
    ['ADMIN', 'MANAGER'].includes(this.auth.role() ?? ''),
  );

  protected readonly pendingAbsences = computed(() =>
    this.store.absences().filter(a => a.status === 'PENDING'),
  );

  protected readonly nonPendingAbsences = computed(() =>
    this.store.absences().filter(a => a.status !== 'PENDING'),
  );

  protected readonly processingId = signal<string | null>(null);

  // Decision flow signals
  protected readonly decisionTargetId = signal<string | null>(null);
  protected readonly decisionAction   = signal<'approve' | 'reject'>('approve');
  protected readonly decisionComment  = signal('');

  protected readonly absenceTypes = ABSENCE_TYPES;
  protected readonly submitError = signal<string | null>(null);
  protected readonly submitSuccess = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    type: ['VACACIONES' as AbsenceType, Validators.required],
    startDate: ['', Validators.required],
    endDate: ['', Validators.required],
    cause: [''],
  });

  ngOnInit(): void {
    if (this.isAdminOrManager()) {
      void this.store.loadAbsences();
    } else {
      void this.store.loadAbsences();
    }
  }

  get f() {
    return this.form.controls;
  }

  protected isItType(): boolean {
    return this.form.getRawValue().type === 'IT';
  }

  protected statusSeverity(status: AbsenceDto['status']): TagSeverity {
    return STATUS_SEVERITY[status] ?? 'secondary';
  }

  protected openDecision(id: string, action: 'approve' | 'reject'): void {
    this.decisionTargetId.set(id);
    this.decisionAction.set(action);
    this.decisionComment.set('');
  }

  protected cancelDecision(): void {
    this.decisionTargetId.set(null);
    this.decisionComment.set('');
  }

  protected async confirmDecision(id: string): Promise<void> {
    this.processingId.set(id);
    const comment = this.decisionComment().trim() || undefined;
    if (this.decisionAction() === 'approve') {
      await this.store.approveAbsence(id, comment);
    } else {
      await this.store.rejectAbsence(id, comment);
    }
    this.processingId.set(null);
    this.cancelDecision();
  }

  protected async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitError.set(null);
    this.submitSuccess.set(false);

    const { type, startDate, endDate, cause } = this.form.getRawValue();

    try {
      await this.store.createAbsence({
        type,
        startDate,
        endDate,
        ...(type === 'IT' && cause ? { cause } : {}),
      });
      this.submitSuccess.set(true);
      this.form.reset({ type: 'VACACIONES', startDate: '', endDate: '', cause: '' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to submit absence request';
      this.submitError.set(message);
    }
  }
}
