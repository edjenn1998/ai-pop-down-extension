// SPDX-License-Identifier: GPL-3.0-or-later
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup?version=3.0';
import {searchCredential} from './credentials.js';
import {asyncCall, closeStream, readBounded} from './io.js';
import {WEB, retrieveSources, searchHttpError, searchRequest} from './webCore.js';

export class WebSearchClient {
    constructor() {
        this.session = new Soup.Session({timeout: 0, user_agent: 'AI-Pop-Down-Web/0.2'});
        this.operations = new Set();
    }

    scope(parent, seconds) {
        const op = {cancel: new Gio.Cancellable(), timer: 0, timedOut: false, parent, signal: 0};
        op.signal = parent.connect(() => op.cancel.cancel());
        if (parent.is_cancelled())
            op.cancel.cancel();
        op.timer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, seconds, () => {
            op.timer = 0;
            op.timedOut = true;
            op.cancel.cancel();
            return GLib.SOURCE_REMOVE;
        });
        this.operations.add(op);
        return op;
    }

    finish(op) {
        if (op.signal)
            op.parent.disconnect(op.signal);
        op.signal = 0;
        if (op.timer)
            GLib.Source.remove(op.timer);
        op.timer = 0;
        this.operations.delete(op);
    }

    async request(kind, value, key, parent) {
        const plan = searchRequest(kind, value, key);
        const op = this.scope(parent, WEB.requestSeconds);
        const message = Soup.Message.new('POST', plan.url);
        message.set_flags(Soup.MessageFlags.NO_REDIRECT);
        message.get_request_headers().replace('Authorization', plan.headers.Authorization);
        message.set_request_body_from_bytes('application/json', new GLib.Bytes(new TextEncoder().encode(JSON.stringify(plan.body))));
        let stream;
        try {
            stream = await asyncCall(this.session, 'send_async', 'send_finish', [message, GLib.PRIORITY_DEFAULT, op.cancel]);
            const status = message.get_status();
            if (status !== 200) {
                const error = new Error(searchHttpError(status, message.get_response_headers().get_one('Retry-After') ?? ''));
                error.status = status;
                throw error;
            }
            const bytes = await readBounded(stream, plan.byteLimit, op.cancel);
            try {
                return JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes));
            } catch {
                throw new Error('Invalid JSON from Ollama hosted search.');
            }
        } catch (error) {
            if (op.timedOut)
                throw new Error('Ollama hosted search/fetch timed out after 15 seconds.');
            if (parent.is_cancelled())
                throw new Error('Web retrieval cancelled.');
            // Never display raw transport/server errors which could echo headers or a key.
            if (error.status || error.message.startsWith('Invalid JSON') || error.message.startsWith('Data exceeds'))
                throw error;
            throw new Error('Could not reach Ollama hosted search over trusted HTTPS. Check your network and account.');
        } finally {
            message.get_request_headers().remove('Authorization');
            this.finish(op);
            await closeStream(stream);
        }
    }

    async retrieve(query, parent, progress, fetchPages = true) {
        const overall = this.scope(parent, WEB.totalSeconds);
        let key = null;
        try {
            key = await searchCredential('lookup', overall.cancel);
            return await retrieveSources(query, (kind, value) => this.request(kind, value, key, overall.cancel), {
                check: () => {
                    if (parent.is_cancelled())
                        throw new Error('Web retrieval cancelled.');
                },
                expired: () => overall.cancel.is_cancelled(),
            }, progress, fetchPages);
        } catch (error) {
            if (overall.timedOut)
                throw new Error('Web retrieval exceeded its 45-second deadline. Retry explicitly or answer without web search.');
            throw error;
        } finally {
            key = null;
            this.finish(overall);
        }
    }

    destroy() {
        for (const op of this.operations) {
            op.cancel.cancel();
            if (op.timer)
                GLib.Source.remove(op.timer);
            op.timer = 0;
            if (op.signal)
                op.parent.disconnect(op.signal);
            op.signal = 0;
        }
        this.operations.clear();
        this.session.abort();
    }
}
