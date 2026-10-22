// SPDX-License-Identifier: GPL-3.0-or-later
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {LIMITS, attachmentIds, parseHistory, serializeHistory} from './core.js';
import {asyncCall, atomicWrite, ensureDirectory, readFile, removeFile} from './io.js';

export class HistoryStore {
    constructor(cancellable, root = null) {
        this.cancellable = cancellable;
        this.root = root ?? Gio.File.new_for_path(GLib.build_filenamev([GLib.get_user_data_dir(), 'ai-pop-down-extension']));
        this.images = this.root.get_child('images');
        this.index = this.root.get_child('history.json');
        this.queue = Promise.resolve();
        this.readOnly = false;
        this.reserved = new Set();
    }

    async load() {
        await ensureDirectory(this.root, this.cancellable);
        await ensureDirectory(this.images, this.cancellable);
        try {
            const bytes = await readFile(this.index, LIMITS.history, this.cancellable);
            try {
                return parseHistory(new TextDecoder('utf-8', {fatal: true}).decode(bytes));
            } catch {
                // Preserve evidence instead of overwriting a damaged or newer-format index.
                this.readOnly = true;
                throw new Error('History is corrupt or from an unsupported version. It has been preserved. Use Delete all history to reset it.');
            }
        } catch (error) {
            if (error.matches?.(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND))
                return [];
            throw error;
        }
    }

    imageFile(id) {
        if (!/^[a-f0-9-]{36}\.jpg$/.test(id))
            throw new Error('Invalid attachment identity.');
        return this.images.get_child(id);
    }

    async entries() {
        const enumerator = await asyncCall(this.images, 'enumerate_children_async', 'enumerate_children_finish', [
            'standard::name,standard::size,standard::type', Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, GLib.PRIORITY_DEFAULT, this.cancellable,
        ]);
        const entries = [];
        try {
            while (true) {
                const batch = await asyncCall(enumerator, 'next_files_async', 'next_files_finish', [100, GLib.PRIORITY_DEFAULT, this.cancellable]);
                if (!batch.length)
                    break;
                entries.push(...batch);
                if (entries.length > 2000)
                    throw new Error('Attachment directory exceeds 2,000 files. Inspect local storage.');
            }
        } finally {
            await asyncCall(enumerator, 'close_async', 'close_finish', [GLib.PRIORITY_DEFAULT, null]);
        }
        return entries;
    }

    async addImage(bytes) {
        if (this.readOnly)
            throw new Error('Reset the damaged history before adding images.');
        const entries = await this.entries();
        if (entries.reduce((sum, info) => sum + info.get_size(), 0) + bytes.length > LIMITS.attachmentStorage)
            throw new Error('Attachments reached the 128 MiB storage limit. Delete older conversations.');
        const id = `${GLib.uuid_string_random()}.jpg`;
        this.reserved.add(id);
        await atomicWrite(this.imageFile(id), bytes, this.cancellable);
        return id;
    }

    save(conversations, drafts = []) {
        if (this.readOnly)
            return Promise.reject(new Error('History is preserved read-only until reset.'));
        // Snapshot before queueing so later UI mutations cannot change this transaction.
        const text = serializeHistory(conversations);
        const retained = new Set([...attachmentIds(conversations), ...drafts]);
        const work = async () => {
            await atomicWrite(this.index, new TextEncoder().encode(text), this.cancellable);
            await this.collect(retained);
        };
        this.queue = this.queue.catch(() => {}).then(work);
        return this.queue;
    }

    async collect(retained) {
        for (const info of await this.entries()) {
            const name = info.get_name();
            if (/^[a-f0-9-]{36}\.jpg$/.test(name) && !retained.has(name) && !this.reserved.has(name))
                await removeFile(this.images.get_child(name), this.cancellable);
        }
    }

    async reset() {
        this.readOnly = false;
        await this.save([]);
    }
}
