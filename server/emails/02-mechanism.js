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

export default function Email02Mechanism(props) {
  const {
    first_name,
    program,
    offer_url,
    unsubscribe_url,
  } = props;

  const previewText = 'Why willpower keeps reverting — the layer mismatch explained';

  const body = [
    React.createElement(Text, { key: 'greeting', style: pStyle }, `${first_name},`),

    React.createElement(
      Text,
      { key: 'p1', style: pStyle },
      "Quick question: how many times have you decided to fix this with discipline — and meant it — and watched it quietly come back anyway?",
    ),

    React.createElement(
      Text,
      { key: 'p2', style: pStyle },
      "That's not weakness. It's a layer mismatch.",
    ),

    React.createElement(
      Text,
      { key: 'p3', style: pStyle },
      React.createElement('span', null, "Willpower, journaling, affirmations, even years of insight — those all run on the conscious layer. The "),
      React.createElement('span', null, program),
      React.createElement('span', null, " pattern runs on the unconscious one. You've been upgrading the software while the operating system kept executing the old code. Of course it reverted. It was always going to."),
    ),

    React.createElement(
      Text,
      { key: 'p4', style: pStyle },
      "Here's the good news, and it's the reason I built Alignment Engine: a program that runs on the unconscious layer can be rewritten there. Two tools do it. The NLP Practice Engine lets you rehearse the new response in real time, because the unconscious learns from reps, not theory. The Personalized AI Hypnosis builds sessions from ",
      React.createElement('em', null, 'your'),
      " program specifically — the one your diagnostic named — and speaks to the layer it lives on while you simply listen.",
    ),

    React.createElement(
      Text,
      { key: 'p5', style: pStyle },
      "Full access to both is $7, once. That's not a typo, and tomorrow I'll tell you exactly why it's priced that way.",
    ),

    React.createElement(
      'div',
      { key: 'cta', style: ctaContainerStyle },
      React.createElement(
        Button,
        { href: offer_url, style: btnStyle },
        'See how it works →',
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
  return SUBJECT_LINES[2](props);
}
