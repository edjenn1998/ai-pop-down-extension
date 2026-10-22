// SPDX-License-Identifier: GPL-3.0-or-later
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup?version=3.0';
import {LIMITS, NdjsonParser, normalizeUrl} from './core.js';
import {asyncCall, closeStream, readBounded} from './io.js';

export class OllamaClient {
    constructor() {
        this.session = new Soup.Session({timeout: 0, user_agent: 'AI-Pop-Down/0.1'});
        this.operations = new Set();
        this.cache = new Map();
    }

    async request(base, path, body, cancellable, onRecord = null) {
        const message = Soup.Message.new(body ? 'POST' : 'GET', `${normalizeUrl(base)}${path}`);
        message.set_flags(Soup.MessageFlags.NO_REDIRECT);
        if (body) {
            const bytes = new TextEncoder().encode(JSON.stringify(body));
            if (bytes.length > LIMITS.request)
                throw new Error('Request exceeds 32 MiB. Start a new chat with fewer images.');
            message.set_request_body_from_bytes('application/json', new GLib.Bytes(bytes));
        }
        const operation = {cancellable, timer: 0, stream: null, timedOut: false};
        this.operations.add(operation);
        const timeout = seconds => {
            if (cancellable.is_cancelled())
                return;
            if (operation.timer)
                GLib.Source.remove(operation.timer);
            operation.timer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, seconds, () => {
                operation.timer = 0;
                operation.timedOut = true;
                cancellable.cancel();
                return GLib.SOURCE_REMOVE;
            });
        };
        // TCP/TLS establishment is bounded separately from model loading and inference.
        timeout(10);
        const signal = message.connect('network-event', (_message, event) => {
            if (event === Gio.SocketClientEvent.COMPLETE)
                timeout(onRecord ? 600 : 15);
        });
        // Reused connections need no socket event; starting-request also covers them.
        const started = message.connect('starting', () => timeout(onRecord ? 600 : 15));
        try {
            operation.stream = await asyncCall(this.session, 'send_async', 'send_finish', [message, GLib.PRIORITY_DEFAULT, cancellable]);
            const status = message.get_status();
            if (status !== 200) {
                const detail = new TextDecoder().decode(await readBounded(operation.stream, 8192, cancellable));
                let reason = '';
                try {
                    reason = String(JSON.parse(detail).error ?? '').slice(0, 300);
                } catch {
                    reason = 'Server returned a non-JSON error.';
                }
                const hint = status >= 300 && status < 400 ? 'Redirect refused. Set the final server origin explicitly.'
                    : [401, 403].includes(status) ? 'Authentication required. For cloud models, sign in on the Ollama server with ollama signin.'
                        : status === 404 ? 'Model or API unavailable. Refresh models and verify the server URL.'
                            : status === 400 ? 'Check model and image support.' : 'Check the Ollama server and cloud account/usage.';
                throw new Error(`HTTP ${status}: ${hint} ${reason}`);
            }
            if (!onRecord) {
                const data = await readBounded(operation.stream, 2 * 1024 * 1024, cancellable);
                try {
                    return JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(data));
                } catch {
                    throw new Error('Invalid JSON response from the Ollama server.');
                }
            }
            const parser = new NdjsonParser(onRecord);
            while (!parser.done) {
                const bytes = await asyncCall(operation.stream, 'read_bytes_async', 'read_bytes_finish', [16384, GLib.PRIORITY_DEFAULT, cancellable]);
                const chunk = bytes.get_data();
                if (!chunk.length)
                    break;
                parser.push(chunk);
            }
            parser.finish();
            return null;
        } catch (error) {
            if (operation.timedOut)
                throw new Error('Ollama timed out (10 seconds to connect; 15 seconds for discovery; 10 minutes for generation).');
            if (cancellable.is_cancelled())
                throw new Error('Request stopped.');
            throw new Error(`${error.message} If unreachable, check the address, Ollama service and LAN firewall. HTTPS requires a trusted certificate.`);
        } finally {
            message.disconnect(signal);
            message.disconnect(started);
            if (operation.timer)
                GLib.Source.remove(operation.timer);
            operation.timer = 0;
            await closeStream(operation.stream);
            this.operations.delete(operation);
        }
    }

    async models(base, cancellable, refresh = false) {
        const key = `${base}/tags`;
        const cached = this.cache.get(key);
        if (!refresh && cached && Date.now() - cached.time < 60000)
            return cached.value;
        const data = await this.request(base, '/api/tags', null, cancellable);
        if (!Array.isArray(data.models) || data.models.some(m => typeof m.name !== 'string'))
            throw new Error('Server returned an invalid model list.');
        const value = data.models.slice(0, 500);
        this.cache.set(key, {time: Date.now(), value});
        return value;
    }

    async modelInfo(base, model, cancellable, refresh = false) {
        const key = `${base}/${model}`;
        const cached = this.cache.get(key);
        if (!refresh && cached && Date.now() - cached.time < 60000)
            return cached.value;
        const value = await this.request(base, '/api/show', {model}, cancellable);
        this.cache.set(key, {time: Date.now(), value});
        return value;
    }

    destroy() {
        for (const op of this.operations) {
            op.cancellable.cancel();
            if (op.timer)
                GLib.Source.remove(op.timer);
            op.timer = 0;
        }
        this.session.abort();
        this.cache.clear();
    }
}
