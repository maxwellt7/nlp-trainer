import React from 'react';
import { Text, Button } from '@react-email/components';
import EmailLayout from './_shared/EmailLayout.js';
import { SUBJECT_LINES } from './data/subject-lines.js';
import { colors, fonts } from './_shared/tokens.js';

const pStyle = {
  color: colors.text,
  fontSize: '16px',
  lineHeight: '1.6',
  fontFamily: fonts.body,
  margin: '0 0 16px 0',
};

const ctaContainerStyle = {
  textAlign: 'center',
  marginTop: '24px',
};

const btnStyle = {
  backgroundColor: colors.gold,
  color: '#0a0a0f',
  fontFamily: fonts.body,
  fontSize: '16px',
  fontWeight: '700',
  padding: '14px 24px',
  borderRadius: '10px',
  textDecoration: 'none',
  display: 'inline-block',
};

export default function Email03Proof(props) {
  const {
    first_name,
    program,
    offer_url,
    unsubscribe_url,
  } = props;

  const previewText = 'No thunderclap — something smaller and stranger happens';

  const body = [
    React.createElement(Text, { key: 'greeting', style: pStyle }, `${first_name},`),

    React.createElement(
      Text,
      { key: 'p1', style: pStyle },
      React.createElement('span', null, "The most common reaction to Alignment Engine is quiet skepticism — and honestly, from a "),
      React.createElement('span', null, program),
      React.createElement('span', null, " mind, that's the correct reaction. You've tried things. You've been disappointed before."),
    ),

    React.createElement(
      Text,
      { key: 'p2', style: pStyle },
      "So I won't make you a dramatic promise. I'll tell you what's actually true.",
    ),

    React.createElement(
      Text,
      { key: 'p3', style: pStyle },
      "People don't report a thunderclap. They report something smaller and stranger: a moment that used to trigger the pattern just... goes differently. The hesitation doesn't arrive. The preparation spiral doesn't start. The ceiling thought shows up — and doesn't land. They usually notice it ",
      React.createElement('em', null, 'after'),
      " the fact, which is exactly how you'd expect unconscious change to feel.",
    ),

    React.createElement(
      Text,
      { key: 'p4', style: pStyle },
      "That's the bar. Not transformation theatre — one pattern, the one you've been stuck on, starting to run differently. If that doesn't happen within 30 days, you email us and we refund every penny.",
    ),

    React.createElement(
      'div',
      { key: 'cta', style: ctaContainerStyle },
      React.createElement(
        Button,
        { href: offer_url, style: btnStyle },
        'Start with your pattern →',
      ),
    ),
  ];

  return React.createElement(
    EmailLayout,
    { unsubscribeUrl: unsubscribe_url, previewText },
    ...body,
  );
}

export function subject(props) {
  return SUBJECT_LINES[3](props);
}
