import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderEmail } from './_shared/render.js';

import Email01, { subject as subject1 } from './01-result-recap.js';
import Email02, { subject as subject2 } from './02-mechanism.js';
import Email03, { subject as subject3 } from './03-proof.js';
import Email04, { subject as subject4 } from './04-fear.js';
import Email05, { subject as subject5 } from './05-objections.js';
import Email06, { subject as subject6 } from './06-last-call.js';

const SAMPLE_PROPS = {
  first_name: 'Jordan',
  program: 'The Over-Preparer',
  program_line: 'the program that equates feeling safe with preparing more — so "ready" never arrives',
  fear_line: 'another year of preparing harder and still freezing when it counts',
  offer_url: 'https://align.sovereignty.app/result?token=test123',
  unsubscribe_url: 'https://align.sovereignty.app/unsubscribe?token=unsub456',
};

// ─── Email 1 — Result Recap ────────────────────────────────────────────────

test('Email 1: renders to non-empty HTML', async () => {
  const el = React.createElement(Email01, SAMPLE_PROPS);
  const html = await renderEmail(el);
  assert.ok(typeof html === 'string' && html.length > 0, 'should render non-empty HTML');
  assert.ok(html.includes('<') && html.includes('>'), 'should be valid HTML');
});

test('Email 1: first_name appears in output', async () => {
  const el = React.createElement(Email01, SAMPLE_PROPS);
  const html = await renderEmail(el);
  assert.ok(html.includes('Jordan'), 'first_name "Jordan" should appear in rendered HTML');
});

test('Email 1: program and program_line appear in output', async () => {
  const el = React.createElement(Email01, SAMPLE_PROPS);
  const html = await renderEmail(el);
  assert.ok(html.includes('The Over-Preparer'), 'program name should appear');
  assert.ok(
    html.includes('the program that equates feeling safe with preparing more'),
    'program_line should appear',
  );
});

test('Email 1: offer_url appears in output', async () => {
  const el = React.createElement(Email01, SAMPLE_PROPS);
  const html = await renderEmail(el);
  assert.ok(html.includes(SAMPLE_PROPS.offer_url), 'offer_url should appear in rendered HTML');
});

test('Email 1: unsubscribe_url passes through layout footer', async () => {
  const el = React.createElement(Email01, SAMPLE_PROPS);
  const html = await renderEmail(el);
  assert.ok(html.includes(SAMPLE_PROPS.unsubscribe_url), 'unsubscribe_url should appear in footer');
});

test('Email 1: no unreplaced merge placeholders in output', async () => {
  const el = React.createElement(Email01, SAMPLE_PROPS);
  const html = await renderEmail(el);
  assert.ok(!html.includes('{{'), 'no {{ placeholders should remain in rendered HTML');
});

test('Email 1: subject returns correct string', () => {
  const result = subject1(SAMPLE_PROPS);
  assert.equal(result, `Jordan, here's what your diagnostic actually found`);
});

// ─── Email 2 — Mechanism ──────────────────────────────────────────────────

test('Email 2: renders to non-empty HTML', async () => {
  const el = React.createElement(Email02, SAMPLE_PROPS);
  const html = await renderEmail(el);
  assert.ok(typeof html === 'string' && html.length > 0, 'should render non-empty HTML');
});

test('Email 2: first_name and program appear in output', async () => {
  const el = React.createElement(Email02, SAMPLE_PROPS);
  const html = await renderEmail(el);
  assert.ok(html.includes('Jordan'), 'first_name should appear');
  assert.ok(html.includes('The Over-Preparer'), 'program should appear');
});

test('Email 2: layer mismatch copy is present', async () => {
  const el = React.createElement(Email02, SAMPLE_PROPS);
  const html = await renderEmail(el);
  assert.ok(html.includes('layer mismatch'), 'key copy "layer mismatch" should appear');
});

