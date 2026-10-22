// SPDX-License-Identifier: GPL-3.0-or-later
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const BUS = 'org.freedesktop.portal.Desktop';
const PATH = '/org/freedesktop/portal/desktop';

export class Portals {
    constructor() {
        this.bus = Gio.DBus.session;
        this.pending = new Set();
        this.destroyed = false;
    }

    request(iface, method, parameters, token) {
        const sender = this.bus.get_unique_name().slice(1).replace(/\./g, '_');
        const expected = `/org/freedesktop/portal/desktop/request/${sender}/${token}`;
        return new Promise((resolve, reject) => {
            const op = {path: expected, signal: 0, cancellable: new Gio.Cancellable(), timer: 0, finish: null};
            op.finish = (error, data) => {
                if (!this.pending.delete(op))
                    return;
                this.bus.signal_unsubscribe(op.signal);
                if (op.timer)
                    GLib.Source.remove(op.timer);
                op.timer = 0;
                op.cancellable.cancel();
                if (error)
                    reject(error);
                else
                    resolve(data);
            };
            this.pending.add(op);
            // Subscribe before invoking the method: fast responses must not race us.
            op.signal = this.bus.signal_subscribe(BUS, 'org.freedesktop.portal.Request', 'Response', expected, null,
                Gio.DBusSignalFlags.NONE, (_bus, _sender, _path, _iface, _signal, reply) => {
                    const [code, data] = reply.deep_unpack();
                    op.finish(code === 0 ? null : new Error(code === 1 ? 'Selection cancelled.' : 'Desktop portal could not complete the request.'), data);
                });
            op.timer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 300, () => {
                op.timer = 0;
                this.close(op);
                op.finish(new Error('Desktop selection timed out.'));
                return GLib.SOURCE_REMOVE;
            });
            this.bus.call(BUS, PATH, iface, method, parameters, new GLib.VariantType('(o)'),
                Gio.DBusCallFlags.NONE, 15000, op.cancellable, (bus, result) => {
                    try {
                        const [path] = bus.call_finish(result).deep_unpack();
                        if (!this.pending.has(op) || this.destroyed) {
                            this.close({path});
                            return;
                        }
                        if (path !== expected) {
                            this.close({path});
                            op.finish(new Error('Portal did not honor the request token. Update the desktop portal.'));
                        }
                    } catch (error) {
                        op.finish(error);
                    }
                });
        });
    }

    chooseFile() {
        const token = `ai_${GLib.uuid_string_random().replace(/-/g, '')}`;
        return this.request('org.freedesktop.portal.FileChooser', 'OpenFile', new GLib.Variant('(ssa{sv})', ['', 'Attach an image', {
            handle_token: new GLib.Variant('s', token),
            multiple: new GLib.Variant('b', false),
            filters: new GLib.Variant('a(sa(us))', [['PNG and JPEG images', [[1, 'image/png'], [1, 'image/jpeg']]]]),
        }]), token);
    }

    screenshot() {
        const token = `ai_${GLib.uuid_string_random().replace(/-/g, '')}`;
        return this.request('org.freedesktop.portal.Screenshot', 'Screenshot', new GLib.Variant('(sa{sv})', ['', {
            handle_token: new GLib.Variant('s', token), interactive: new GLib.Variant('b', true),
        }]), token);
    }

    close(op) {
        this.bus.call(BUS, op.path, 'org.freedesktop.portal.Request', 'Close', null, null,
            Gio.DBusCallFlags.NONE, 1000, null, (bus, result) => {
                try {
                    bus.call_finish(result);
                } catch {
                    // A completed request no longer exists.
                }
            });
    }

    destroy() {
        this.destroyed = true;
        for (const op of [...this.pending]) {
            this.close(op);
            op.finish(new Error('Extension disabled.'));
        }
    }
}
