import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderEmail } from './render.js';
import EmailLayout from './EmailLayout.js';

// Test 1: renderEmail returns a non-empty HTML string
test('renderEmail returns a non-empty HTML string', async () => {
  const element = React.createElement(
    EmailLayout,
    { unsubscribeUrl: 'https://example.com/unsub' },
    React.createElement('p', null, 'test content'),
  );
  const html = await renderEmail(element);
  assert.ok(typeof html === 'string', 'should return a string');
  assert.ok(html.length > 0, 'should return non-empty string');
  assert.ok(html.includes('<!DOCTYPE') || html.includes('<html'), 'should contain valid HTML structure');
});

// Test 2: HTML contains the rendered children
test('renderEmail HTML contains the rendered children', async () => {
  const uniqueContent = 'hello-unique-content-xyz';
  const element = React.createElement(
    EmailLayout,
    { unsubscribeUrl: 'https://example.com/unsub' },
    React.createElement('p', null, uniqueContent),
  );
  const html = await renderEmail(element);
  assert.ok(html.includes(uniqueContent), `HTML should contain child text "${uniqueContent}"`);
});

// Test 3: Footer contains the unsubscribe URL
test('renderEmail footer contains the unsubscribe URL', async () => {
  const unsubUrl = 'https://align.sovereignty.app/unsubscribe?token=abc123';
  const element = React.createElement(
    EmailLayout,
    { unsubscribeUrl: unsubUrl },
    React.createElement('p', null, 'body content'),
  );
  const html = await renderEmail(element);
  assert.ok(html.includes(unsubUrl), `HTML should contain unsubscribe URL "${unsubUrl}"`);
});

// Test 4: Footer contains the "opted into this" copy
test('renderEmail footer contains the opted-in copy', async () => {
  const element = React.createElement(
    EmailLayout,
    { unsubscribeUrl: 'https://example.com/unsub' },
    React.createElement('p', null, 'body content'),
  );
  const html = await renderEmail(element);
  assert.ok(
    html.includes('You opted into this by completing the Alignment Diagnostic at align.sovereignty.app/start.'),
    'HTML footer should contain opt-in copy',
  );
});
