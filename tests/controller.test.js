// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {URL} from 'node:url';
import vm from 'node:vm';
import {attachmentIds, deleteConversation} from '../lib/core.js';

const source = readFileSync(new URL('../lib/chatController.js', import.meta.url), 'utf8')
    .replace(/^import .*;\n/gm, '').replace('export class', 'class');
const Controller = vm.runInNewContext(`${source}\nChatController`, {attachmentIds, deleteConversation});

function fixture() {
    let cancelled = false;
    const removed = {id: 'removed', messages: [{attachments: ['shared.jpg', 'removed.jpg']}]};
    const kept = {id: 'kept', messages: [{attachments: ['shared.jpg']}]};
    const cleared = [];
    let hidden = 0;
    const controller = Object.assign(Object.create(Controller.prototype), {
        ready: true,
        cancel: {is_cancelled: () => cancelled},
        current: removed,
        conversations: [removed, kept],
        drafts: new Map([['removed', {attachments: ['draft.jpg']}]]),
        store: {reserved: new Set(['shared.jpg', 'removed.jpg', 'draft.jpg', 'other-draft.jpg'])},
        view: {setRecovery: message => cleared.push(message), chooser: {hide() { hidden++; }}},
        chooser: 'history',
        makeChat() { this.current = {id: 'new', messages: []}; },
        async persist() {},
    });
    return {controller, removed, kept, cleared,
        cancel() { cancelled = true; controller.view = null; },
        get hidden() { return hidden; }};
}

test('removing a conversation releases its draft and recovery callbacks but keeps shared images referenced', async () => {
    const f = fixture();
    await f.controller.removeConversation(f.removed);
    assert.deepEqual(f.controller.conversations, [f.kept]);
    assert.deepEqual([...attachmentIds(f.controller.conversations)], ['shared.jpg']);
    assert.deepEqual([...f.controller.store.reserved], ['other-draft.jpg']);
    assert.equal(f.controller.drafts.has('removed'), false);
    assert.deepEqual(f.cleared, f.removed.messages);
    assert.equal(f.controller.current.id, 'new');
    assert.equal(f.controller.chooser, null);
    assert.equal(f.hidden, 1);
});

test('conversation deletion does not touch destroyed widgets when a pending save completes', async () => {
    const f = fixture();
    let finishSave;
    f.controller.persist = () => new Promise(resolve => { finishSave = resolve; });
    const pending = f.controller.removeConversation(f.removed);
    f.cancel();
    finishSave();
    await pending;
    assert.equal(f.hidden, 0);
});
