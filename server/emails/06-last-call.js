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

export default function Email06LastCall(props) {
  const {
    first_name,
    program,
    offer_url,
    unsubscribe_url,
  } = props;

  const previewText = 'Last email — your diagnostic stays open whenever you are ready';

  const body = [
    React.createElement(Text, { key: 'greeting', style: pStyle }, `${first_name},`),

    React.createElement(
      Text,
      { key: 'p1', style: pStyle },
      "This is the last email about your Alignment Diagnostic, so I'll keep it short.",
    ),

    React.createElement(
      Text,
      { key: 'p2', style: pStyle },
      React.createElement('span', null, "You know your pattern now — "),
      React.createElement('strong', null, program),
      React.createElement('span', null, ". You know which layer it runs on, and why the things you've tried haven't reached it. That knowledge doesn't expire. But knowledge was never the thing standing between you and the change. Knowing has never been your problem."),
    ),

    React.createElement(
      Text,
      { key: 'p3', style: pStyle },
      "Alignment Engine is $7, once, with a 30-day guarantee. Whenever you're ready to work on the layer that's actually running the show, it's here.",
    ),

    React.createElement(
      'div',
      { key: 'cta', style: ctaContainerStyle },
      React.createElement(
        Button,
        { href: offer_url, style: btnStyle },
        'Start now →',
      ),
    ),

    React.createElement(
      Text,
      { key: 'p4', style: pStyle },
      "Either way — I'm glad you saw the pattern. Most people never do.",
    ),
  ];

  return React.createElement(
    EmailLayout,
    { unsubscribeUrl: unsubscribe_url, previewText },
    ...body,
  );
}

export function subject(props) {
  return SUBJECT_LINES[6](props);
}
