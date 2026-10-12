import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { hashPassword } from '../lib/auth.js';
// Do not accept passwords as shell arguments or echo them to the terminal.
let muted = false;
const output = new Writable({write(chunk, encoding, callback) { if (!muted) process.stdout.write(chunk); callback(); }});
const rl = createInterface({input:process.stdin, output, terminal:true});
process.stdout.write('New admin password (12+ characters, input hidden): ');
muted = true;
try {
  const password = await rl.question('');
  process.stdout.write('\nConfirm password: ');
  const confirm = await rl.question('');
  if (password.length < 12 || password.length > 200 || password !== confirm) throw new Error('Passwords must match and contain 12–200 characters.');
  process.stdout.write(`\nADMIN_PASSWORD_HASH=${await hashPassword(password)}\n`);
} finally { rl.close(); }
