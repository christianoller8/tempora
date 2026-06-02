import { TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { RulesetsComponent } from './rulesets.component';
import { ApiService } from '../../../core/http/api.service';
import { of } from 'rxjs';

const mockRuleSet = {
  id: 'rs-1',
  name: 'Convenio General',
  isDefault: true,
  minRestHours: 12,
  maxDailyHours: 9,
  maxAnnualOvertime: 80,
  weeklyRestDays: 1.5,
  params: {},
};

describe('RulesetsComponent', () => {
  let apiSpy: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    patch: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    apiSpy = {
      get: vi.fn().mockReturnValue(of({ data: [mockRuleSet] })),
      post: vi.fn().mockReturnValue(of({ data: mockRuleSet })),
      patch: vi.fn().mockReturnValue(of({ data: mockRuleSet })),
    };

    TestBed.configureTestingModule({
      imports: [RulesetsComponent],
      providers: [{ provide: ApiService, useValue: apiSpy }],
    });
  });

  it('creates the component', () => {
    const fixture = TestBed.createComponent(RulesetsComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('loads rule sets on init', async () => {
    const fixture = TestBed.createComponent(RulesetsComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(apiSpy.get).toHaveBeenCalledWith('/rule-sets');
  });

  it('renders existing rule sets', async () => {
    const fixture = TestBed.createComponent(RulesetsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const listItems = fixture.nativeElement.querySelectorAll('.ruleset-list li') as NodeList;
    expect(listItems.length).toBeGreaterThan(0);
  });

  it('renders the form fields', () => {
    const fixture = TestBed.createComponent(RulesetsComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#name')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('#minRestHours')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('#maxDailyHours')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('#maxAnnualOvertime')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('#weeklyRestDays')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('#params')).toBeTruthy();
  });

  it('calls POST when submitting a new rule set', async () => {
    const fixture = TestBed.createComponent(RulesetsComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance;
    component['form'].setValue({
      name: 'Test RuleSet',
      isDefault: false,
      minRestHours: 12,
      maxDailyHours: 9,
      maxAnnualOvertime: 80,
      weeklyRestDays: 1.5,
      params: '{}',
    });

    await component['onSubmit']();
    expect(apiSpy.post).toHaveBeenCalledWith(
      '/rule-sets',
      expect.objectContaining({ name: 'Test RuleSet' }),
    );
  });

  it('calls PATCH when updating an existing rule set', async () => {
    const fixture = TestBed.createComponent(RulesetsComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance;
    component['selectedId'].set('rs-1');
    component['form'].setValue({
      name: 'Updated',
      isDefault: true,
      minRestHours: 10,
      maxDailyHours: 9,
      maxAnnualOvertime: 80,
      weeklyRestDays: 1.5,
      params: '{}',
    });

    await component['onSubmit']();
    expect(apiSpy.patch).toHaveBeenCalledWith(
      '/rule-sets/rs-1',
      expect.objectContaining({ name: 'Updated' }),
    );
  });
});
