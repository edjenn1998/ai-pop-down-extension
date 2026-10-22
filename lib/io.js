// SPDX-License-Identifier: GPL-3.0-or-later
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {readChunks} from './bytes.js';

export function asyncCall(object, method, finish, args) {
    return new Promise((resolve, reject) => {
        object[method](...args, (source, result) => {
            try {
                resolve((source ?? object)[finish](result));
            } catch (error) {
                reject(error);
            }
        });
    });
}

export async function closeStream(stream) {
    if (stream && !stream.is_closed()) {
        try {
            await asyncCall(stream, 'close_async', 'close_finish', [GLib.PRIORITY_DEFAULT, null]);
        } catch {
            // Closing a cancelled transport may report the original cancellation.
        }
    }
}

export async function readBounded(stream, limit, cancellable) {
    return readChunks(async () => {
        const bytes = await asyncCall(stream, 'read_bytes_async', 'read_bytes_finish', [65536, GLib.PRIORITY_DEFAULT, cancellable]);
        return bytes.get_data();
    }, limit, () => {
        if (cancellable?.is_cancelled())
            throw new Error('Read cancelled.');
    });
}

export async function readFile(file, limit, cancellable) {
    const stream = await asyncCall(file, 'read_async', 'read_finish', [GLib.PRIORITY_DEFAULT, cancellable]);
    try {
        return await readBounded(stream, limit, cancellable);
    } finally {
        await closeStream(stream);
    }
}

export function atomicWrite(file, data, cancellable) {
    return asyncCall(file, 'replace_contents_bytes_async', 'replace_contents_finish', [
        new GLib.Bytes(data), null, false, Gio.FileCreateFlags.PRIVATE | Gio.FileCreateFlags.REPLACE_DESTINATION, cancellable,
    ]);
}

export async function ensureDirectory(file, cancellable) {
    try {
        await asyncCall(file, 'make_directory_async', 'make_directory_finish', [GLib.PRIORITY_DEFAULT, cancellable]);
    } catch (error) {
        if (!error.matches?.(Gio.IOErrorEnum, Gio.IOErrorEnum.EXISTS))
            throw error;
    }
    await asyncCall(file, 'set_attributes_async', 'set_attributes_finish', [
        (() => {
            const info = new Gio.FileInfo();
            info.set_attribute_uint32('unix::mode', 0o700);
            return info;
        })(), Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, GLib.PRIORITY_DEFAULT, cancellable,
    ]);
}

export function removeFile(file, cancellable) {
    return asyncCall(file, 'delete_async', 'delete_finish', [GLib.PRIORITY_DEFAULT, cancellable]);
}
