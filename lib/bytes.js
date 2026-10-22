// SPDX-License-Identifier: GPL-3.0-or-later
// Shared bounded reader; read() supplies the next asynchronously obtained byte chunk.
export async function readChunks(read, limit, check = () => {}) {
    const chunks = [];
    let size = 0;
    while (true) {
        check();
        const chunk = await read();
        check();
        if (!chunk.length)
            break;
        size += chunk.length;
        if (size > limit)
            throw new Error(`Data exceeds the ${Math.round(limit / 1024)} KiB limit.`);
        chunks.push(chunk);
    }
    const data = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
        data.set(chunk, offset);
        offset += chunk.length;
    }
    return data;
}
