// Run only by CI after CloudFormation has deployed the webhook endpoint.
import { createHmac } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) throw new Error('TELEGRAM_BOT_TOKEN is required');
const stack = JSON.parse(execFileSync('aws', ['cloudformation', 'describe-stacks', '--stack-name', 'kittens-setlist', '--output', 'json'], { encoding: 'utf8' }));
const apiUrl = stack.Stacks[0].Outputs.find(output => output.OutputKey === 'ApiUrl')?.OutputValue;
if (!apiUrl || !apiUrl.startsWith('https://')) throw new Error('Deployed API URL is missing');
try {
  const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000),
    body: JSON.stringify({ url: `${apiUrl}/telegram/webhook`, secret_token: createHmac('sha256', token).update('kittens-setlist:telegram-webhook:v1').digest('hex'), allowed_updates: ['callback_query'], max_connections: 1 }),
  });
  const result = await response.json();
  if (!response.ok || result.ok !== true) throw new Error();
  console.log('Telegram callback webhook configured.');
} catch { throw new Error('Telegram webhook configuration failed'); }
