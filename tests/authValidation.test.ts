import { describe, expect, it } from 'vitest';
import { safeInternalPath, validateNewPassword } from '@/lib/authValidation';

describe('authentication form validation', () => {
  it('accepts safe account-relative next paths', () => {
    expect(safeInternalPath('/orders?filter=active')).toBe('/orders?filter=active');
  });
  it('rejects external and protocol-relative redirects', () => {
    expect(safeInternalPath('//example.com')).toBe('/account');
    expect(safeInternalPath('https://example.com')).toBe('/account');
  });
  it('requires a letter, number and at least eight characters', () => {
    expect(validateNewPassword('short')).toBeTruthy();
    expect(validateNewPassword('longpassword')).toBeTruthy();
    expect(validateNewPassword('goodpass8')).toBeNull();
  });
});