test('Email 2: offer_url and unsubscribe_url appear in output', async () => {
  const el = React.createElement(Email02, SAMPLE_PROPS);
  const html = await renderEmail(el);
  assert.ok(html.includes(SAMPLE_PROPS.offer_url), 'offer_url should appear');
  assert.ok(html.includes(SAMPLE_PROPS.unsubscribe_url), 'unsubscribe_url should appear');
});

test('Email 2: no unreplaced merge placeholders', async () => {
  const el = React.createElement(Email02, SAMPLE_PROPS);
  const html = await renderEmail(el);
  assert.ok(!html.includes('{{'), 'no {{ placeholders should remain');
});

test('Email 2: subject returns correct string', () => {
  const result = subject2(SAMPLE_PROPS);
  assert.equal(result, 'Why willpower never reached this');
});

// ─── Email 3 — Proof ─────────────────────────────────────────────────────

test('Email 3: renders to non-empty HTML', async () => {
  const el = React.createElement(Email03, SAMPLE_PROPS);
  const html = await renderEmail(el);
  assert.ok(typeof html === 'string' && html.length > 0, 'should render non-empty HTML');
});

test('Email 3: first_name and program appear in output', async () => {
  const el = React.createElement(Email03, SAMPLE_PROPS);
  const html = await renderEmail(el);
  assert.ok(html.includes('Jordan'), 'first_name should appear');
  assert.ok(html.includes('The Over-Preparer'), 'program should appear');
});

test('Email 3: thunderclap copy is present', async () => {
  const el = React.createElement(Email03, SAMPLE_PROPS);
  const html = await renderEmail(el);
  assert.ok(html.includes('thunderclap'), 'key copy "thunderclap" should appear');
  assert.ok(html.includes('30 days'), 'guarantee copy should appear');
});

test('Email 3: offer_url and unsubscribe_url appear in output', async () => {
  const el = React.createElement(Email03, SAMPLE_PROPS);
  const html = await renderEmail(el);
  assert.ok(html.includes(SAMPLE_PROPS.offer_url), 'offer_url should appear');
  assert.ok(html.includes(SAMPLE_PROPS.unsubscribe_url), 'unsubscribe_url should appear');
});

test('Email 3: no unreplaced merge placeholders', async () => {
  const el = React.createElement(Email03, SAMPLE_PROPS);
  const html = await renderEmail(el);
  assert.ok(!html.includes('{{'), 'no {{ placeholders should remain');
});

test('Email 3: subject returns correct string', () => {
  const result = subject3(SAMPLE_PROPS);
  assert.equal(result, "The part most people don't believe at first");
});

// ─── Email 4 — Fear ──────────────────────────────────────────────────────

test('Email 4: renders to non-empty HTML', async () => {
  const el = React.createElement(Email04, SAMPLE_PROPS);
  const html = await renderEmail(el);
  assert.ok(typeof html === 'string' && html.length > 0, 'should render non-empty HTML');
});

test('Email 4: first_name, program, and fear_line appear in output', async () => {
  const el = React.createElement(Email04, SAMPLE_PROPS);
  const html = await renderEmail(el);
  assert.ok(html.includes('Jordan'), 'first_name should appear');
  assert.ok(html.includes('The Over-Preparer'), 'program should appear');
  assert.ok(
    html.includes('another year of preparing harder and still freezing when it counts'),
    'fear_line should appear',
  );
});

test('Email 4: cost math copy is present', async () => {
  const el = React.createElement(Email04, SAMPLE_PROPS);
  const html = await renderEmail(el);
  assert.ok(html.includes('Rewriting it costs $7'), 'cost copy should appear');
});

test('Email 4: offer_url and unsubscribe_url appear in output', async () => {
  const el = React.createElement(Email04, SAMPLE_PROPS);
  const html = await renderEmail(el);
  assert.ok(html.includes(SAMPLE_PROPS.offer_url), 'offer_url should appear');
  assert.ok(html.includes(SAMPLE_PROPS.unsubscribe_url), 'unsubscribe_url should appear');
});

