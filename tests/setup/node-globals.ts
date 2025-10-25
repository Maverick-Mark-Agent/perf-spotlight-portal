/**
 * Node.js test environment setup
 * Mocks browser globals like localStorage for testing
 */

// Mock localStorage for Node.js environment
class LocalStorageMock {
  private store: Record<string, string> = {};

  getItem(key: string): string | null {
    return this.store[key] || null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = value.toString();
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }

  get length(): number {
    return Object.keys(this.store).length;
  }

  key(index: number): string | null {
    const keys = Object.keys(this.store);
    return keys[index] || null;
  }
}

// @ts-ignore - Adding to global for Node.js environment
global.localStorage = new LocalStorageMock();

// Also mock sessionStorage if needed
// @ts-ignore
global.sessionStorage = new LocalStorageMock();

console.log('✓ Node.js test environment initialized with localStorage mock');
