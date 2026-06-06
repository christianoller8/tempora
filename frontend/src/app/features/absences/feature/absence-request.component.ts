import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { AbsencesStore } from '../data-access/absences.store';
import type { AbsenceDto, AbsenceType } from '../data-access/absences.api';
import { AuthStore } from '../../../core/auth/auth.store';

const ABSENCE_TYPE_LABELS: Record<AbsenceType, string> = {
  VACACIONES: 'Vacaciones',
  IT: 'Incapacidad Temporal (IT)',
  PERMISO_RETRIBUIDO: 'Permiso Retribuido',
  AUSENCIA_INJUSTIFICADA: 'Ausencia Injustificada',
  LACTANCIA: 'Lactancia',
  REDUCCION_JORNADA: 'Reducción de Jornada',
  ASUNTOS_PROPIOS: 'Asuntos Propios',
  PERMISO_NO_RETRIBUIDO: 'Permiso No Retribuido',
  MATERNIDAD_PATERNIDAD: 'Maternidad / Paternidad',
};

const ABSENCE_TYPES = Object.keys(ABSENCE_TYPE_LABELS) as AbsenceType[];

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
  imports: [ReactiveFormsModule, DatePipe, ButtonModule, TagModule, SkeletonModule],
  styles: [`
    :host { display: block; max-width: 860px; margin: 0 auto; }

    .page-header { margin-bottom: 1.75rem; }
    .page-title  { font-size: 1.375rem; font-weight: 700; color: var(--p-text-color); }
    .page-sub    { font-size: 0.8125rem; color: var(--p-text-color-muted, var(--p-text-color-secondary)); margin-top: 0.125rem; }

    .section-title {
      font-size: 0.9375rem; font-weight: 700; color: var(--p-text-color);
      display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.875rem; margin-top: 1.5rem;
    }
    .section-title .pi { color: var(--p-primary-color); font-size: 0.9rem; }
    .section-title:first-child { margin-top: 0; }

    .abs-panel {
      background: var(--p-surface-card);
      border: 1px solid var(--p-surface-border);
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 1.5rem;
    }

    .abs-header-row, .abs-row {
      display: grid;
      grid-template-columns: 2fr 1.5fr 1.5fr 1fr auto;
      align-items: center;
      gap: 0.5rem;
      padding: 0.625rem 1.25rem;
      border-bottom: 1px solid var(--p-surface-border);
    }

    .abs-header-row {
      background: var(--p-surface-section);
      padding: 0.5rem 1.25rem 0.375rem;
    }

    .abs-row:last-child { border-bottom: none; }
    .abs-row:hover { background: color-mix(in srgb, var(--p-primary-color) 4%, transparent); }

    .abs-col-label {
      font-size: 0.6875rem; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.07em; color: var(--p-text-color-muted, var(--p-text-color-secondary));
    }

    .abs-type  { font-size: 0.875rem; font-weight: 600; color: var(--p-text-color); }
    .abs-dates { font-size: 0.8125rem; color: var(--p-text-color-muted, var(--p-text-color-secondary)); font-variant-numeric: tabular-nums; }
    .abs-actions { display: flex; gap: 0.375rem; }

    .empty-state {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 0.5rem; padding: 2.5rem 1rem;
      color: var(--p-text-color-muted, var(--p-text-color-secondary)); font-size: 0.8125rem;
    }
    .empty-state .pi { font-size: 1.75rem; opacity: 0.35; }

    /* ── Request form ─────────────────────────────────────────────── */
    .form-panel {
      background: var(--p-surface-card);
      border: 1px solid var(--p-surface-border);
      border-radius: 12px;
      padding: 1.5rem;
    }

    .field { margin-bottom: 1rem; }
    .field label { display: block; font-size: 0.8125rem; font-weight: 600; margin-bottom: 0.375rem; color: var(--p-text-color); }

    .field select, .field input[type="date"] {
      width: 100%; height: 38px; padding: 0 0.75rem;
      background: var(--p-surface-section); border: 1px solid var(--p-surface-border);
      border-radius: 8px; color: var(--p-text-color); font-size: 0.875rem;
      outline: none; appearance: auto;
    }
    .field select:focus, .field input:focus { border-color: var(--p-primary-color); }

    .field textarea {
      width: 100%; padding: 0.625rem 0.75rem;
      background: var(--p-surface-section); border: 1px solid var(--p-surface-border);
      border-radius: 8px; color: var(--p-text-color); font-size: 0.875rem;
      outline: none; resize: vertical;
    }

    .field .error { font-size: 0.75rem; color: var(--p-red-400, #f87171); margin-top: 0.25rem; display: block; }
    .field .hint  { font-size: 0.75rem; color: var(--p-text-color-muted, var(--p-text-color-secondary)); margin-top: 0.25rem; }

    .form-actions { display: flex; align-items: center; gap: 0.875rem; flex-wrap: wrap; margin-top: 1.25rem; }
    .submit-feedback { font-size: 0.8125rem; }
    .submit-feedback.success { color: #22c55e; }
    .submit-feedback.error   { color: var(--p-red-400, #f87171); }

    .decision-form {
      margin-top: 0.625rem;
      padding-top: 0.625rem;
      border-top: 1px solid var(--p-surface-border);
    }
    .decision-form label {
      display: block;
      font-size: 0.75rem;
      font-weight: 600;
      margin-bottom: 0.25rem;
      color: var(--p-text-color-muted, var(--p-text-color-secondary));
    }
    .decision-form textarea {
      width: 100%;
      padding: 0.5rem 0.625rem;
      background: var(--p-surface-section);
      border: 1px solid var(--p-surface-border);
      border-radius: 6px;
      color: var(--p-text-color);
      font-size: 0.8125rem;
      outline: none;
      resize: vertical;
      margin-bottom: 0.5rem;
    }
    .decision-form textarea:focus { border-color: var(--p-primary-color); }
    .decision-form .decision-actions { display: flex; gap: 0.375rem; }

    .decision-comment {
      display: flex;
      align-items: flex-start;
      gap: 0.375rem;
      margin-top: 0.375rem;
      font-size: 0.75rem;
      color: var(--p-text-color-muted, var(--p-text-color-secondary));
      font-style: italic;
    }
    .decision-comment .pi { margin-top: 2px; flex-shrink: 0; }

    .abs-row-wrap {
      border-bottom: 1px solid var(--p-surface-border);
    }
    .abs-row-wrap:last-child { border-bottom: none; }
    .abs-row-wrap .abs-row { border-bottom: none; }
  `],
  template: `
    <!-- ── Page header ─────────────────────────────────────────────── -->
    <div class="page-header">
      <div class="page-title">{{ isAdminOrManager() ? 'Absences' : 'My Absences' }}</div>
      <div class="page-sub">{{ isAdminOrManager() ? 'Manage absence requests and approval queue' : 'Your absence history and new requests' }}</div>
    </div>

    <!-- ── ADMIN / MANAGER VIEW ────────────────────────────────────── -->
    @if (isAdminOrManager()) {

      <!-- Pending approval queue -->
      <div class="section-title"><i class="pi pi-inbox"></i>Pending Requests</div>
      <div class="abs-panel">
        @if (store.loading() && pendingAbsences().length === 0) {
          <div style="padding:1rem; display:flex; flex-direction:column; gap:0.5rem;">
            @for (_ of [1,2]; track $index) { <p-skeleton height="2.5rem" borderRadius="6px" /> }
          </div>
        } @else if (pendingAbsences().length === 0) {
          <div class="empty-state">
            <i class="pi pi-check-circle"></i>
            <span>No pending requests — all clear!</span>
          </div>
        } @else {
          <div class="abs-header-row">
            <span class="abs-col-label">Type</span>
            <span class="abs-col-label">From</span>
            <span class="abs-col-label">To</span>
            <span class="abs-col-label">Status</span>
            <span class="abs-col-label">Actions</span>
          </div>
          @for (abs of pendingAbsences(); track abs.id) {
            <div class="abs-row-wrap">
              <div class="abs-row">
                <span class="abs-type">{{ typeLabels[abs.type] }}</span>
                <span class="abs-dates">{{ abs.startDate | date:'d MMM y' }}</span>
                <span class="abs-dates">{{ abs.endDate | date:'d MMM y' }}</span>
                <p-tag [value]="abs.status" [severity]="statusSeverity(abs.status)" [rounded]="true" [style]="{ fontSize: '0.7rem' }" />
                <div class="abs-actions">
                  <p-button icon="pi pi-check" severity="success" size="small"
                    pTooltip="Approve" [loading]="processingId() === abs.id" [disabled]="processingId() !== null"
                    (onClick)="openDecision(abs.id, 'approve')" />
                  <p-button icon="pi pi-times" severity="danger" size="small"
                    pTooltip="Reject" [loading]="processingId() === abs.id" [disabled]="processingId() !== null"
                    (onClick)="openDecision(abs.id, 'reject')" />
                </div>
              </div>
              @if (decisionTargetId() === abs.id) {
                <div class="decision-form" style="padding: 0.625rem 1.25rem 0.75rem;">
                  <label [for]="'decision-comment-' + abs.id">Comentario (opcional)</label>
                  <textarea
                    [id]="'decision-comment-' + abs.id"
                    [attr.aria-label]="'Comentario para la decisión de ' + typeLabels[abs.type]"
                    rows="2"
                    [value]="decisionComment()"
                    (input)="decisionComment.set($any($event.target).value)"
                    placeholder="Motivo o nota para el empleado (máx. 500 caracteres)"
                    maxlength="500"
                  ></textarea>
                  <div class="decision-actions">
                    <p-button
                      [label]="decisionAction() === 'approve' ? 'Confirmar aprobación' : 'Confirmar rechazo'"
                      [icon]="decisionAction() === 'approve' ? 'pi pi-check' : 'pi pi-times'"
                      [severity]="decisionAction() === 'approve' ? 'success' : 'danger'"
                      size="small"
                      [loading]="processingId() === abs.id"
                      (onClick)="confirmDecision(abs.id)"
                    />
                    <p-button label="Cancelar" severity="secondary" [text]="true" size="small"
                      (onClick)="cancelDecision()" />
                  </div>
                </div>
              }
            </div>
          }
        }
      </div>

      <!-- All absences -->
      <div class="section-title"><i class="pi pi-list"></i>All Absences</div>
      <div class="abs-panel">
        @if (store.loading() && nonPendingAbsences().length === 0) {
          <div style="padding:1rem; display:flex; flex-direction:column; gap:0.5rem;">
            @for (_ of [1,2,3]; track $index) { <p-skeleton height="2.5rem" borderRadius="6px" /> }
          </div>
        } @else if (nonPendingAbsences().length === 0) {
          <div class="empty-state">
            <i class="pi pi-calendar-times"></i>
            <span>No processed absences yet</span>
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
                <span class="abs-type">{{ typeLabels[abs.type] }}</span>
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
      <div class="section-title"><i class="pi pi-list"></i>My Absence History</div>
      <div class="abs-panel">
        @if (store.loading() && store.absences().length === 0) {
          <div style="padding:1rem; display:flex; flex-direction:column; gap:0.5rem;">
            @for (_ of [1,2]; track $index) { <p-skeleton height="2.5rem" borderRadius="6px" /> }
          </div>
        } @else if (store.absences().length === 0) {
          <div class="empty-state">
            <i class="pi pi-calendar-times"></i>
            <span>No absence records yet</span>
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
                <span class="abs-type">{{ typeLabels[abs.type] }}</span>
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
    <div class="section-title"><i class="pi pi-plus-circle"></i>New Request</div>
    <div class="form-panel">
      <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate aria-label="Absence request form">

        <div class="field">
          <label for="type">Absence type <span aria-hidden="true">*</span></label>
          <select id="type" formControlName="type" aria-required="true">
            @for (type of absenceTypes; track type) {
              <option [value]="type">{{ typeLabels[type] }}</option>
            }
          </select>
          @if (f['type']?.invalid && f['type']?.touched) {
            <span class="error" role="alert">Please select an absence type.</span>
          }
        </div>

        <div class="field">
          <label for="startDate">Start date <span aria-hidden="true">*</span></label>
          <input id="startDate" type="date" formControlName="startDate" aria-required="true" />
          @if (f['startDate']?.invalid && f['startDate']?.touched) {
            <span class="error" role="alert">Start date is required.</span>
          }
        </div>

        <div class="field">
          <label for="endDate">End date <span aria-hidden="true">*</span></label>
          <input id="endDate" type="date" formControlName="endDate" aria-required="true" />
          @if (f['endDate']?.invalid && f['endDate']?.touched) {
            <span class="error" role="alert">End date is required.</span>
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
            label="Submit Request"
            icon="pi pi-send"
            [loading]="store.loading()"
            [disabled]="form.invalid"
          />
          @if (submitSuccess()) {
            <span class="submit-feedback success"><i class="pi pi-check"></i> Request submitted successfully.</span>
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
  protected readonly typeLabels = ABSENCE_TYPE_LABELS;
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
