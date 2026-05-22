import test from 'node:test';
import assert from 'node:assert/strict';
import { sendEmail, ResendRetryableError, ResendPermanentError } from './resend.js';

// Helper to create a mock Response object that matches Resend SDK expectations
function createMockResponse(status, body) {
  return {
    status,
    ok: status >= 200 && status < 300,
    statusText: `Status ${status}`,
    headers: new Map(),
    text: async () => JSON.stringify(body),
    json: async () => body,
    entries: function () {
      return this.headers.entries();
    },
  };
}

// Test 1: Happy path - successful email send returns { id }
test('sendEmail happy path - returns { id } on success', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => createMockResponse(200, { id: 'mock-email-id-123' });

  const originalEnv = process.env;
  process.env = {
    ...originalEnv,
    RESEND_API_KEY: 'test_key_123',
    RESEND_FROM_ADDRESS: 'noreply@example.com',
  };

  try {
    const result = await sendEmail({
      to: 'user@example.com',
      subject: 'Test Email',
      html: '<p>Hello</p>',
    });

    assert.deepEqual(result, { id: 'mock-email-id-123' });
  } finally {
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
  }
});

// Test 2: 429 Rate Limited - throws ResendRetryableError
test('sendEmail 429 rate limit - throws ResendRetryableError', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    createMockResponse(429, {
      name: 'rate_limit_exceeded',
      message: 'Too many requests',
      statusCode: 429,
    });

  const originalEnv = process.env;
  process.env = {
    ...originalEnv,
    RESEND_API_KEY: 'test_key_123',
    RESEND_FROM_ADDRESS: 'noreply@example.com',
  };

  try {
    await assert.rejects(
      async () => {
        await sendEmail({
          to: 'user@example.com',
          subject: 'Test',
          html: '<p>Test</p>',
        });
      },
      (err) => {
        assert.ok(err instanceof ResendRetryableError);
        assert.match(err.message, /429/);
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
  }
});

// Test 3: 503 Server Error - throws ResendRetryableError
test('sendEmail 503 server error - throws ResendRetryableError', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    createMockResponse(503, {
      name: 'internal_server_error',
      message: 'Service unavailable',
      statusCode: 503,
    });

  const originalEnv = process.env;
  process.env = {
    ...originalEnv,
    RESEND_API_KEY: 'test_key_123',
    RESEND_FROM_ADDRESS: 'noreply@example.com',
  };

  try {
    await assert.rejects(
      async () => {
        await sendEmail({
          to: 'user@example.com',
          subject: 'Test',
          html: '<p>Test</p>',
        });
      },
      (err) => {
        assert.ok(err instanceof ResendRetryableError);
        assert.match(err.message, /503/);
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
  }
});

// Test 4: 400 Bad Request - throws ResendPermanentError
test('sendEmail 400 bad request - throws ResendPermanentError', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    createMockResponse(400, {
      name: 'validation_error',
      message: 'Invalid email address',
      statusCode: 400,
    });

  const originalEnv = process.env;
  process.env = {
    ...originalEnv,
    RESEND_API_KEY: 'test_key_123',
    RESEND_FROM_ADDRESS: 'noreply@example.com',
  };

  try {
    await assert.rejects(
      async () => {
        await sendEmail({
          to: 'invalid-email',
          subject: 'Test',
          html: '<p>Test</p>',
        });
      },
      (err) => {
        assert.ok(err instanceof ResendPermanentError);
        assert.match(err.message, /400/);
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
  }
});

// Test 5: Missing RESEND_API_KEY - throws ResendPermanentError
test('sendEmail missing RESEND_API_KEY - throws ResendPermanentError', async () => {
  const originalEnv = process.env;
  process.env = {
    ...originalEnv,
    RESEND_API_KEY: undefined,
    RESEND_FROM_ADDRESS: 'noreply@example.com',
  };

  try {
    await assert.rejects(
      async () => {
        await sendEmail({
          to: 'user@example.com',
          subject: 'Test',
          html: '<p>Test</p>',
        });
      },
      (err) => {
        assert.ok(err instanceof ResendPermanentError);
        assert.match(err.message, /RESEND_API_KEY/);
        return true;
      },
    );
  } finally {
    process.env = originalEnv;
  }
});

// Test 6: Missing RESEND_FROM_ADDRESS - throws ResendPermanentError
test('sendEmail missing RESEND_FROM_ADDRESS - throws ResendPermanentError', async () => {
  const originalEnv = process.env;
  process.env = {
    ...originalEnv,
    RESEND_API_KEY: 'test_key_123',
    RESEND_FROM_ADDRESS: undefined,
  };

  try {
    await assert.rejects(
      async () => {
        await sendEmail({
          to: 'user@example.com',
          subject: 'Test',
          html: '<p>Test</p>',
        });
      },
      (err) => {
        assert.ok(err instanceof ResendPermanentError);
        assert.match(err.message, /RESEND_FROM_ADDRESS/);
        return true;
      },
    );
  } finally {
    process.env = originalEnv;
  }
});

// Test 7: Network error - throws ResendRetryableError
test('sendEmail network error - throws ResendRetryableError', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('Network timeout');
  };

  const originalEnv = process.env;
  process.env = {
    ...originalEnv,
    RESEND_API_KEY: 'test_key_123',
    RESEND_FROM_ADDRESS: 'noreply@example.com',
  };

  try {
    await assert.rejects(
      async () => {
        await sendEmail({
          to: 'user@example.com',
          subject: 'Test',
          html: '<p>Test</p>',
        });
      },
      (err) => {
        assert.ok(err instanceof ResendRetryableError);
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
  }
});

// Test 8: With idempotencyKey - verifies the Idempotency-Key HTTP header is actually sent
test('sendEmail with idempotencyKey - sends Idempotency-Key header to Resend', async () => {
  const originalFetch = globalThis.fetch;
  let capturedRequest = null;

  globalThis.fetch = async (url, init) => {
    capturedRequest = { url, init };
    return createMockResponse(200, { id: 'mock-id-with-idem' });
  };

  const originalEnv = process.env;
  process.env = {
    ...originalEnv,
    RESEND_API_KEY: 'test_key_123',
    RESEND_FROM_ADDRESS: 'noreply@example.com',
  };

  try {
    const result = await sendEmail({
      to: 'user@example.com',
      subject: 'Test with Idempotency',
      html: '<p>Test</p>',
      idempotencyKey: 'test-idempotency-key-123',
    });

    // Should return success
    assert.deepEqual(result, { id: 'mock-id-with-idem' });

    // Verify fetch was called
    assert.ok(capturedRequest !== null, 'fetch should have been called');

    // Verify the Idempotency-Key header was actually set on the request
    const headers = capturedRequest.init.headers;
    assert.ok(headers, 'fetch should have been called with headers');

    // Headers may be a Headers instance or a plain object — handle both
    const idempotencyValue =
      typeof headers.get === 'function'
        ? headers.get('Idempotency-Key')
        : headers['Idempotency-Key'];

    assert.equal(
      idempotencyValue,
      'test-idempotency-key-123',
      'Idempotency-Key header should be forwarded to Resend API',
    );
  } finally {
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
  }
});
