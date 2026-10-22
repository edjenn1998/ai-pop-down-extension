// SPDX-License-Identifier: GPL-3.0-or-later
import GdkPixbuf from 'gi://GdkPixbuf?version=2.0';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {LIMITS, imageHeader} from './core.js';
import {asyncCall, closeStream, readFile} from './io.js';

export async function prepareImage(bytes, cancellable) {
    const header = imageHeader(bytes);
    const ratio = Math.min(1, LIMITS.imageSide / Math.max(header.width, header.height));
    const stream = Gio.MemoryInputStream.new_from_bytes(new GLib.Bytes(bytes));
    let pixbuf;
    try {
        pixbuf = await new Promise((resolve, reject) => {
            GdkPixbuf.Pixbuf.new_from_stream_at_scale_async(stream,
                Math.max(1, Math.round(header.width * ratio)), Math.max(1, Math.round(header.height * ratio)), true, cancellable,
                (_source, result) => {
                    try {
                        resolve(GdkPixbuf.Pixbuf.new_from_stream_finish(result));
                    } catch (error) {
                        reject(error);
                    }
                });
        });
    } finally {
        await closeStream(stream);
    }
    if (Math.max(pixbuf.get_width(), pixbuf.get_height()) > LIMITS.imageSide)
        throw new Error('Image decoder did not respect the 2048-pixel bound.');
    // Rotation is bounded to the already scaled image, not the untrusted source.
    pixbuf = pixbuf.apply_embedded_orientation();
    const output = Gio.MemoryOutputStream.new_resizable();
    try {
        await new Promise((resolve, reject) => {
            pixbuf.save_to_streamv_async(output, 'jpeg', ['quality'], ['88'], cancellable, (_source, result) => {
                try {
                    resolve(GdkPixbuf.Pixbuf.save_to_stream_finish(result));
                } catch (error) {
                    reject(error);
                }
            });
        });
        await closeStream(output);
        const encoded = output.steal_as_bytes().get_data();
        if (encoded.length > LIMITS.sourceImage)
            throw new Error('Prepared image exceeds 10 MiB.');
        return encoded;
    } finally {
        await closeStream(output);
    }
}

export async function imageFromFile(uri, cancellable) {
    const file = Gio.File.new_for_uri(uri);
    if (!file.is_native())
        throw new Error('Select a local PNG or JPEG file.');
    return readFile(file, LIMITS.sourceImage, cancellable);
}

export async function requestImages(store, messages, cancellable) {
    const result = [];
    for (const m of messages) {
        const images = [];
        for (const id of m.attachments ?? []) {
            const bytes = await readFile(store.imageFile(id), LIMITS.sourceImage, cancellable);
            images.push(GLib.base64_encode(bytes));
        }
        result.push({role: m.role, content: m.content, images});
    }
    return result;
}

export async function clipboardImage(selection, selectionType, cancellable) {
    const types = selection.get_mimetypes(selectionType) ?? [];
    const mime = ['image/png', 'image/jpeg'].find(t => types.includes(t));
    if (!mime)
        throw new Error('The clipboard does not offer a PNG or JPEG image.');
    const output = Gio.MemoryOutputStream.new_resizable();
    try {
        // One extra byte distinguishes a truncated transfer from an allowed source.
        await asyncCall(selection, 'transfer_async', 'transfer_finish', [selectionType, mime, LIMITS.sourceImage + 1, output, cancellable]);
        await closeStream(output);
        const bytes = output.steal_as_bytes().get_data();
        if (bytes.length > LIMITS.sourceImage)
            throw new Error('Clipboard image exceeds 10 MiB.');
        return bytes;
    } finally {
        await closeStream(output);
    }
}
