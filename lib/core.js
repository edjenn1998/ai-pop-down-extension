// SPDX-License-Identifier: GPL-3.0-or-later
// Pure logic shared with the development-only test harness.
export const LIMITS = Object.freeze({
    sourceImage: 10 * 1024 * 1024,
    imagePixels: 40 * 1000 * 1000,
    imageSide: 2048,
    images: 4,
    response: 128 * 1024,
    wire: 4 * 1024 * 1024,
    line: 256 * 1024,
    history: 8 * 1024 * 1024,
    conversations: 50,
    messages: 200,
    contextChars: 24000,
    contextMessages: 24,
    request: 32 * 1024 * 1024,
    attachmentStorage: 128 * 1024 * 1024,
});

export function normalizeUrl(input) {
    // Deliberately accept a server origin only: no ambiguous reverse-proxy paths.
    const match = /^(https?):\/\/(\[[0-9a-f:]+\]|[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?)(?::([0-9]{1,5}))?\/*$/i.exec(input.trim());
    if (!match || (match[3] && (+match[3] < 1 || +match[3] > 65535)))
        throw new Error('Use an HTTP or HTTPS server origin, without credentials, path, query or fragment.');
    const scheme = match[1].toLowerCase();
    const host = match[2];
    if (host.startsWith('[')) {
        const address = host.slice(1, -1);
        const compressed = address.includes('::');
        const groups = address.split(':').filter(Boolean);
        if ((address.match(/::/g) ?? []).length > 1 || groups.some(g => !/^[a-f0-9]{1,4}$/i.test(g)) ||
            (compressed ? groups.length >= 8 : groups.length !== 8) || /:::[\s\S]*/.test(address))
            throw new Error('Invalid IPv6 address.');
    } else if (host.length > 253 || host.split('.').some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label)) ||
        (/^[\d.]+$/.test(host) && (host.split('.').length !== 4 || host.split('.').some(n => +n > 255)))) {
        throw new Error('Invalid host name or IPv4 address.');
    }
    const port = match[3] ? Number(match[3]) : null;
    return `${scheme}://${match[2].toLowerCase()}${port && port !== (scheme === 'https' ? 443 : 80) ? `:${port}` : ''}`;
}

export function connectionsFromJson(text) {
    const list = JSON.parse(text);
    if (!Array.isArray(list) || list.length > 20)
        throw new Error('Invalid connection settings.');
    const ids = new Set();
    return list.map(c => {
        if (!c || typeof c.id !== 'string' || ids.has(c.id) || !c.id || typeof c.name !== 'string' || !c.name.trim())
            throw new Error('Each connection needs a unique identity and name.');
        ids.add(c.id);
        return {id: c.id, name: c.name.slice(0, 100), url: normalizeUrl(c.url), model: String(c.model ?? '').slice(0, 200)};
    });
}

export class NdjsonParser {
    constructor(onRecord, limits = LIMITS) {
        this.decoder = new TextDecoder('utf-8', {fatal: true});
        this.onRecord = onRecord;
        this.limits = limits;
        this.buffer = new Uint8Array(0);
        this.bytes = 0;
        this.done = false;
        this.cancelled = false;
    }

    push(bytes) {
        if (this.cancelled)
            throw new Error('Cancelled');
        this.bytes += bytes.length;
        if (this.bytes > this.limits.wire)
            throw new Error('Response exceeds the wire-size limit.');
        // GJS TextDecoder does not implement streaming. NDJSON newline bytes
        // cannot occur inside UTF-8 code points, so decode complete lines only.
        const combined = new Uint8Array(this.buffer.length + bytes.length);
        combined.set(this.buffer);
        combined.set(bytes, this.buffer.length);
        let start = 0;
        for (let end = 0; end < combined.length; end++) {
            if (combined[end] === 10) {
                this._record(combined.subarray(start, end));
                start = end + 1;
            }
        }
        this.buffer = combined.slice(start);
        if (this.buffer.length > this.limits.line)
            throw new Error('Streaming record is too large.');
    }

