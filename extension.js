// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 AI Pop Down Extension contributors
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import {LIMITS, attachmentIds, buildRequest, connectionsFromJson, deleteConversation, selectContext, sourceUrl, visionCapability} from './lib/core.js';
import {clipboardImage, imageFromFile, prepareImage, requestImages} from './lib/images.js';
import {removeFile} from './lib/io.js';
import {OllamaClient} from './lib/ollama.js';
import {Portals} from './lib/portal.js';
import {HistoryStore} from './lib/storage.js';
import {ChatView} from './lib/ui.js';
import {WebSearchClient} from './lib/webSearch.js';
import {searchQuery, webContext} from './lib/webCore.js';

class ChatController {
    constructor(extension) {
        this.extension = extension;
        this.alive = true;
        this.ready = false;
        this.cancel = new Gio.Cancellable();
        this.settings = extension.getSettings();
        this.client = new OllamaClient();
        this.web = new WebSearchClient();
        this.portals = new Portals();
        this.store = new HistoryStore(this.cancel);
        this.sources = new Set();
        this.conversations = [];
        this.drafts = new Map();
        this.attachments = [];
        this.models = [];
        this.info = null;
        this.discoveryId = 0;
        this.generation = null;
        this.imageBusy = false;
        this.chooser = null;
        this.saving = false;
        this.saveAgain = false;
        this.view = new ChatView(extension, {
            choose: kind => this.run(() => this.choose(kind)),
            newChat: () => this.run(() => this.newChat()),
            preferences: () => { this.view.panel.menu.close(); extension.openPreferences(); },
            refresh: () => this.run(() => this.refresh(true)),
            send: () => this.run(() => this.send()),
            attach: kind => this.run(() => this.attach(kind)),
            open: () => this.view.size(this.settings),
            source: url => this.run(() => this.openSource(url)),
        });
        this.changed = this.settings.connect('changed', (_settings, key) => {
            if (key === 'toggle-shortcut')
                this.bindShortcut();
            else if (key === 'persistent-history')
                this.run(() => this.historyPreference());
            else if (key.startsWith('popup-'))
                this.view.size(this.settings);
            else if (key === 'connections') {
                if (this.generation || this.imageBusy) {
                    this.pendingConnections = true;
                    this.status('Connection settings changed. Stop or finish the current operation before switching.');
                } else {
                    this.run(() => this.loadConnections());
                }
            }
        });
        this.bindShortcut();
        this.run(() => this.initialize());
    }

    async run(work) {
        try {
            await work();
        } catch (error) {
            if (this.alive)
                this.status(error.message);
        }
    }

    status(text) {
        if (this.alive)
            this.view.status.text = text;
    }

    bindShortcut() {
        Main.wm.removeKeybinding('toggle-shortcut');
        Main.wm.addKeybinding('toggle-shortcut', this.settings, Meta.KeyBindingFlags.NONE, Shell.ActionMode.NORMAL,
            () => this.view.panel.menu.toggle());
    }

    async initialize() {
        try {
            this.conversations = await this.store.load();
            if (!this.settings.get_boolean('persistent-history')) {
                this.conversations = [];
                await this.store.reset();
            } else
                await this.store.collect(attachmentIds(this.conversations));
        } catch (error) {
            if (!this.alive)
                return;
            this.storageError = error.message;
        }
        if (!this.alive)
            return;
        this.ready = true;
        await this.loadConnections();
        if (this.storageError)
            this.status(this.storageError);
    }

    async loadConnections() {
        this.connections = connectionsFromJson(this.settings.get_string('connections'));
        const id = this.connection?.id ?? this.settings.get_string('selected-connection');
        this.connection = this.connections.find(c => c.id === id) ?? this.connections[0] ?? null;
        this.pendingConnections = false;
        if (!this.current)
            this.makeChat();
        if (!this.connection) {
            this.status('Add a connection in Preferences.');
            return;
        }
        this.updateDestination();
        await this.refresh();
    }

    assertIdle() {
        if (!this.ready)
            throw new Error('Wait for local history to load.');
        if (this.generation)
            throw new Error('Stop the current response before changing conversations, models or connections.');
        if (this.imageBusy)
            throw new Error('Finish or cancel image selection first.');
    }

