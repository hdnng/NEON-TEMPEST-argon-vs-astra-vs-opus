/**
 * Generic zero-allocation Object Pool to eliminate GC pauses for particles, sparks, and popups.
 */

export class ObjectPool<T> {
  private items: T[] = [];
  private activeCount = 0;
  private factory: () => T;
  private resetFn: (item: T) => void;

  constructor(initialCapacity: number, factory: () => T, resetFn: (item: T) => void) {
    this.factory = factory;
    this.resetFn = resetFn;
    for (let i = 0; i < initialCapacity; i++) {
      this.items.push(this.factory());
    }
  }

  acquire(): T {
    if (this.activeCount >= this.items.length) {
      const item = this.factory();
      this.items.push(item);
    }
    const item = this.items[this.activeCount++];
    this.resetFn(item);
    return item;
  }

  releaseAt(index: number): void {
    if (index < 0 || index >= this.activeCount) return;
    this.activeCount--;
    const temp = this.items[index];
    this.items[index] = this.items[this.activeCount];
    this.items[this.activeCount] = temp;
  }

  clear(): void {
    this.activeCount = 0;
  }

  get count(): number {
    return this.activeCount;
  }

  getAt(index: number): T {
    return this.items[index];
  }
}
