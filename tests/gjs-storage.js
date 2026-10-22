// SPDX-License-Identifier: GPL-3.0-or-later
// Integration tests: gjs -m tests/gjs-storage.js (no Shell, Ollama or desktop needed).
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {HistoryStore} from '../lib/storage.js';
import {atomicWrite, readFile, removeFile} from '../lib/io.js';
import {prepareImage} from '../lib/images.js';
import {imageHeader} from '../lib/core.js';

function assert(value, message) {
    if (!value)
        throw new Error(message);
}
async function main() {
    const root = Gio.File.new_for_path(GLib.dir_make_tmp('ai-pop-down-test-XXXXXX'));
    const cancel = new Gio.Cancellable();
    const store = new HistoryStore(cancel, root);
    try {
        assert((await store.load()).length === 0, 'Missing history should be empty');
        const png = GLib.base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=');
        const prepared = await prepareImage(png, cancel);
        assert(imageHeader(prepared).type === 'jpeg', 'Decode and re-encode actual image');
        const id = await store.addImage(prepared);
        store.reserved.clear();
        const c = {id: 'test', title: 'Test', connectionId: 'local', url: 'http://localhost:11434', model: 'm', updated: new Date().toISOString(),
            messages: [{role: 'user', content: 'image', attachments: [id], state: 'complete'}]};
        await store.save([c]);
        assert((await store.load())[0].messages[0].attachments[0] === id, 'History persists image identity');
        const info = await new Promise((resolve, reject) => store.index.query_info_async('unix::mode', 0, 0, cancel, (file, result) => {
            try {
                resolve(file.query_info_finish(result));
            } catch (error) {
                reject(error);
            }
        }));
        assert((info.get_attribute_uint32('unix::mode') & 0o777) === 0o600, 'Private atomic write permissions');
        await store.save([]);
        assert((await store.entries()).length === 0, 'Delete unreferenced attachments');
        await atomicWrite(store.index, new TextEncoder().encode('{broken'), cancel);
        let corrupt = false;
        try {
            await store.load();
        } catch {
            corrupt = true;
        }
        assert(corrupt && store.readOnly, 'Corrupt history must be preserved');
        assert(new TextDecoder().decode(await readFile(store.index, 100, cancel)) === '{broken', 'No corruption overwrite');
        await store.reset();
        assert((await store.load()).length === 0, 'Explicit reset recovers corruption');
        console.log('GJS storage/image integration tests passed.');
    } finally {
        store.reserved.clear();
        await store.collect(new Set());
        await removeFile(store.index, null).catch(() => {});
        await removeFile(store.images, null);
        await removeFile(root, null);
    }
}
// A module's top-level await keeps GJS's main context alive until completion.
// Use a GLib main loop instead to keep this test compatible with older linters.
const loop = new GLib.MainLoop(null, false);
let failure = null;
main().catch(error => { failure = error; }).finally(() => loop.quit());
loop.run();
if (failure)
    throw failure;
