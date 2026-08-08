import test from 'node:test';
import assert from 'node:assert/strict';

test('Web Crypto está disponible en Node', () => {
  assert.equal(typeof crypto.getRandomValues, 'function');
  assert.equal(typeof crypto.subtle.digest, 'function');
});
