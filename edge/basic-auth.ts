// Lambda@Edge viewer-request — must be deployed to us-east-1
// Protects the CloudFront distribution with HTTP Basic Auth.
// Credentials are stored in the BASIC_AUTH env var as "user:password".
// NOTE: Lambda@Edge does not support env vars at viewer-request stage.
// Store credentials directly here or use a Secrets Manager call at origin-request.
// For simplicity (private band tool), hardcode or inject at deploy time via SAM.

import type { CloudFrontRequestEvent, CloudFrontRequestResult } from 'aws-lambda';

// Injected at deploy time by SAM (see template.yaml Environment.Variables)
const BASIC_AUTH = process.env.BASIC_AUTH ?? '';

export const handler = async (event: CloudFrontRequestEvent): Promise<CloudFrontRequestResult> => {
  const request = event.Records[0].cf.request;
  const headers = request.headers;

  const authHeader = headers.authorization?.[0]?.value ?? '';
  const expected = `Basic ${Buffer.from(BASIC_AUTH).toString('base64')}`;

  if (authHeader === expected) {
    return request;
  }

  return {
    status: '401',
    statusDescription: 'Unauthorized',
    headers: {
      'www-authenticate': [{ key: 'WWW-Authenticate', value: 'Basic realm="Kittens"' }],
      'content-type': [{ key: 'Content-Type', value: 'text/plain' }],
    },
    body: 'Unauthorized',
  };
};