    makeChat() {
        this.current = {id: GLib.uuid_string_random(), title: 'New Chat', updated: new Date().toISOString(),
            connectionId: this.connection?.id ?? '', url: this.connection?.url ?? 'http://localhost:11434',
            model: this.connection?.model ?? '', messages: []};
        this.attachments = [];
        this.view.entry.set_text('');
        this.view.resetSearch();
        this.render();
    }

    rememberDraft() {
        if (!this.current)
            return;
        const text = this.view.entry.get_text();
        if (!text && !this.attachments.length) {
            this.drafts.delete(this.current.id);
            return;
        }
        if (!this.drafts.has(this.current.id) && this.drafts.size >= 50)
            throw new Error('There are 50 pending session drafts. Clear an older draft before switching.');
        this.drafts.set(this.current.id, {text, attachments: [...this.attachments]});
    }

    newChat() {
        this.assertIdle();
        this.rememberDraft();
        this.makeChat();
        this.current.model = this.selectedModel ?? this.connection?.model ?? '';
        this.chooser = null;
        this.view.chooser.hide();
        this.updateDestination();
        this.status('New chat.');
        this.view.entry.grab_key_focus();
    }

    render() {
        this.view.render(this.current, this.store);
        this.renderAttachments();
    }

    renderAttachments() {
        this.view.renderAttachments(this.attachments, this.store, id => this.run(async () => {
            this.assertIdle();
            this.attachments = this.attachments.filter(a => a !== id);
            this.store.reserved.delete(id);
            this.rememberDraft();
            this.renderAttachments();
            await this.persist();
        }));
    }

    updateDestination() {
        if (!this.alive)
            return;
        this.view.connection.label = this.connection?.name ?? 'No connection';
        this.view.model.label = this.selectedModel || 'Select model';
        const capability = visionCapability(this.info);
        const vision = capability === null ? 'vision unknown' : capability ? 'vision supported' : 'text only';
        this.view.destination.text = `${this.connection?.url ?? 'No server'} · ${this.selectedModel || 'no model'} · ${vision}\nCloud models through Ollama may send text and images beyond this server.`;
    }

    async refresh(force = false) {
        if (!this.ready || !this.connection)
            return;
        if (this.generation || this.imageBusy)
            throw new Error('Stop or finish the current operation before refreshing models.');
        this.discoveryCancel?.cancel();
        const cancel = new Gio.Cancellable();
        this.discoveryCancel = cancel;
        const id = ++this.discoveryId;
        const connection = this.connection;
        this.status('Connecting to Ollama…');
        try {
            const models = await this.client.models(connection.url, cancel, force);
            if (!this.alive || id !== this.discoveryId)
                return;
            this.models = models;
            const preferred = this.current?.connectionId === connection.id && this.current.url === connection.url ? this.current.model : connection.model;
            this.selectedModel = preferred || models[0]?.name || '';
            if (!this.current.messages.length) {
                this.current.connectionId = connection.id;
                this.current.url = connection.url;
                this.current.model = this.selectedModel;
            }
            this.info = null;
            this.updateDestination();
            if (!models.length) {
                this.status('Connected, but no models are available. Add models using Ollama, then Refresh.');
                return;
            }
            if (!models.some(m => m.name === this.selectedModel)) {
                this.status('The conversation’s model is unavailable. Choose a model to start a new chat.');
                return;
            }
            await this.loadModelInfo(force);
        } catch (error) {
            if (this.alive && id === this.discoveryId && !cancel.is_cancelled()) {
                this.models = [];
                this.info = null;
                this.updateDestination();
                this.status(error.message);
            }
        }
    }

    async loadModelInfo(force = false) {
        const id = this.discoveryId;
        const model = this.selectedModel;
        try {
            const info = await this.client.modelInfo(this.connection.url, model, this.discoveryCancel, force);
            if (!this.alive || id !== this.discoveryId || model !== this.selectedModel)
                return;
            this.info = info;
            this.status(visionCapability(info) === null ? 'Connected. Vision capability unknown: this server did not advertise capabilities.' : 'Connected. Ready to chat.');
        } catch {
            if (!this.alive || id !== this.discoveryId || model !== this.selectedModel)
                return;
            this.info = null;
            this.status('Connected. Capability discovery failed; vision support is unknown.');
        }
        this.updateDestination();
    }

