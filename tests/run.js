// SPDX-License-Identifier: GPL-3.0-or-later
// Runs unchanged with gjs -m or Node.js (development only).
import {LIMITS, NdjsonParser, normalizeUrl, connectionsFromJson, buildRequest, visionCapability,
    selectContext, escapeMarkup, inlineMarkup, markdownBlocks, parseHistory, serializeHistory,
    attachmentIds, deleteConversation, imageHeader} from '../lib/core.js';

let count = 0;
function assert(condition, message = 'Assertion failed') {
    if (!condition)
        throw new Error(message);
}
function equal(actual, expected) {
    assert(JSON.stringify(actual) === JSON.stringify(expected), `${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`);
}
function throws(fn, part = '') {
    try {
        fn();
    } catch (error) {
        assert(error.message.includes(part), `Expected ${part}, received ${error.message}`);
        return;
    }
    throw new Error('Expected an exception');
}
function test(name, fn) {
    fn();
    count++;
    console.log(`ok ${count} — ${name}`);
}
const encode = text => new TextEncoder().encode(text);
const event = (content, done = false) => `${JSON.stringify({message: {content}, done})}\n`;

test('NDJSON: every possible two-read split, including UTF-8 and JSON boundaries', () => {
    const bytes = encode(event('Café 🐈 漢') + event(' done', true));
    for (let split = 0; split <= bytes.length; split++) {
        let answer = '';
        const parser = new NdjsonParser(r => { answer += r.message.content; });
        parser.push(bytes.slice(0, split));
        parser.push(bytes.slice(split));
        parser.finish();
        equal(answer, 'Café 🐈 漢 done');
    }
});
test('NDJSON: one byte at a time, CRLF, empty lines and unterminated final record', () => {
    const records = [];
    const parser = new NdjsonParser(r => records.push(r));
    for (const byte of encode(`\r\n${event('é').replace('\n', '\r\n')}${event('!', true).trimEnd()}`))
        parser.push(new Uint8Array([byte]));
    parser.finish();
    equal(records.map(r => r.message.content), ['é', '!']);
});
test('NDJSON: error record, malformed JSON, invalid type and EOF', () => {
    throws(() => new NdjsonParser(() => {}).push(encode('{"error":"sign in"}\n')), 'sign in');
    throws(() => new NdjsonParser(() => {}).push(encode('{oops}\n')), 'Malformed');
    throws(() => new NdjsonParser(() => {}).push(encode('{"done":false,"message":{"content":3}}\n')), 'Invalid');
    const parser = new NdjsonParser(() => {});
    parser.push(encode(event('partial')));
    throws(() => parser.finish(), 'Unexpected end');
});
test('NDJSON: invalid and incomplete UTF-8 rejected', () => {
    throws(() => new NdjsonParser(() => {}).push(new Uint8Array([0xff, 10])));
    const parser = new NdjsonParser(() => {});
    parser.push(new Uint8Array([0xe2]));
    throws(() => parser.finish());
});
test('NDJSON: cancellation releases buffer and prevents callback', () => {
    let invoked = false;
    const parser = new NdjsonParser(() => { invoked = true; });
    parser.push(encode('{"do'));
    parser.cancel();
    equal(parser.buffer.length, 0);
    throws(() => parser.push(encode(event('', true))), 'Cancelled');
    throws(() => parser.finish(), 'Cancelled');
    assert(!invoked);
});
test('NDJSON: wire, individual record, unfinished line and post-final bounds', () => {
    throws(() => new NdjsonParser(() => {}, {...LIMITS, wire: 5}).push(encode('123456')), 'wire-size');
    throws(() => new NdjsonParser(() => {}, {...LIMITS, line: 5}).push(encode('123456')), 'too large');
    throws(() => new NdjsonParser(() => {}, {...LIMITS, line: 5}).push(encode('123456\n')), 'record size');
    throws(() => new NdjsonParser(() => {}).push(encode(event('', true) + event('extra'))), 'after final');
});
test('URLs: normalize slashes, host case, ports, IPv4 and IPv6', () => {
    equal(normalizeUrl(' HTTP://LOCALHOST:11434/// '), 'http://localhost:11434');
    equal(normalizeUrl('https://Example.COM:443/'), 'https://example.com');
    equal(normalizeUrl('http://192.168.0.50:11434'), 'http://192.168.0.50:11434');
    equal(normalizeUrl('http://[::1]:11434/'), 'http://[::1]:11434');
    equal(normalizeUrl('https://[2001:db8::1]'), 'https://[2001:db8::1]');
});
test('URLs: reject credentials, control characters, schemes, invalid hosts and ambiguous destinations', () => {
    for (const url of ['ftp://host', 'http://u:p@host', 'https://host/path', 'http://host?x=1', 'http://host/#a',
        'http://host:0', 'http://host:65536', 'http://host\\evil', 'http://ho\nst', 'http://a..b', 'http://-a',
        'http://999.1.1.1', 'http://[::::]', 'http://[1:2:3]', 'http://[1:2:3:4:5:6:7:8::]'])
        throws(() => normalizeUrl(url));
});
test('Connection settings validate stable unique identities', () => {
    const c = {id: 'local', name: 'This Computer', url: 'http://localhost:11434/', model: 'exact:cloud'};
    equal(connectionsFromJson(JSON.stringify([c]))[0].model, 'exact:cloud');
    throws(() => connectionsFromJson(JSON.stringify([c, c])), 'unique');
});
test('Requests preserve exact model names and use native base64 image arrays', () => {
    const body = buildRequest('gemma:cloud', [{role: 'user', content: '', images: ['aGVsbG8='], thinking: 'secret'}], {capabilities: ['vision']});
    equal(body, {model: 'gemma:cloud', stream: true, messages: [{role: 'user', content: '', images: ['aGVsbG8=']}]});
    assert(!('tools' in body));
});
test('Vision: unknown differs from known lack of support and requires explicit attempt', () => {
    equal(visionCapability({}), null);
    equal(visionCapability({capabilities: ['completion']}), false);
    equal(visionCapability({capabilities: ['vision']}), true);
    const messages = [{role: 'user', content: '', images: ['abc']}];
    throws(() => buildRequest('model', messages, null), 'unknown');
    assert(buildRequest('model', messages, null, true));
    throws(() => buildRequest('model', messages, {capabilities: []}, true), 'no vision');
});
test('Thinking is never requested and unsupported controls are omitted', () => {
    equal(buildRequest('m', [], {thinking: {values: [false, true]}}).think, false);
    assert(!('think' in buildRequest('m', [], {thinking: {values: ['low', 'high']}})));
});
test('Context bounds omit old turns, exclude incomplete answers and retain newest user', () => {
    const messages = Array.from({length: 40}, (_, i) => ({role: i % 2 ? 'assistant' : 'user', content: `${i}`, state: 'complete', attachments: []}));
    messages.push({role: 'assistant', content: 'partial', state: 'interrupted', attachments: []});
    messages.push({role: 'user', content: 'new', state: 'complete', attachments: []});
    const selected = selectContext(messages);
    assert(selected.omitted > 0 && selected.messages.length <= 24);
    equal(selected.messages[0].role, 'user');
    equal(selected.messages[selected.messages.length - 1].content, 'new');
    assert(!selected.messages.some(m => m.content === 'partial'));
    throws(() => selectContext([{role: 'user', content: 'x'.repeat(24001)}]), 'Shorten');
});
test('Markdown escapes markup, does not create links and copies code literally', () => {
    equal(escapeMarkup('<b a="&">\''), '&lt;b a=&quot;&amp;&quot;&gt;&apos;');
    equal(inlineMarkup('`<script>` <span>'), '<tt>&lt;script&gt;</tt> &lt;span&gt;');
    const blocks = markdownBlocks('# Heading\n\n- one\n2. two\n\n```js\n<script>&code\n```\n[link](file:///etc/passwd)');
    equal(blocks.map(b => b.type), ['heading', 'text', 'text', 'code', 'text']);
    equal(blocks[3].text, '<script>&code');
    assert(!inlineMarkup(blocks[4].text).includes('<a'));
    equal(markdownBlocks('```\nunfinished')[0].text, 'unfinished');
});
const image1 = '11111111-1111-1111-1111-111111111111.jpg';
const image2 = '22222222-2222-2222-2222-222222222222.jpg';
const conversation = (id, images = []) => ({id, title: 'Test', updated: '2026-10-22T00:00:00Z',
    connectionId: 'local', url: 'http://localhost:11434', model: 'm:cloud',
    messages: [{role: 'user', content: 'Hi', attachments: images, state: 'complete'},
        {role: 'assistant', content: 'Answer', attachments: [], state: 'generating', thinking: 'never retain'}]});
