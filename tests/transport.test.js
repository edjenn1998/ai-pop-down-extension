// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import {URL} from 'node:url';

const source = readFileSync(new URL('../lib/ollama.js', import.meta.url), 'utf8')
    .replace(/^import .*;\n/gm, '').replace('export class', 'class');
const Client = vm.runInNewContext(`${source}\nOllamaClient`, {
    Soup: {Session: class { abort() {} }}, Date,
});

test('cancelled discovery cannot repopulate a destroyed client cache', async () => {
    for (const method of ['models', 'modelInfo']) {
        const client = new Client();
        let complete;
        let cancelled = false;
        const cancel = {is_cancelled: () => cancelled};
        client.request = () => new Promise(resolve => { complete = resolve; });
        const pending = method === 'models'
            ? client.models('http://localhost:11434', cancel)
            : client.modelInfo('http://localhost:11434', 'test', cancel);
        cancelled = true;
        client.destroy();
        complete({models: [{name: 'test'}]});
        await assert.rejects(pending, /Request stopped/);
        assert.equal(client.cache.size, 0);
    }
});

test('model discovery cache is bounded across endpoint and model changes', () => {
    const client = new Client();
    for (let i = 0; i < 200; i++)
        client._cache(`model-${i}`, {capabilities: ['vision']});
    assert.equal(client.cache.size, 64);
    assert.equal(client.cache.has('model-0'), false);
    assert.equal(client.cache.has('model-199'), true);
    client.destroy();
    assert.equal(client.cache.size, 0);
});
