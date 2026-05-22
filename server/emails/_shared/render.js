import { render } from '@react-email/render';

/**
 * Renders a React Email element to an HTML string.
 * @react-email/render v2.x uses an async API (returns a Promise<string>).
 * @param {React.ReactElement} reactElement
 * @returns {Promise<string>} The rendered HTML string
 */
export async function renderEmail(reactElement) {
  return await render(reactElement);
}
