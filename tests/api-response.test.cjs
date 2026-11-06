const test = require('node:test');
const assert = require('node:assert/strict');
const { isRecord, isPositiveInteger, isNonNegativeInteger, parsePage } = require('./helpers/api-response.cjs');

const failure = 'Invalid page';
const parseItem = value => {
  if (!isRecord(value) || !isPositiveInteger(value.id) || typeof value.code !== 'string') throw new Error(failure);
  return { id: value.id, code: value.code };
};
const parse = (data, page = 1) => parsePage(data, page, parseItem, [item => item.id, item => item.code], failure);
const data = () => ({ count: 3, results: [{ id: 1, code: 'first' }], next: 'https://untrusted.example/page' });

test('shared response guards reject arrays, null, numeric strings and unsafe counts', () => {
  for (const value of [null, undefined, [], 0, 'object', () => {}]) assert.equal(isRecord(value), false);
  assert.equal(isRecord({}), true);
  for (const value of [-1, 1.5, '1', NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(isPositiveInteger(value), false);
    assert.equal(isNonNegativeInteger(value), false);
  }
  assert.equal(isPositiveInteger(0), false);
  assert.equal(isNonNegativeInteger(0), true);
  assert.equal(isPositiveInteger(1), true);
});

test('pagination exposes only validated items and locally reconstructed page numbers', () => {
  const result = parse({ ...data(), results: [{ id: 1, code: 'first', privateField: 'discard' }] }, 2);
  assert.equal(result.nextPage, 3);
  assert.equal(result.count, 3);
  assert.deepEqual(result.items[0], { id: 1, code: 'first' });
  assert.equal(result.next, undefined);
  assert.equal(parse({ count: 0, results: [], next: null }).nextPage, null);
});

test('pagination rejects inconsistent counts, invalid next markers, and duplicate identities', () => {
  for (const invalid of [null, [], { ...data(), count: 0 }, { ...data(), count: '3' },
    { ...data(), next: '' }, { ...data(), next: false }, { ...data(), results: [] },
    { ...data(), results: [{ id: 1, code: 'a' }, { id: 1, code: 'b' }] },
    { ...data(), results: [{ id: 1, code: 'a' }, { id: 2, code: 'a' }] },
    { ...data(), results: [{ id: -1, code: 'bad' }] }]) {
    assert.throws(() => parse(invalid), { message: failure });
  }
  for (const page of [0, -1, 1.5, '1']) assert.throws(() => parse(data(), page), { message: failure });
});