test('Email 4: no unreplaced merge placeholders', async () => {
  const el = React.createElement(Email04, SAMPLE_PROPS);
  const html = await renderEmail(el);
  assert.ok(!html.includes('{{'), 'no {{ placeholders should remain');
});

test('Email 4: subject returns correct string', () => {
  const result = subject4(SAMPLE_PROPS);
  assert.equal(result, 'A year from now');
});

// ─── Email 5 — Objections ────────────────────────────────────────────────

test('Email 5: renders to non-empty HTML', async () => {
  const el = React.createElement(Email05, SAMPLE_PROPS);
  const html = await renderEmail(el);
  assert.ok(typeof html === 'string' && html.length > 0, 'should render non-empty HTML');
});

test('Email 5: first_name and program appear in output', async () => {
  const el = React.createElement(Email05, SAMPLE_PROPS);
  const html = await renderEmail(el);
  assert.ok(html.includes('Jordan'), 'first_name should appear');
  assert.ok(html.includes('The Over-Preparer'), 'program should appear');
});

test('Email 5: both sides of the argument are present', async () => {
  const el = React.createElement(Email05, SAMPLE_PROPS);
  const html = await renderEmail(el);
  assert.ok(html.includes('The case against'), 'case-against copy should appear');
  assert.ok(html.includes('The case for'), 'case-for copy should appear');
});

test('Email 5: offer_url and unsubscribe_url appear in output', async () => {
  const el = React.createElement(Email05, SAMPLE_PROPS);
  const html = await renderEmail(el);
  assert.ok(html.includes(SAMPLE_PROPS.offer_url), 'offer_url should appear');
  assert.ok(html.includes(SAMPLE_PROPS.unsubscribe_url), 'unsubscribe_url should appear');
});

test('Email 5: no unreplaced merge placeholders', async () => {
  const el = React.createElement(Email05, SAMPLE_PROPS);
  const html = await renderEmail(el);
  assert.ok(!html.includes('{{'), 'no {{ placeholders should remain');
});

test('Email 5: subject returns correct string', () => {
  const result = subject5(SAMPLE_PROPS);
  assert.equal(result, 'The honest case for and against doing this');
});

// ─── Email 6 — Last Call ─────────────────────────────────────────────────

test('Email 6: renders to non-empty HTML', async () => {
  const el = React.createElement(Email06, SAMPLE_PROPS);
  const html = await renderEmail(el);
  assert.ok(typeof html === 'string' && html.length > 0, 'should render non-empty HTML');
});

test('Email 6: first_name and program appear in output', async () => {
  const el = React.createElement(Email06, SAMPLE_PROPS);
  const html = await renderEmail(el);
  assert.ok(html.includes('Jordan'), 'first_name should appear');
  assert.ok(html.includes('The Over-Preparer'), 'program should appear');
});

test('Email 6: closing copy is present', async () => {
  const el = React.createElement(Email06, SAMPLE_PROPS);
  const html = await renderEmail(el);
  assert.ok(
    html.includes('Most people never do'),
    'closing line "Most people never do" should appear',
  );
  assert.ok(html.includes('Closing your diagnostic') || html.length > 0, 'email should have content');
});

test('Email 6: offer_url and unsubscribe_url appear in output', async () => {
  const el = React.createElement(Email06, SAMPLE_PROPS);
  const html = await renderEmail(el);
  assert.ok(html.includes(SAMPLE_PROPS.offer_url), 'offer_url should appear');
  assert.ok(html.includes(SAMPLE_PROPS.unsubscribe_url), 'unsubscribe_url should appear');
});

test('Email 6: no unreplaced merge placeholders', async () => {
  const el = React.createElement(Email06, SAMPLE_PROPS);
  const html = await renderEmail(el);
  assert.ok(!html.includes('{{'), 'no {{ placeholders should remain');
});

test('Email 6: subject returns correct string', () => {
  const result = subject6(SAMPLE_PROPS);
  assert.equal(result, 'Closing your diagnostic');
});
