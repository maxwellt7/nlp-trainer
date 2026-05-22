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

export default function Email04Fear(props) {
  const {
    first_name,
    program,
    fear_line,
    offer_url,
    unsubscribe_url,
  } = props;

  const previewText = 'The quiet worry — and the honest math of an unconscious pattern';

  const body = [
    React.createElement(Text, { key: 'greeting', style: pStyle }, `${first_name},`),

    React.createElement(
      Text,
      { key: 'p1', style: pStyle },
      React.createElement('span', null, "When you took the diagnostic, you told us the quiet worry — the one you don't say out loud. For your pattern, it tends to sound like this: "),
      React.createElement('span', null, fear_line),
      React.createElement('span', null, '.'),
    ),

    React.createElement(
      Text,
      { key: 'p2', style: pStyle },
      React.createElement('span', null, "I'm not going to dramatize that. I'm just going to ask you to be honest about one thing: nothing about the "),
      React.createElement('span', null, program),
      React.createElement('span', null, " pattern resolves itself with time. It's a program. Left alone, it runs. A year of it running looks a lot like the year behind you."),
    ),

    React.createElement(
      Text,
      { key: 'p3', style: pStyle },
      "That's not a threat — it's just the math of an unconscious pattern. The only variable is whether the program gets rewritten or keeps executing.",
    ),

    React.createElement(
      Text,
      { key: 'p4', style: pStyle },
      React.createElement('span', null, "Rewriting it costs $7 and an honest hour or two of listening. Leaving it costs another year of "),
      React.createElement('span', null, fear_line),
      React.createElement('span', null, '.'),
    ),

    React.createElement(
      'div',
      { key: 'cta', style: ctaContainerStyle },
      React.createElement(
        Button,
        { href: offer_url, style: btnStyle },
        'Close the gap →',
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
  return SUBJECT_LINES[4](props);
}
