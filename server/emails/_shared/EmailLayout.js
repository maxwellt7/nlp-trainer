import React from 'react';
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Link,
  Hr,
  Preview,
} from '@react-email/components';
import { colors, fonts } from './tokens.js';

const bodyStyle = {
  backgroundColor: colors.background,
  color: colors.text,
  fontFamily: fonts.body,
  margin: 0,
  padding: 0,
};

const containerStyle = {
  maxWidth: '600px',
  margin: '0 auto',
  padding: '24px',
};

const headerStyle = {
  borderBottom: `1px solid ${colors.gold}`,
  paddingBottom: '16px',
  marginBottom: '24px',
};

const logoStyle = {
  fontFamily: fonts.display,
  fontSize: '20px',
  fontWeight: '700',
  color: colors.gold,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  margin: 0,
};

const contentSectionStyle = {
  paddingBottom: '24px',
};

const hrStyle = {
  borderColor: colors.surface,
  borderTopWidth: '1px',
  margin: '24px 0',
};

const footerStyle = {
  paddingTop: '8px',
};

const footerTextStyle = {
  fontSize: '12px',
  color: colors.textFaint,
  margin: '0 0 8px 0',
  lineHeight: '1.5',
};

const footerLinkStyle = {
  fontSize: '12px',
  color: colors.textFaint,
  textDecoration: 'underline',
};

export default function EmailLayout({ children, unsubscribeUrl, previewText }) {
  return React.createElement(
    Html,
    null,
    React.createElement(Head, null),
    previewText ? React.createElement(Preview, null, previewText) : null,
    React.createElement(
      Body,
      { style: bodyStyle },
      React.createElement(
        Container,
        { style: containerStyle },
        React.createElement(
          Section,
          { style: headerStyle },
          React.createElement(Text, { style: logoStyle }, 'ALIGNMENT ENGINE'),
        ),
        React.createElement(Section, { style: contentSectionStyle }, children),
        React.createElement(Hr, { style: hrStyle }),
        React.createElement(
          Section,
          { style: footerStyle },
          React.createElement(
            Text,
            { style: footerTextStyle },
            'You opted into this by completing the Alignment Diagnostic at align.sovereignty.app/start.',
          ),
          React.createElement(
            Link,
            { href: unsubscribeUrl, style: footerLinkStyle },
            'Unsubscribe',
          ),
        ),
      ),
    ),
  );
}