test('History: versioned round trip, interrupted recovery and whitelisted fields only', () => {
    const text = serializeHistory([conversation('one', [image1])]);
    assert(!text.includes('thinking') && !text.includes('base64'));
    const data = parseHistory(text);
    equal(data[0].messages[1].state, 'interrupted');
    equal(data[0].model, 'm:cloud');
    equal([...attachmentIds(data)], [image1]);
});
test('History: corruption, unknown versions, oversized data and path traversal rejected', () => {
    throws(() => parseHistory('{'));
    throws(() => parseHistory('{"version":2,"conversations":[]}'), 'Unsupported');
    const c = conversation('one', ['../../secret.jpg']);
    throws(() => serializeHistory([c]), 'Invalid message');
    throws(() => parseHistory(' '.repeat(LIMITS.history + 1)), 'too large');
    throws(() => serializeHistory([conversation('same'), conversation('same')]), 'Invalid conversation');
});
test('Deletion preserves shared attachments and identifies newly unreferenced files', () => {
    const conversations = [conversation('one', [image1, image2]), conversation('two', [image1])];
    const result = deleteConversation(conversations, 'one');
    equal(result.conversations.map(c => c.id), ['two']);
    equal(result.removedAttachments, [image2]);
    equal(deleteConversation(result.conversations, 'two').removedAttachments, [image1]);
});
test('Image headers: PNG/JPEG dimensions, source-size and decompression bounds', () => {
    const png = new Uint8Array(24);
    png.set([137, 80, 78, 71, 13, 10, 26, 10], 0);
    const view = new DataView(png.buffer);
    view.setUint32(12, 0x49484452);
    view.setUint32(16, 4000);
    view.setUint32(20, 3000);
    equal(imageHeader(png), {width: 4000, height: 3000, type: 'png'});
    view.setUint32(16, 30000);
    throws(() => imageHeader(png), '40 megapixels');
    const jpeg = new Uint8Array([255, 216, 255, 192, 0, 8, 8, 0, 100, 0, 200, 1, 255, 217]);
    equal(imageHeader(jpeg), {width: 200, height: 100, type: 'jpeg'});
    throws(() => imageHeader(encode('not an image')), 'valid PNG/JPEG');
    const large = new Uint8Array(LIMITS.sourceImage + 1);
    view.setUint32(16, 100);
    large.set(png);
    throws(() => imageHeader(large), '10 MiB');
});
console.log(`Passed ${count} test groups.`);