    choose(kind) {
        this.assertIdle();
        if (this.chooser === kind && this.view.chooser.visible) {
            this.view.chooser.hide();
            this.chooser = null;
            return;
        }
        this.chooser = kind;
        const close = () => { this.view.chooser.hide(); this.chooser = null; };
        if (kind === 'connections') {
            this.view.choices(this.connections.map(c => ({label: `${c.name} — ${c.url}`, action: () => this.run(async () => {
                this.assertIdle();
                close();
                this.rememberDraft();
                this.connection = c;
                this.settings.set_string('selected-connection', c.id);
                this.makeChat();
                await this.refresh();
            })})));
        } else if (kind === 'models') {
            this.view.choices(this.models.map(m => ({label: m.name, action: () => this.run(async () => {
                this.assertIdle();
                close();
                this.newChat();
                this.selectedModel = m.name;
                this.current.model = m.name;
                this.info = null;
                this.updateDestination();
                await this.loadModelInfo();
            })})));
        } else {
            const items = [...this.conversations].sort((a, b) => b.updated.localeCompare(a.updated)).map(c => ({
                label: `${c.title} · ${new Date(c.updated).toLocaleDateString()}`,
                action: () => this.run(() => { close(); return this.openConversation(c); }),
                remove: () => this.view.confirm(`Delete “${c.title}” and its unreferenced images?`, () => this.run(async () => {
                    this.assertIdle();
                    for (const message of c.messages)
                        this.view.setRecovery(message);
                    this.conversations = deleteConversation(this.conversations, c.id).conversations;
                    const draft = this.drafts.get(c.id);
                    for (const id of draft?.attachments ?? [])
                        this.store.reserved.delete(id);
                    for (const id of c.messages.flatMap(m => m.attachments))
                        this.store.reserved.delete(id);
                    this.drafts.delete(c.id);
                    if (this.current.id === c.id)
                        this.makeChat();
                    await this.persist();
                    close();
                })),
            }));
            items.push({label: 'Delete all history…', action: () => this.view.confirm('Permanently delete all saved conversations, drafts and retained images?', () => this.run(() => this.deleteAll()))});
            this.view.choices(items);
        }
    }

    async openConversation(c, allowDestinationChange = false) {
        this.assertIdle();
        const connection = this.connections.find(conn => conn.id === c.connectionId);
        if (!connection)
            throw new Error('This conversation’s connection was removed. Restore that connection identity or start a new chat.');
        if (connection.url !== c.url && !allowDestinationChange) {
            this.view.confirm(`The server changed from ${c.url} to ${connection.url}. Copy this conversation to the new destination? Its text and images will be sent there only when you press Send.`,
                () => this.run(() => this.openConversation(c, true)));
            return;
        }
        this.rememberDraft();
        if (connection.url !== c.url) {
            if (this.conversations.length >= LIMITS.conversations)
                throw new Error('Delete an older conversation before copying this one.');
            const draft = this.drafts.get(c.id);
            c = {...c, id: GLib.uuid_string_random(), url: connection.url, messages: c.messages.map(m => ({...m, attachments: [...m.attachments]}))};
            if (draft)
                this.drafts.set(c.id, {...draft, attachments: [...draft.attachments]});
            this.conversations.push(c);
        }
        this.current = c;
        this.connection = connection;
        this.selectedModel = c.model;
        const draft = this.drafts.get(c.id);
        this.attachments = draft?.attachments ?? [];
        this.view.entry.set_text(draft?.text ?? '');
        this.view.resetSearch();
        this.render();
        this.updateDestination();
        await this.refresh();
    }

    async deleteAll() {
        this.assertIdle();
        this.conversations = [];
        this.view.recoveries.clear();
        this.drafts.clear();
        this.attachments = [];
        this.store.reserved.clear();
        await this.store.reset();
        if (!this.alive)
            return;
        this.makeChat();
        this.view.chooser.hide();
        this.status('All history deleted.');
    }

    async historyPreference() {
        if (!this.ready)
            return;
        // Turning persistence off removes disk conversations, but keeps this session in memory.
        await this.persist();
        this.status(this.settings.get_boolean('persistent-history') ? 'Persistent history enabled.' : 'Persistent history disabled. Session chats stay in memory; draft/current images remain in private temporary storage until disabled.');
    }

