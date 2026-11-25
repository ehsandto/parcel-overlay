import assert from 'node:assert/strict';
import fs from 'node:fs';
import {abi, createAccount, createClient} from 'genlayer-js';
import {studionet} from 'genlayer-js/chains';
import {sha, jsonSafe, rpc, receipt, source, read} from './check.mjs';

const journal = 'PROOFS.json';
const code = 'contracts/ParcelOverlay.py';
const verifyOnly = process.argv.includes('--verify-only');
const resume = process.argv.includes('--resume');
const proof = fs.existsSync(journal)
  ? JSON.parse(fs.readFileSync(journal, 'utf8'))
  : {network: 'StudioNet', source_commit: process.env.SOURCE_COMMIT ?? process.env.GITHUB_SHA ?? null,
    transactions: [], maps: {}};
const save = () => fs.writeFileSync(journal, JSON.stringify(proof, null, 2) + '\n');
assert.match(proof.source_commit ?? '', /^[a-f0-9]{40}$/);
assert.equal(await rpc('eth_chainId', []), '0xf22f');
assert.equal(studionet.id, 61999);

// Persist acknowledged sends before an SDK error or process interruption.
const originalFetch = globalThis.fetch;
const sent = new Map();
let currentEntry;
globalThis.fetch = async (input, options) => {
  const url = String(input);
  const request = JSON.parse(options?.body ?? '{}');
  if (url !== 'https://studio.genlayer.com/api' || request.method !== 'eth_sendRawTransaction') {
    return originalFetch(input, options);
  }
  assert(currentEntry && !currentEntry.hash, 'Inspect the journal before another send');
  const payload = request.params[0];
  assert.match(payload, /^0x[a-f0-9]+$/i);
  if (!sent.has(payload)) {
    sent.set(payload, (async () => {
      const response = await originalFetch(input, options);
      const body = await response.text();
      const data = JSON.parse(body);
      if (data.result) {
        assert.match(data.result, /^0x[a-f0-9]{64}$/i);
        currentEntry.hash = data.result;
        save();
        console.log(currentEntry.step, data.result);
      }
      return {body, status: response.status};
    })());
  }
  const response = await sent.get(payload);
  return new Response(response.body, {status: response.status, headers: {'content-type': 'application/json'}});
};

async function transaction(step, account, functionName, args) {
  let entry = proof.transactions.find(tx => tx.step === step);
  if (!entry) {
    assert(!verifyOnly && account, 'Missing broadcast journal');
    const nonce = await rpc('eth_getTransactionCount', [account.address, 'latest']);
    assert.equal(await rpc('eth_getTransactionCount', [account.address, 'pending']), nonce);
    const {defaultFees: fees} = await rpc('sim_getFeeConfig', []);
    assert(fees?.distribution);
    const feeValue = BigInt(fees.feeValue);
    assert(feeValue >= 0n && feeValue <= 1_000_000_000_000_000n, 'Studio quote exceeds demo budget');
    assert(BigInt(await rpc('eth_getBalance', [account.address, 'latest'])) >= feeValue);
    entry = {step, signer: account.address, nonce, functionName, args, fee_wei: String(feeValue)};
    proof.transactions.push(entry);
    save();
    currentEntry = entry;
    const client = createClient({chain: studionet, account});
    const hash = functionName === 'deploy'
      ? await client.deployContract({code: fs.readFileSync(code), args: [], fees, leaderOnly: false})
      : await client.writeContract({
        address: proof.address, functionName, args, value: 0n, fees, leaderOnly: false,
      });
    assert.equal(hash, entry.hash);
    currentEntry = undefined;
  }
  assert.deepEqual(entry.args, args);
  assert.equal(entry.functionName, functionName);
  assert(entry.hash, 'Broadcast status unknown. Inspect the recorded nonce before resuming.');
  const {summary, tx, leader} = await receipt(entry.hash);
  entry.receipt = summary;
  save();
  assert.equal(summary.status, 'FINALIZED');
  assert.equal(summary.execution, 'SUCCESS');
  assert.equal(summary.consensus, 'MAJORITY_AGREE');
  assert.equal(summary.leader_only, false);
  assert(summary.initial_validators >= 3 && summary.agree_votes >= 2 && summary.validator_execution_seen);
  assert.equal(tx.from_address.toLowerCase(), entry.signer.toLowerCase());
  assert.equal(BigInt(tx.nonce), BigInt(entry.nonce));
  assert.equal(BigInt(tx.value), 0n);
  const envelope = await rpc('eth_getTransactionReceipt', [entry.hash]);
  assert.equal(envelope.status, '0x1');
  assert.equal(envelope.from.toLowerCase(), entry.signer.toLowerCase());
  console.log(step, entry.receipt.status, entry.receipt.execution);
  if (functionName === 'deploy') return {address: entry.receipt.address};
  const bytes = Buffer.from(leader.result, 'base64');
  assert.equal(bytes[0], 0);
  return {address: entry.receipt.address, result: jsonSafe(abi.calldata.decode(bytes.subarray(1)))};
}

