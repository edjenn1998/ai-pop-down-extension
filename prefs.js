// SPDX-License-Identifier: GPL-3.0-or-later
import Adw from 'gi://Adw?version=1';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=4.0';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import {connectionsFromJson, normalizeUrl} from './lib/core.js';
import {OllamaClient} from './lib/ollama.js';
import {searchCredential} from './lib/credentials.js';
import {WebSearchClient} from './lib/webSearch.js';

export default class AiPopDownPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const client = new OllamaClient();
        const web = new WebSearchClient();
        let alive = true;
        const cancels = new Set();
        window.connect('close-request', () => {
            alive = false;
            for (const cancel of cancels)
                cancel.cancel();
            client.destroy();
            web.destroy();
            key.text = '';
            return false;
        });
        window.set_default_size(720, 760);
        const page = new Adw.PreferencesPage({title: 'AI Pop Down', icon_name: 'preferences-system-symbolic'});
        window.add(page);
        const appearance = new Adw.PreferencesGroup({title: 'Dropdown', description: 'Sizes are logical pixels, clamped to the icon’s monitor.'});
        for (const [key, title, min, max] of [['popup-width', 'Width', 360, 1200], ['popup-height', 'Height', 400, 1400]]) {
            const row = new Adw.SpinRow({title, adjustment: new Gtk.Adjustment({lower: min, upper: max, step_increment: 20, page_increment: 100})});
            settings.bind(key, row, 'value', Gio.SettingsBindFlags.DEFAULT);
            appearance.add(row);
        }
        const shortcut = new Adw.EntryRow({title: 'Toggle shortcut (empty = unassigned)', text: settings.get_strv('toggle-shortcut')[0] ?? '', show_apply_button: true});
        shortcut.connect('apply', () => {
            const value = shortcut.text.trim();
            const [valid, key, modifiers] = Gtk.accelerator_parse(value);
            if (value && (!valid || !Gtk.accelerator_valid(key, modifiers))) {
                window.add_toast(new Adw.Toast({title: 'Use a valid accelerator such as <Super>a, or leave empty.'}));
                return;
            }
            settings.set_strv('toggle-shortcut', value ? [Gtk.accelerator_name(key, modifiers)] : []);
            window.add_toast(new Adw.Toast({title: 'Shortcut saved'}));
        });
        appearance.add(shortcut);
        page.add(appearance);
        const privacy = new Adw.PreferencesGroup({title: 'History and privacy',
            description: 'History is plaintext, not encrypted, in $XDG_DATA_HOME/ai-pop-down-extension (normally ~/.local/share/ai-pop-down-extension). Use the dropdown’s History menu to delete conversations or all history. Clipboard access only follows explicit paste/copy actions. Cloud models can transmit text and images beyond your Ollama server.'});
        const persistent = new Adw.SwitchRow({title: 'Persistent conversation history', subtitle: 'Turning off removes saved chats; this session remains in memory. Temporary images are cleaned on the next enable.'});
        settings.bind('persistent-history', persistent, 'active', Gio.SettingsBindFlags.DEFAULT);
        privacy.add(persistent);
        page.add(privacy);
        const search = new Adw.PreferencesGroup({title: 'Web Search', description:
            'Optional hosted search by Ollama. Only your current question or explicit query (max 1,000 characters) goes to search; selected page URLs go to its fetch service. Answers still use your selected local/LAN Ollama model. Local inference does not make search local. An Ollama account/API key is required; check current account limits and potential costs. Credentials are stored only in Secret Service, separate from server connections.'});
        const setup = new Adw.ActionRow({title: 'Ollama search API key', subtitle: 'Create a key and review current account terms and limits.'});
        setup.add_suffix(new Gtk.LinkButton({label: 'API-key setup ↗', uri: 'https://ollama.com/settings/keys', valign: Gtk.Align.CENTER}));
        search.add(setup);
        const key = new Adw.PasswordEntryRow({title: 'New API key (not displayed or prefilled)'});
        search.add(key);
        const keyStatus = new Adw.ActionRow({title: 'Search not tested', subtitle: 'Test Search uses the saved key and makes one hosted query; it may count against your provider quota.'});
        const saveKey = new Gtk.Button({label: 'Save / Replace', valign: Gtk.Align.CENTER});
        const removeKey = new Gtk.Button({label: 'Remove', valign: Gtk.Align.CENTER});
        const testSearch = new Gtk.Button({label: 'Test Search', valign: Gtk.Align.CENTER});
        for (const button of [saveKey, removeKey, testSearch])
            keyStatus.add_suffix(button);
        search.add(keyStatus);
        page.add(search);
        const keyAction = async action => {
            const cancel = new Gio.Cancellable();
            cancels.add(cancel);
            for (const button of [saveKey, removeKey, testSearch])
                button.sensitive = false;
            keyStatus.title = action === 'test' ? 'Searching the web…' : 'Accessing Secret Service…';
            try {
                if (action === 'test') {
                    const result = await web.retrieve('Ollama web search', cancel, () => {}, false);
                    if (alive)
                        keyStatus.title = `Search authenticated — ${result.sources.length} results`;
                } else {
                    const result = await searchCredential(action, cancel, action === 'save' ? key.text.trim() : '');
                    if (alive) {
                        key.text = '';
                        keyStatus.title = action === 'save' ? 'Search key saved in Secret Service'
                            : result ? 'Search key removed' : 'No unlocked key removed. Unlock your login keyring and retry if a key remains.';
                    }
                }
            } catch (error) {
                if (alive)
                    keyStatus.title = error.message;
            } finally {
                cancels.delete(cancel);
                if (alive) {
                    key.text = '';
                    for (const button of [saveKey, removeKey, testSearch])
                        button.sensitive = true;
                }
            }
        };
        saveKey.connect('clicked', () => keyAction('save'));
        removeKey.connect('clicked', () => keyAction('remove'));
        testSearch.connect('clicked', () => keyAction('test'));
        const help = new Adw.PreferencesGroup({title: 'Ollama connections',
            description: 'Ollama must already be running. For EVO-X2, obtain its actual trusted LAN address and add http://<actual-address>:11434. HTTP LAN traffic is not encrypted. Cloud models require server-side Ollama sign-in; no provider API key is used here.'});
        const add = new Gtk.Button({label: 'Add Connection', halign: Gtk.Align.END});
        const addRow = new Adw.ActionRow({title: 'Named servers', subtitle: 'Connection/model changes start a new chat; existing chats keep their destination.'});
        addRow.add_suffix(add);
        help.add(addRow);
        page.add(help);
        let connections;
        try {
            connections = connectionsFromJson(settings.get_string('connections'));
        } catch (error) {
            connections = [];
            window.add_toast(new Adw.Toast({title: error.message}));
        }
        const groups = new Map();
        const save = () => settings.set_string('connections', JSON.stringify(connections));
        const addGroup = connection => {
            const group = new Adw.PreferencesGroup({title: connection.name});
            const name = new Adw.EntryRow({title: 'Display name', text: connection.name});
            const url = new Adw.EntryRow({title: 'Server base URL (HTTP or HTTPS origin)', text: connection.url});
            const model = new Adw.EntryRow({title: 'Default model (exact name and tag; empty = first available)', text: connection.model});
            group.add(name);
            group.add(url);
            group.add(model);
            const status = new Adw.ActionRow({title: 'Not tested', subtitle: 'TLS certificates are validated. Redirects are refused.'});
            const test = new Gtk.Button({label: 'Test Connection', valign: Gtk.Align.CENTER});
            const apply = new Gtk.Button({label: 'Save', valign: Gtk.Align.CENTER});
            const remove = new Gtk.Button({icon_name: 'user-trash-symbolic', tooltip_text: 'Remove connection', valign: Gtk.Align.CENTER});
            status.add_suffix(test);
            status.add_suffix(apply);
            status.add_suffix(remove);
            group.add(status);
            page.add(group);
            groups.set(connection.id, group);
            apply.connect('clicked', () => {
                try {
                    if (!name.text.trim())
                        throw new Error('Give this connection a display name.');
                    const nextUrl = normalizeUrl(url.text);
                    const commit = () => {
                        connection.name = name.text.trim().slice(0, 100);
                        connection.url = nextUrl;
                        connection.model = model.text.trim().slice(0, 200);
                        group.title = connection.name;
                        url.text = nextUrl;
                        save();
                        status.title = 'Connection saved';
                    };
                    if (nextUrl !== connection.url) {
                        const dialog = new Adw.AlertDialog({heading: 'Change server destination?',
                            body: 'Existing chats remain bound to the previous URL. Reusing their content at the new URL will require a separate confirmation in the dropdown.'});
                        dialog.add_response('cancel', 'Cancel');
                        dialog.add_response('save', 'Change destination');
                        dialog.set_response_appearance('save', Adw.ResponseAppearance.SUGGESTED);
                        dialog.connect('response', (_dialog, response) => {
                            if (alive && response === 'save')
                                commit();
                        });
                        dialog.present(window);
                    } else {
                        commit();
                    }
                } catch (error) {
                    status.title = error.message;
                }
            });
            test.connect('clicked', async () => {
                const cancel = new Gio.Cancellable();
                cancels.add(cancel);
                test.sensitive = false;
                status.title = 'Connecting…';
                try {
                    const models = await client.models(normalizeUrl(url.text), cancel, true);
                    if (alive)
                        status.title = `Connected — ${models.length} model${models.length === 1 ? '' : 's'} available`;
                } catch (error) {
                    if (alive)
                        status.title = error.message;
                } finally {
                    cancels.delete(cancel);
                    if (alive)
                        test.sensitive = true;
                }
            });
            remove.connect('clicked', () => {
                const dialog = new Adw.AlertDialog({heading: `Remove ${connection.name}?`, body: 'Saved conversations remain on disk, but cannot send while their connection identity is missing.'});
                dialog.add_response('cancel', 'Cancel');
                dialog.add_response('remove', 'Remove');
                dialog.set_response_appearance('remove', Adw.ResponseAppearance.DESTRUCTIVE);
                dialog.connect('response', (_dialog, response) => {
                    if (!alive || response !== 'remove')
                        return;
                    connections = connections.filter(c => c.id !== connection.id);
                    save();
                    page.remove(group);
                    groups.delete(connection.id);
                });
                dialog.present(window);
            });
        };
        connections.forEach(addGroup);
        add.connect('clicked', () => {
            if (connections.length >= 20) {
                window.add_toast(new Adw.Toast({title: 'At most 20 connections are supported.'}));
                return;
            }
            const connection = {id: GLib.uuid_string_random(), name: 'New Connection', url: 'http://localhost:11434', model: ''};
            connections.push(connection);
            save();
            addGroup(connection);
        });
    }
}