    _record(bytes) {
        if (bytes.length > this.limits.line)
            throw new Error('Invalid streaming record size or data after final record.');
        const line = this.decoder.decode(bytes);
        if (!line.trim())
            return;
        if (this.done)
            throw new Error('Invalid streaming record size or data after final record.');
        let record;
        try {
            record = JSON.parse(line);
        } catch {
            throw new Error('Malformed JSON from Ollama.');
        }
        if (!record || typeof record !== 'object' || Array.isArray(record))
            throw new Error('Invalid Ollama streaming response.');
        if (record.error)
            throw new Error(`Ollama: ${String(record.error).slice(0, 400)}`);
        if (typeof record.done !== 'boolean' || (record.message?.content !== undefined && typeof record.message.content !== 'string'))
            throw new Error('Invalid Ollama chat record.');
        this.done = record.done;
        this.onRecord(record);
    }

    finish() {
        if (this.cancelled)
            throw new Error('Cancelled');
        this._record(this.buffer);
        this.buffer = new Uint8Array(0);
        if (!this.done)
            throw new Error('Unexpected end of stream before the final record.');
    }

    cancel() {
        this.cancelled = true;
        this.buffer = new Uint8Array(0);
    }
}

export function visionCapability(info) {
    return Array.isArray(info?.capabilities) && info.capabilities.every(c => typeof c === 'string')
        ? info.capabilities.includes('vision') : null;
}

export function buildRequest(model, messages, info, allowUnknown = false) {
    if (!model)
        throw new Error('Select an available model first.');
    const hasImages = messages.some(m => m.images?.length);
    if (hasImages && visionCapability(info) === false)
        throw new Error('This model reports no vision support. Select a vision model.');
    if (hasImages && visionCapability(info) === null && !allowUnknown)
        throw new Error('Vision capability is unknown. Confirm an explicit image attempt.');
    const request = {model, stream: true, messages: messages.map(m => ({
        role: m.role, content: m.content, ...(m.images?.length ? {images: m.images} : {}),
    }))};
    // Some thinking-only models cannot disable thinking. Never request a trace.
    if (info?.thinking?.values?.includes(false))
        request.think = false;
    return request;
}

export function selectContext(messages) {
    const selected = [];
    let chars = 0;
    let imageCount = 0;
    for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i];
        if (m.role === 'assistant' && m.state !== 'complete')
            continue;
        const images = m.attachments?.length ?? 0;
        if (selected.length >= LIMITS.contextMessages || chars + m.content.length > LIMITS.contextChars || imageCount + images > 4)
            break;
        selected.unshift(m);
        chars += m.content.length;
        imageCount += images;
    }
    while (selected[0]?.role === 'assistant')
        selected.shift();
    if (!selected.length)
        throw new Error('Message exceeds the 24,000-character context limit. Shorten it.');
    return {messages: selected, omitted: messages.length - selected.length};
}