    async persist() {
        if (!this.ready || !this.alive || this.store.readOnly)
            return;
        if (this.saving) {
            this.saveAgain = true;
            return;
        }
        this.saving = true;
        try {
            do {
                this.saveAgain = false;
                const persistent = this.settings.get_boolean('persistent-history');
                // In nonpersistent mode retain images needed by the live session only.
                const retained = [...this.drafts.values()].flatMap(d => d.attachments).concat(this.attachments,
                    persistent ? [] : this.conversations.flatMap(c => c.messages.flatMap(m => m.attachments)));
                await this.store.save(persistent ? this.conversations : [], retained);
            } while (this.saveAgain && this.alive);
        } catch (error) {
            this.status(`Could not save local history: ${error.message}`);
        } finally {
            this.saving = false;
        }
    }

    async attach(kind) {
        this.assertIdle();
        if (this.attachments.length >= LIMITS.images)
            throw new Error('At most four images can be attached per message.');
        this.imageBusy = true;
        this.view.setBusy(false, true);
        this.status(kind === 'capture' ? 'Choose Selection in the GNOME screenshot dialog. Escape cancels.' : 'Preparing image…');
        let captureFile = null;
        try {
            let bytes;
            if (kind === 'paste') {
                bytes = await clipboardImage(global.display.get_selection(), Meta.SelectionType.SELECTION_CLIPBOARD, this.cancel);
            } else {
                this.view.panel.menu.close({animate: false});
                const result = kind === 'capture' ? await this.portals.screenshot() : await this.portals.chooseFile();
                const value = kind === 'capture' ? result.uri : result.uris;
                const unpacked = value?.deep_unpack ? value.deep_unpack() : value;
                const uri = kind === 'capture' ? unpacked : unpacked?.[0];
                if (!uri)
                    throw new Error('Desktop portal returned no image.');
                if (kind === 'capture')
                    captureFile = Gio.File.new_for_uri(uri);
                if (!this.alive)
                    return;
                bytes = await imageFromFile(uri, this.cancel);
            }
            const prepared = await prepareImage(bytes, this.cancel);
            if (!this.alive)
                return;
            const id = await this.store.addImage(prepared);
            if (!this.alive)
                return;
            this.attachments.push(id);
            this.rememberDraft();
            this.renderAttachments();
            this.status('Image attached. Review it, then press Send.');
            this.view.panel.menu.open();
        } finally {
            if (captureFile?.is_native()) {
                try {
                    await removeFile(captureFile, null);
                } catch {
                    // The portal may already have removed its temporary screenshot.
                }
            }
            this.imageBusy = false;
            if (this.alive) {
                this.view.setBusy(Boolean(this.generation));
                if (this.pendingConnections)
                    await this.loadConnections();
            }
        }
    }

    async openSource(url) {
        const safe = sourceUrl(url);
        this.view.panel.menu.close();
        await new Promise((resolve, reject) => {
            Gio.AppInfo.launch_default_for_uri_async(safe, global.create_app_launch_context(0, -1), this.cancel, (_source, result) => {
                try {
                    resolve(Gio.AppInfo.launch_default_for_uri_finish(result));
                } catch {
                    reject(new Error('Could not open the source in your default browser.'));
                }
            });
        });
    }

