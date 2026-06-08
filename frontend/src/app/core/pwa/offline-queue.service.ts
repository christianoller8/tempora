import { Injectable, computed, signal } from '@angular/core';

export interface ClockQueueItem {
  id: string;
  type: 'clock-in' | 'clock-out';
  timestamp: string;
  coords?: { lat: number; lng: number };
}

const STORAGE_KEY = 'tempora_offline_clock_queue';

@Injectable({ providedIn: 'root' })
export class OfflineQueueService {
  private readonly _queue = signal<ClockQueueItem[]>(this.readStorage());

  readonly queue = this._queue.asReadonly();
  readonly pendingCount = computed(() => this._queue().length);
  readonly hasPending = computed(() => this._queue().length > 0);

  enqueue(item: Omit<ClockQueueItem, 'id'>): void {
    const entry: ClockQueueItem = { id: crypto.randomUUID(), ...item };
    this._queue.update(q => {
      const next = [...q, entry];
      this.persist(next);
      return next;
    });
  }

  remove(id: string): void {
    this._queue.update(q => {
      const next = q.filter(a => a.id !== id);
      this.persist(next);
      return next;
    });
  }

  clearAll(): void {
    this._queue.set([]);
    this.persist([]);
  }

  private readStorage(): ClockQueueItem[] {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as ClockQueueItem[];
    } catch {
      return [];
    }
  }

  private persist(items: ClockQueueItem[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }
}