export function escapeMarkup(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export function inlineMarkup(text) {
    return text.split(/(`[^`\n]+`)/g).map(part => part.startsWith('`') && part.endsWith('`')
        ? `<tt>${escapeMarkup(part.slice(1, -1))}</tt>` : escapeMarkup(part)).join('');
}

export function markdownBlocks(text) {
    const blocks = [];
    let paragraph = [];
    let code = null;
    const flush = () => {
        if (paragraph.length) {
            blocks.push({type: 'text', text: paragraph.join('\n')});
            paragraph = [];
        }
    };
    for (const line of text.split('\n')) {
        if (/^\s*```/.test(line)) {
            flush();
            if (code !== null) {
                blocks.push({type: 'code', text: code.join('\n')});
                code = null;
            } else {
                code = [];
            }
        } else if (code !== null) {
            code.push(line);
        } else if (/^#{1,6}\s/.test(line)) {
            flush();
            blocks.push({type: 'heading', text: line.replace(/^#{1,6}\s+/, '')});
        } else if (/^\s*(?:[-*+] |\d+\. )/.test(line)) {
            flush();
            blocks.push({type: 'text', text: line.replace(/^\s*[-*+] /, '• ')});
        } else if (!line.trim()) {
            flush();
        } else {
            paragraph.push(line);
        }
    }
    flush();
    if (code !== null)
        blocks.push({type: 'code', text: code.join('\n')});
    return blocks;
}

export function imageHeader(bytes) {
    let width, height, type;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (bytes.length >= 24 && [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v) &&
        view.getUint32(12) === 0x49484452) {
        type = 'png';
        width = view.getUint32(16);
        height = view.getUint32(20);
    } else if (bytes[0] === 0xff && bytes[1] === 0xd8) {
        type = 'jpeg';
        let i = 2;
        while (i + 8 < bytes.length) {
            if (bytes[i++] !== 0xff)
                break;
            while (bytes[i] === 0xff)
                i++;
            const marker = bytes[i++];
            if (marker === 0xda || marker === 0xd9)
                break;
            const size = view.getUint16(i);
            if (size < 2 || i + size > bytes.length)
                break;
            if ([0xc0, 0xc1, 0xc2].includes(marker)) {
                height = view.getUint16(i + 3);
                width = view.getUint16(i + 5);
                break;
            }
            i += size;
        }
    }
    if (!width || !height || width * height > LIMITS.imagePixels || width > 32768 || height > 32768)
        throw new Error('Use a valid PNG/JPEG, at most 40 megapixels and 32,768 pixels per side.');
    if (bytes.length > LIMITS.sourceImage)
        throw new Error('Each source image must be at most 10 MiB.');
    return {width, height, type};
}

export function attachmentIds(conversations) {
    return new Set(conversations.flatMap(c => c.messages.flatMap(m => m.attachments ?? [])));
}

export function deleteConversation(conversations, id) {
    const kept = conversations.filter(c => c.id !== id);
    const retained = attachmentIds(kept);
    return {conversations: kept, removedAttachments: [...attachmentIds(conversations)].filter(a => !retained.has(a))};
}

export function parseHistory(text) {
    if (text.length > LIMITS.history)
        throw new Error('History is too large.');
    const data = JSON.parse(text);
    if (data.version !== 1 || !Array.isArray(data.conversations) || data.conversations.length > LIMITS.conversations)
        throw new Error('Unsupported or invalid history format.');
    const ids = new Set();
    for (const c of data.conversations) {
        if (!c || !/^[a-zA-Z0-9-]{1,80}$/.test(c.id) || ids.has(c.id) || typeof c.title !== 'string' ||
            typeof c.connectionId !== 'string' || typeof c.model !== 'string' || typeof c.updated !== 'string' ||
            normalizeUrl(c.url) !== c.url || !Array.isArray(c.messages) || c.messages.length > LIMITS.messages)
            throw new Error('Invalid conversation in history.');
        ids.add(c.id);
        for (const m of c.messages) {
            if (!['user', 'assistant'].includes(m.role) || typeof m.content !== 'string' || m.content.length > LIMITS.response ||
                !['complete', 'generating', 'interrupted', 'failed'].includes(m.state) ||
                !Array.isArray(m.attachments) || m.attachments.length > LIMITS.images ||
                m.attachments.some(a => !/^[a-f0-9-]{36}\.jpg$/.test(a)))
                throw new Error('Invalid message in history.');
            if (m.state === 'generating')
                m.state = 'interrupted';
            // Only whitelisted fields are serialized, including when reading older data.
        }
    }
    return data.conversations.map(c => ({id: c.id, title: c.title.slice(0, 100), connectionId: c.connectionId,
        url: c.url, model: c.model, updated: c.updated, messages: c.messages.map(m => ({
            role: m.role, content: m.content, state: m.state, attachments: m.attachments,
        }))}));
}

export function serializeHistory(conversations) {
    const clean = conversations.map(c => ({
        id: c.id, title: c.title.slice(0, 100), connectionId: c.connectionId,
        url: c.url, model: c.model, updated: c.updated,
        messages: c.messages.map(m => ({role: m.role, content: m.content,
            attachments: m.attachments ?? [], state: m.state})),
    }));
    const text = JSON.stringify({version: 1, conversations: clean});
    parseHistory(text);
    if (new TextEncoder().encode(text).length > LIMITS.history)
        throw new Error('History reached its 8 MiB limit. Delete older conversations.');
    return text;
}
