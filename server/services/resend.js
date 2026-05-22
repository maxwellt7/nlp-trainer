import { Resend } from 'resend';

// Error classes for retry logic
export class ResendRetryableError extends Error {
  constructor(message, statusCode = null) {
    super(message);
    this.name = 'ResendRetryableError';
    this.statusCode = statusCode;
  }
}

export class ResendPermanentError extends Error {
  constructor(message, statusCode = null) {
    super(message);
    this.name = 'ResendPermanentError';
    this.statusCode = statusCode;
  }
}

/**
 * Send an email using the Resend API.
 *
 * @param {Object} options
 * @param {string} options.to - recipient email
 * @param {string} options.subject - email subject
 * @param {string} options.html - already-rendered HTML
 * @param {Object} [options.headers] - optional custom headers (e.g. List-Unsubscribe)
 * @param {string} [options.idempotencyKey] - optional idempotency key for safe retries
 * @returns {Promise<{id: string}>} Returns Resend's email_id
 * @throws {ResendRetryableError} for 429, 5xx, or network errors
 * @throws {ResendPermanentError} for 400, 403, missing config, etc.
 */
export async function sendEmail({
  to,
  subject,
  html,
  headers,
  idempotencyKey,
}) {
  // Validate required environment variables
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new ResendPermanentError('RESEND_API_KEY not configured');
  }

  const fromAddress = process.env.RESEND_FROM_ADDRESS;
  if (!fromAddress) {
    throw new ResendPermanentError('RESEND_FROM_ADDRESS not configured');
  }

  // Initialize Resend client
  const resend = new Resend(apiKey);

  try {
    // Build the request options
    const requestOptions = {};
    if (idempotencyKey) {
      requestOptions.idempotencyKey = idempotencyKey;
    }

    // Send the email
    const response = await resend.emails.send(
      {
        from: fromAddress,
        to,
        subject,
        html,
        ...(headers && { headers }),
      },
      requestOptions,
    );

    // Check for errors in the response
    if (response.error) {
      const statusCode = response.error.statusCode;
      const message = response.error.message || 'Unknown Resend error';

      // Network errors have statusCode: null or undefined (caught by SDK)
      if (statusCode === null || statusCode === undefined) {
        throw new ResendRetryableError(`Network error: ${message}`);
      }

      // Map error codes to error types
      if (statusCode === 429) {
        throw new ResendRetryableError(`Rate limited (429): ${message}`, 429);
      }

      if (statusCode >= 500) {
        throw new ResendRetryableError(
          `Server error (${statusCode}): ${message}`,
          statusCode,
        );
      }

      // All other 4xx errors (400, 403, etc.) are permanent
      throw new ResendPermanentError(
        `Client error (${statusCode}): ${message}`,
        statusCode,
      );
    }

    // Success case
    if (response.data && response.data.id) {
      return { id: response.data.id };
    }

    // Unexpected response format
    throw new ResendPermanentError('Unexpected response format from Resend API');
  } catch (error) {
    // Handle network errors and other non-Resend errors
    if (error instanceof ResendRetryableError || error instanceof ResendPermanentError) {
      throw error;
    }

    // Network errors or timeouts are retryable
    if (
      error.name === 'AbortError' ||
      error.message.includes('timeout') ||
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('ETIMEDOUT')
    ) {
      throw new ResendRetryableError(
        `Network error: ${error.message}`,
      );
    }

    // Unknown error - treat as retryable to be safe
    throw new ResendRetryableError(
      `Unexpected error: ${error.message}`,
    );
  }
}
