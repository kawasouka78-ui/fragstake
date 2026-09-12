const origin = new URL(process.argv[2] || 'https://fragstake-web-196964863678.europe-west1.run.app');
if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password)
  throw new Error('Provide an HTTP(S) site URL without credentials.');
const checks = await Promise.allSettled(['/api/live', '/api/payments'].map(async (path) => {
  const response = await fetch(new URL(path, origin), { signal: AbortSignal.timeout(10000), cache: 'no-store' });
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
  return { path, data: await response.json() };
}));
const blockers = [];
for (const check of checks) {
  if (check.status === 'rejected') { blockers.push(check.reason.message); continue; }
  const { path, data } = check.value;
  if (path === '/api/live') {
    if (!data.enabled || !data.online) blockers.push('Production multiplayer is not connected or is unavailable.');
    if (data.paidMatches !== true) blockers.push('Paid match entry and settlement are not enabled.');
  } else {
    if (data.enabled !== true || !data.provider) blockers.push('Deposits and withdrawals have no connected payment provider.');
  }
}
if (blockers.length) {
  console.error('NOT READY FOR CASH LAUNCH');
  for (const blocker of blockers) console.error(`- ${blocker}`);
  process.exitCode = 1;
} else {
  console.log('Service readiness checks passed. Complete authenticated multiplayer and money-cycle acceptance checks before launch.');
}
