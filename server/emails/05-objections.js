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

export default function Email05Objections(props) {
  const {
    first_name,
    program,
    offer_url,
    unsubscribe_url,
  } = props;

  const previewText = 'The honest case for and against — both sides argued fairly';

  const body = [
    React.createElement(Text, { key: 'greeting', style: pStyle }, `${first_name},`),

    React.createElement(
      Text,
      { key: 'p1', style: pStyle },
      React.createElement('span', null, "Let me argue both sides, because a "),
      React.createElement('span', null, program),
      React.createElement('span', null, " mind respects that more than a pitch."),
    ),

    React.createElement(
      Text,
      { key: 'p2', style: pStyle },
      React.createElement('strong', null, 'The case against:'),
      React.createElement('span', null, " you've spent money on personal development before and it didn't hold. $7 is small, but your skepticism isn't about the money — it's about the disappointment. Fair."),
    ),

    React.createElement(
      Text,
      { key: 'p3', style: pStyle },
      React.createElement('strong', null, 'The case for:'),
      React.createElement('span', null, " every previous thing worked on the wrong layer. This is the first one built specifically for the unconscious layer, and the first one personalized to the exact program your diagnostic identified — not a generic script. The downside is $7 and an hour. The upside is the one pattern that's been quietly costing you, running differently. And the 30-day guarantee means even the $7 isn't really at risk — only the pattern is."),
    ),

    React.createElement(
      Text,
      { key: 'p4', style: pStyle },
      React.createElement('span', null, "If the honest answer is still no, that's allowed. But make it a real decision, not the "),
      React.createElement('span', null, program),
      React.createElement('span', null, " program making it for you."),
    ),

    React.createElement(
      'div',
      { key: 'cta', style: ctaContainerStyle },
      React.createElement(
        Button,
        { href: offer_url, style: btnStyle },
        'Make the call →',
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
  return SUBJECT_LINES[5](props);
}