assert(verifyOnly ? proof.verified : proof.transactions.length === 0 || resume,
  'Use a fresh journal, --resume for acknowledged sends, or --verify-only');
assert(proof.transactions.every(entry => entry.hash),
  'An attempted send has no acknowledged hash; inspect its signer and nonce before continuing');

async function fund() {
  const account = createAccount();
  const amount = 10_000_000_000_000_000;
  try {
    const response = await fetch('https://studio.genlayer.com/api', {
      method: 'POST', headers: {'content-type': 'application/json'},
      body: JSON.stringify({jsonrpc: '2.0', id: 1, method: 'sim_fundAccount', params: [account.address, amount]}),
      signal: AbortSignal.timeout(25000),
    });
    const result = await response.json();
    assert(response.ok && !result.error, 'Studio faucet rejected request');
  } catch {
    console.log('Checking balance after an unconfirmed faucet response');
  }
  const balance = BigInt(await rpc('eth_getBalance', [account.address, 'latest']));
  assert(balance >= BigInt(amount), 'Studio faucet did not credit the demo account');
  proof.test_faucets ??= [];
  proof.test_faucets.push({address: account.address, requested_wei: String(amount)});
  save();
  return account;
}

const cases = [
  {name: 'adopted', effects: ['CLOSED', 'OPEN', 'CONDITIONAL'], full: [24, 26, 30], gate: [10, 0, 2]},
  {name: 'withdrawn', effects: ['CLOSED', 'IGNORE', 'CONDITIONAL'], full: [14, 36, 30], gate: [0, 10, 2]},
];
const completedSteps = new Set(proof.transactions.map(entry => entry.step));
const account = verifyOnly || ['deploy', ...cases.map(test => test.name)]
  .every(step => completedSteps.has(step)) ? null : await fund();

const deployment = await transaction('deploy', account, 'deploy', []);
proof.address = deployment.address;
proof.source = await source(proof.address);
save();

const expectedArea = (counts, inside) => ({
  inside, outside: 0, unresolved: 0,
  areas: Object.fromEntries(['OPEN', 'CLOSED', 'CONDITIONAL']
    .map((label, index) => [label, {certain: counts[index], possible: counts[index]}])),
});
for (const test of cases) {
  const body = fs.readFileSync('fixtures/' + test.name + '.json');
  const coordinate = 'ehsandto/parcel-overlay/' + proof.source_commit + '/fixtures/' + test.name + '.json';
  const commitment = sha(body);
  const {result: key} = await transaction(test.name, account, 'register_map', [coordinate, commitment]);
  assert.equal(key, commitment);

  const {tiles, ...evidence} = await read(proof.address, 'get_map', [key]);
  proof.maps[test.name] = {evidence, tiles};
  save();
  assert.deepEqual(evidence, {
    url: 'https://raw.githubusercontent.com/' + coordinate, sha256: key, text: body.toString('utf8'),
    document: JSON.parse(body), effects: test.effects,
  });

  const measurements = {};
  for (const [window, coords, expected] of [
    ['full', [0, 0, 10, 8], expectedArea(test.full, 80)],
    ['gate', [2, 1, 6, 4], expectedArea(test.gate, 12)],
  ]) {
    const actual = await read(proof.address, 'measure', [key, ...coords]);
    measurements[window] = actual;
    assert.deepEqual(actual, expected);
  }
  proof.maps[test.name].measurements = measurements;
  save();
}
proof.verified = true;
save();
console.log('Verified all receipts and four exact area measurements');
