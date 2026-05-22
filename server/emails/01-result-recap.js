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

export default function Email01ResultRecap(props) {
  const {
    first_name,
    program,
    program_line,
    offer_url,
    unsubscribe_url,
  } = props;

  const previewText = 'Your diagnostic found something specific — read this';

  const body = [
    React.createElement(Text, { key: 'greeting', style: pStyle }, `${first_name},`),

    React.createElement(
      Text,
      { key: 'p1', style: pStyle },
      "You took the Alignment Diagnostic earlier, and I don't want the result to get lost in your inbox — because it was specific.",
    ),

    React.createElement(
      Text,
      { key: 'p2', style: pStyle },
      React.createElement('span', null, 'Your operating pattern is '),
      React.createElement('strong', null, program),
      React.createElement('span', null, `: ${program_line}.`),
    ),

    React.createElement(
      Text,
      { key: 'p3', style: pStyle },
      "Here's the part worth sitting with. That pattern isn't a discipline problem, and it isn't a character flaw. It's a program running on the unconscious layer of your mind — the layer that processes 11 million pieces of information a second, while your conscious mind handles about 50. By the time \"you\" show up to a high-stakes moment, the program has already filtered it.",
    ),

    React.createElement(
      Text,
      { key: 'p4', style: pStyle },
      "That's the whole reason knowing what to do and actually doing it have felt like two different people. It was never you. It was the code underneath.",
    ),

    React.createElement(
      Text,
      { key: 'p5', style: pStyle },
      "Tomorrow I'll show you what actually reaches that layer — and why nothing you've tried so far has. For now, just notice the pattern. Naming it is the first thing that's ever been true about it.",
    ),

    React.createElement(
      'div',
      { key: 'cta', style: ctaContainerStyle },
      React.createElement(
        Button,
        { href: offer_url, style: btnStyle },
        'Re-open my full result →',
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
  return SUBJECT_LINES[1](props);
}
