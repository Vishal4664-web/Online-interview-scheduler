const test = require('node:test');
const assert = require('node:assert/strict');
const { overlaps } = require('../services/scheduling');
test('detects partial overlap', () => assert.equal(overlaps('2026-10-30T10:00:00Z','2026-10-30T11:00:00Z','2026-10-30T10:30:00Z','2026-10-30T11:30:00Z'), true));
test('allows back-to-back interviews', () => assert.equal(overlaps('2026-10-30T10:00:00Z','2026-10-30T11:00:00Z','2026-10-30T11:00:00Z','2026-10-30T12:00:00Z'), false));
test('detects overlap across different local dates when UTC instants overlap', () => assert.equal(overlaps('2026-10-30T20:00:00Z','2026-10-30T21:00:00Z','2026-10-30T20:30:00Z','2026-10-30T21:30:00Z'), true));