    async send(allowUnknown = false, allowMoved = false, search = null) {
        if (this.generation) {
            this.generation.stopped = true;
            this.generation.cancel.cancel();
            this.status('Stopping…');
            return;
        }
        this.assertIdle();
        // Snapshot the opt-in and explicit query before any confirmation or asynchronous work.
        if (search === null)
            search = {enabled: this.view.search.checked, query: this.view.query.get_text()};
        if (!this.connection || !this.models.some(m => m.name === this.selectedModel))
            throw new Error('Select an available model. Refresh to reconnect to Ollama.');
        if (this.current.url !== this.connection.url && this.current.messages.length && !allowMoved) {
            return this.view.confirm(`The endpoint changed from ${this.current.url} to ${this.connection.url}. Copy this chat to that server?`, () => this.run(async () => {
                await this.openConversation(this.current, true);
                if (this.alive)
                    await this.send(allowUnknown, true, search);
            }));
        }
        const text = this.view.entry.get_text().trim();
        if (!text && !this.attachments.length)
            return;
        if (search.enabled)
            search = {...search, query: searchQuery(text, search.query)};
        if (this.current.messages.length + 2 > LIMITS.messages)
            throw new Error('This chat reached 200 messages. Start a new chat.');
        if (!this.conversations.includes(this.current) && this.conversations.length >= LIMITS.conversations)
            throw new Error('History reached 50 conversations. Delete an older chat.');
        const user = {role: 'user', content: text, attachments: [...this.attachments], state: 'complete'};
        const context = selectContext([...this.current.messages, user]);
        const hasImages = context.messages.some(m => m.attachments.length);
        const vision = visionCapability(this.info);
        if (hasImages && vision === false)
            throw new Error('This model reports no vision support. Remove images or choose a vision model for a new chat.');
        if (hasImages && vision === null && !allowUnknown)
            return this.view.confirm('Vision capability is unknown because model discovery is unavailable. Explicitly attempt to send these images to the selected server/model?', () => this.run(() => this.send(true, false, search)));
        const assistant = {role: 'assistant', content: '', attachments: [], state: 'generating'};
        const generation = {assistant, user, search, allowUnknown, context, allMessages: [...this.current.messages, user],
            conversation: this.current, model: this.selectedModel, url: this.connection.url, info: this.info};
        this.current.model = this.selectedModel;
        this.current.url = this.connection.url;
        this.current.connectionId = this.connection.id;
        this.current.messages.push(user, assistant);
        this.current.updated = new Date().toISOString();
        if (!this.conversations.includes(this.current))
            this.conversations.push(this.current);
        if (this.current.messages.length === 2)
            this.current.title = text.replace(/\s+/g, ' ').slice(0, 70) || 'Image conversation';
        this.view.entry.set_text('');
        this.attachments = [];
        this.drafts.delete(this.current.id);
        this.view.chooser.hide();
        this.render();
        await this.generate(generation);
    }

    async retrySearch(previous, enabled) {
        this.assertIdle();
        if (this.current !== previous.conversation || !this.current.messages.includes(previous.assistant))
            throw new Error('Open the original conversation before retrying this response.');
        await this.generate({...previous, search: {...previous.search, enabled}});
    }

    async generate(generation) {
        const {assistant, search} = generation;
        this.discoveryCancel?.cancel();
        this.discoveryId++;
        generation.cancel = new Gio.Cancellable();
        generation.stopped = false;
        generation.size = 0;
        generation.source = 0;
        generation.lastSave = Date.now();
        assistant.state = 'generating';
        assistant.content = '';
        delete assistant.sources;
        assistant.webNote = !search.enabled && generation.searchAttempted ? 'Answered without web search at your request.' : '';
        assistant.phase = search.enabled ? 'Searching the web…' : 'Generating answer…';
        this.generation = generation;
        this.view.setRecovery(assistant);
        this.view.updateMessage(assistant);
        this.view.setBusy(true);
        let context = generation.context;
        this.status(search.enabled ? 'Searching the web…' : context.omitted ? `Older context omitted: sending ${context.messages.length} recent messages only.` : 'Waiting for Ollama (model loading can take several minutes)…');
        this.run(() => this.persist());
        let retrieving = search.enabled;
        try {
            if (search.enabled) {
                generation.searchAttempted = true;
                const retrieval = await this.web.retrieve(search.query, generation.cancel, phase => {
                    if (this.alive && this.generation === generation) {
                        assistant.phase = phase;
                        this.status(phase);
                        this.view.updateMessage(assistant);
                    }
                });
                if (!this.alive || generation.cancel.is_cancelled())
                    throw new Error('Request stopped.');
                const now = GLib.DateTime.new_now_local();
                context = webContext(generation.allMessages, retrieval, `${now.format('%Y-%m-%d %H:%M:%S %z')} (${GLib.TimeZone.new_local().get_identifier()})`);
                assistant.sources = context.sources;
                assistant.webNote = retrieval.note;
                retrieving = false;
                assistant.phase = 'Generating answer…';
                this.view.updateMessage(assistant);
                this.status(`Generating answer…${retrieval.note ? ` ${retrieval.note}` : ''}${context.omitted ? ` ${context.omitted} older messages omitted from context.` : ''}`);
            }
            const messages = await requestImages(this.store, context.messages, generation.cancel);
            if (!this.alive || generation.cancel.is_cancelled())
                throw new Error('Request stopped.');
            if (context.system)
                messages.unshift({role: 'system', content: context.system});
            const request = buildRequest(generation.model, messages, generation.info, generation.allowUnknown);
            await this.client.request(generation.url, '/api/chat', request, generation.cancel, record => {
                if (!this.alive || this.generation !== generation)
                    return;
                const content = record.message?.content ?? '';
                generation.size += new TextEncoder().encode(content).length;
                if (generation.size > LIMITS.response)
                    throw new Error('Answer reached the 128 KiB response limit.');
                assistant.content += content;
                if (record.message?.thinking && !assistant.content)
                    this.status('Model is preparing an answer. Separate thinking output is not retained.');
                if (!generation.source) {
                    generation.source = this.later(100, () => {
                        generation.source = 0;
                        this.view.updateMessage(assistant);
                        if (Date.now() - generation.lastSave > 2000) {
                            generation.lastSave = Date.now();
                            this.run(() => this.persist());
                        }
                    });
                }
            });
            if (!this.alive)
                return;
            if (!assistant.content && !generation.stopped)
                throw new Error('The model returned no answer content. Separate thinking and tool calls are not displayed or executed.');
            assistant.state = generation.stopped ? 'interrupted' : 'complete';
            this.status(`Finished.${context.omitted ? ` ${context.omitted} older messages were omitted from context.` : ''}${assistant.webNote ? ` ${assistant.webNote}` : ''}`);
        } catch (error) {
            assistant.state = generation.stopped || !this.alive ? 'interrupted' : 'failed';
            this.status(error.message);
            if (retrieving && !generation.stopped && this.alive) {
                assistant.webNote = 'Web search failed; no researched answer was generated. Retry explicitly or answer without web search.';
                this.view.setRecovery(assistant,
                    () => this.run(() => this.retrySearch(generation, true)),
                    () => this.run(() => this.retrySearch(generation, false)));
            }
        } finally {
            if (generation.source) {
                GLib.Source.remove(generation.source);
                this.sources.delete(generation.source);
                generation.source = 0;
            }
            if (this.generation === generation)
                this.generation = null;
            if (this.alive) {
                this.view.updateMessage(assistant, true);
                this.view.setBusy(false);
                await this.persist();
                if (this.alive && this.pendingConnections)
                    await this.loadConnections();
            }
        }
    }

    later(delay, callback) {
        const id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, () => {
            this.sources.delete(id);
            if (this.alive)
                callback();
            return GLib.SOURCE_REMOVE;
        });
        this.sources.add(id);
        return id;
    }

    destroy() {
        this.alive = false;
        // Delete only session-owned temporary images, never committed chat images.
        // File deletion can finish without Shell UI or an extension main-loop source.
        const persistent = this.settings.get_boolean('persistent-history');
        const retained = persistent ? attachmentIds(this.conversations) : new Set();
        const temporary = new Set([...this.store.reserved, ...(!persistent ? attachmentIds(this.conversations) : [])]);
        for (const id of temporary) {
            if (!retained.has(id))
                removeFile(this.store.imageFile(id), null).catch(() => {});
        }
        if (this.generation) {
            this.generation.assistant.state = 'interrupted';
            this.generation.cancel.cancel();
        }
        this.cancel.cancel();
        this.discoveryCancel?.cancel();
        this.client.destroy();
        this.web.destroy();
        this.portals.destroy();
        this.settings.disconnect(this.changed);
        Main.wm.removeKeybinding('toggle-shortcut');
        for (const source of this.sources)
            GLib.Source.remove(source);
        this.sources.clear();
        if (this.generation)
            this.generation.source = 0;
        this.view.destroy();
        this.drafts.clear();
        this.store.reserved.clear();
        this.conversations = [];
        this.attachments = [];
        this.current = null;
    }
}

export default class AiPopDownExtension extends Extension {
    enable() {
        this.controller = new ChatController(this);
    }

    disable() {
        this.controller?.destroy();
        this.controller = null;
    }
}
