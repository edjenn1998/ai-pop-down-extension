// SPDX-License-Identifier: GPL-3.0-or-later
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Pango from 'gi://Pango';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {inlineMarkup, markdownBlocks} from './core.js';

class ChatPopupMenu extends PopupMenu.PopupMenu {
    open(params = {}) {
        const opened = super.open(params);
        // open-state-changed runs before mapping and initial menu key navigation.
        if (opened)
            this.focusActor.grab_key_focus();
        return opened;
    }
}

const ChatIndicator = GObject.registerClass(class ChatIndicator extends PanelMenu.Button {
    _onMenuKeyPress() {
        // PanelMenu normally reserves Left/Right for switching top-bar menus.
        if (global.stage.get_key_focus() instanceof Clutter.Text)
            return Clutter.EVENT_PROPAGATE;
        return super._onMenuKeyPress();
    }
});

export function box(style = '', vertical = false) {
    return new St.BoxLayout({style_class: style, orientation: vertical ? Clutter.Orientation.VERTICAL : Clutter.Orientation.HORIZONTAL});
}

export function textLabel(text, style = '', selectable = false) {
    const label = new St.Label({text, style_class: style, x_expand: true, reactive: selectable, can_focus: selectable});
    label.clutter_text.set_line_wrap(true);
    label.clutter_text.set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);
    label.clutter_text.set_ellipsize(Pango.EllipsizeMode.NONE);
    label.clutter_text.set_selectable(selectable);
    return label;
}

export class ChatView {
    constructor(extension, callbacks) {
        this.callbacks = callbacks;
        this.panel = new ChatIndicator(0.5, 'AI Pop Down Extension');
        this.panel.setMenu(new ChatPopupMenu(this.panel, 0.5, St.Side.TOP));
        this.panel.add_child(new St.Icon({gicon: Gio.icon_new_for_string(`${extension.path}/icons/ai-pop-down-symbolic.svg`), style_class: 'system-status-icon'}));
        this.tooltip = new St.Label({style_class: 'dash-label', visible: false});
        Main.uiGroup.add_child(this.tooltip);
        this.tip(this.panel, 'AI Pop Down Extension');
        this.root = box('ai-chat', true);
        this.panel.menu.box.add_child(this.root);
        this.header = box('ai-row');
        this.connection = this.button('This Computer', 'Choose connection', () => callbacks.choose('connections'));
        this.connection.x_expand = true;
        this.header.add_child(this.connection);
        this.header.add_child(this.icon('document-new-symbolic', 'New Chat', callbacks.newChat));
        this.header.add_child(this.icon('document-open-recent-symbolic', 'Conversation history', () => callbacks.choose('history')));
        this.header.add_child(this.icon('emblem-system-symbolic', 'Preferences', callbacks.preferences));
        this.root.add_child(this.header);
        const models = box('ai-row');
        this.model = this.button('Select model', 'Choose model', () => callbacks.choose('models'));
        this.model.x_expand = true;
        models.add_child(this.model);
        models.add_child(this.icon('view-refresh-symbolic', 'Refresh models', callbacks.refresh));
        this.root.add_child(models);
        this.chooserBox = box('ai-choices', true);
        this.chooser = new St.ScrollView({child: this.chooserBox, visible: false, style_class: 'ai-chooser',
            hscrollbar_policy: St.PolicyType.NEVER, vscrollbar_policy: St.PolicyType.AUTOMATIC});
        this.root.add_child(this.chooser);
        this.confirmBox = box('ai-confirm', true);
        this.confirmBox.hide();
        this.root.add_child(this.confirmBox);
        this.messages = box('ai-messages', true);
        this.scroll = new St.ScrollView({child: this.messages, x_expand: true, y_expand: true,
            hscrollbar_policy: St.PolicyType.NEVER, vscrollbar_policy: St.PolicyType.AUTOMATIC, overlay_scrollbars: true});
        this.root.add_child(this.scroll);
        this.follow = true;
        this.adjustment = this.scroll.vadjustment;
        this.adjustmentSignals = [this.adjustment.connect('notify::value', () => {
            this.follow = this.nearBottom();
            this.jump.visible = !this.follow;
        }), this.adjustment.connect('changed', () => {
            if (this.follow)
                this.bottom();
            else
                this.jump.show();
        })];
        this.jump = this.button('↓ Jump to latest', 'Jump to latest', () => this.bottom());
        this.jump.hide();
        this.root.add_child(this.jump);
        this.status = textLabel('Loading…', 'ai-status');
        this.root.add_child(this.status);
        this.attachments = box('ai-row');
        this.root.add_child(this.attachments);
        this.entry = new St.Entry({hint_text: 'Message Ollama…', accessible_name: 'Message draft', can_focus: true, x_expand: true, style_class: 'ai-input'});
        this.entry.clutter_text.set_single_line_mode(false);
        this.entry.clutter_text.set_activatable(false);
        this.entry.clutter_text.set_line_wrap(true);
        this.entry.clutter_text.set_max_length(24000);
        this.panel.menu.focusActor = this.entry.clutter_text;
        // St.Entry centers its text actor; clicks in the surrounding padding
        // need focus too. Do not claim a gesture or replace native text selection.
        this.entry.connect('captured-event', (_entry, event) => {
            if (event.type() === Clutter.EventType.BUTTON_PRESS && event.get_button() === Clutter.BUTTON_PRIMARY)
                this.entry.clutter_text.grab_key_focus();
            return Clutter.EVENT_PROPAGATE;
        });
        const keys = new Clutter.KeyController();
        keys.connect('key-press', controller => {
            const [, symbol] = controller.get_key();
            const [, pressed, latched] = controller.get_state();
            if ((symbol === Clutter.KEY_Return || symbol === Clutter.KEY_KP_Enter) &&
                !((pressed | latched) & Clutter.ModifierType.SHIFT_MASK)) {
                callbacks.send();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });
        this.entry.clutter_text.add_action_full('ai-composer-keys', Clutter.EventPhase.CAPTURE, keys);
        this.root.add_child(this.entry);
        const actions = box('ai-row');
        this.file = this.icon('mail-attachment-symbolic', 'Attach image file', () => callbacks.attach('file'));
        this.paste = this.icon('edit-paste-symbolic', 'Paste image explicitly from clipboard', () => callbacks.attach('paste'));
        this.capture = this.icon('camera-photo-symbolic', 'Capture screen region — choose Selection in the screenshot dialog', () => callbacks.attach('capture'));
        actions.add_child(this.file);
        actions.add_child(this.paste);
        actions.add_child(this.capture);
        actions.add_child(new St.Widget({x_expand: true}));
        this.send = this.button('Send', 'Send message / Stop generating', callbacks.send);
        actions.add_child(this.send);
        this.root.add_child(actions);
        this.destination = textLabel('', 'ai-destination');
        this.root.add_child(this.destination);
        this.panel.menu.connect('open-state-changed', (_menu, open) => {
            this.tooltip.hide();
            if (open) {
                callbacks.open();
            }
        });
        Main.panel.addToStatusArea(extension.uuid, this.panel);
        this.rows = new Map();
    }

    tip(actor, text) {
        actor.accessible_name = text;
        actor.track_hover = true;
        actor.connect('notify::hover', () => {
            this.tooltip.hide();
            if (!actor.hover)
                return;
            this.tooltip.text = text;
            const [x, y] = actor.get_transformed_position();
            const [w, h] = actor.get_transformed_size();
            const monitor = Main.layoutManager.findMonitorForActor(actor) ?? Main.layoutManager.primaryMonitor;
            if (!monitor)
                return;
            const [, naturalWidth] = this.tooltip.get_preferred_width(-1);
            this.tooltip.set_position(Math.max(monitor.x + 4, Math.min(x + w / 2 - naturalWidth / 2, monitor.x + monitor.width - naturalWidth - 4)), y + h + 6);
            this.tooltip.show();
        });
        actor.connect('destroy', () => this.tooltip.hide());
    }

    button(label, tip, callback) {
        const actor = new St.Button({label, style_class: 'button ai-button', can_focus: true, x_align: Clutter.ActorAlign.FILL});
        actor.connect('clicked', callback);
        this.tip(actor, tip);
        return actor;
    }

    icon(name, tip, callback) {
        const actor = this.button('', tip, callback);
        actor.set_child(new St.Icon({icon_name: name, icon_size: 16}));
        return actor;
    }

    size(settings) {
        const monitor = Main.layoutManager.findMonitorForActor(this.panel) ?? Main.layoutManager.primaryMonitor;
        if (!monitor)
            return;
        const area = Main.layoutManager.getWorkAreaForMonitor(monitor.index);
        const scale = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        const width = Math.max(240, Math.min(settings.get_int('popup-width'), area.width / scale - 40));
        const height = Math.max(260, Math.min(settings.get_int('popup-height'), area.height / scale - 40));
        this.root.set_style(`width: ${Math.floor(width)}px; height: ${Math.floor(height)}px;`);
        this.panel.menu.actor.set_style(`max-width: ${Math.floor(area.width / scale - 8)}px; max-height: ${Math.floor(area.height / scale - 8)}px;`);
    }

    nearBottom() {
        const a = this.adjustment;
        return a.upper - a.page_size - a.value < 48;
    }

    bottom() {
        this.follow = true;
        this.adjustment.value = Math.max(this.adjustment.lower, this.adjustment.upper - this.adjustment.page_size);
        this.jump.hide();
    }

    setBusy(busy, imageBusy = false) {
        this.send.label = busy ? 'Stop' : 'Send';
        for (const button of [this.connection, this.model, this.file, this.paste, this.capture]) {
            button.reactive = !busy && !imageBusy;
            button.can_focus = button.reactive;
        }
        this.send.reactive = !imageBusy;
    }

    choices(items) {
        this.chooserBox.destroy_all_children();
        for (const item of items) {
            const row = box('ai-row');
            const open = this.button(item.label, item.label, item.action);
            open.x_expand = true;
            row.add_child(open);
            if (item.remove)
                row.add_child(this.icon('user-trash-symbolic', `Delete ${item.label}`, item.remove));
            this.chooserBox.add_child(row);
        }
        this.chooser.show();
    }

    confirm(message, action) {
        this.confirmBox.destroy_all_children();
        this.confirmBox.add_child(textLabel(message));
        const row = box('ai-row');
        row.add_child(this.button('Cancel', 'Cancel', () => this.confirmBox.hide()));
        row.add_child(this.button('Confirm', 'Confirm action', () => {
            this.confirmBox.hide();
            action();
        }));
        this.confirmBox.add_child(row);
        this.confirmBox.show();
    }

    render(conversation, store) {
        this.messages.destroy_all_children();
        this.rows.clear();
        if (!conversation?.messages.length) {
            this.messages.add_child(textLabel('A little room for a big idea', 'ai-welcome'));
            this.messages.add_child(textLabel('Choose your Ollama model, then ask a question. Images stay in the draft until you press Send.', 'ai-status'));
        }
        for (const m of conversation?.messages ?? []) {
            const row = box(`ai-message ${m.role === 'user' ? 'ai-user' : 'ai-assistant'}`, true);
            const heading = box('ai-row');
            heading.add_child(textLabel(m.role === 'user' ? 'You' : 'Assistant', 'ai-role'));
            if (m.role === 'assistant')
                heading.add_child(this.icon('edit-copy-symbolic', 'Copy entire answer', () => this.copy(m.content)));
            row.add_child(heading);
            if (m.attachments.length) {
                const images = box('ai-row');
                for (const id of m.attachments)
                    images.add_child(new St.Icon({gicon: new Gio.FileIcon({file: store.imageFile(id)}), icon_size: 56, accessible_name: 'Attached image'}));
                row.add_child(images);
            }
            const body = box('ai-body', true);
            row.add_child(body);
            const state = textLabel('', 'ai-status');
            row.add_child(state);
            this.messages.add_child(row);
            this.rows.set(m, {body, state});
            this.updateMessage(m, m.state !== 'generating');
        }
        this.bottom();
    }

    updateMessage(message, markdown = false) {
        const row = this.rows.get(message);
        if (!row)
            return;
        if (!markdown && row.plain) {
            row.plain.text = message.content || 'Waiting for an answer…';
        } else {
            row.body.destroy_all_children();
            row.plain = null;
            if (!markdown) {
                row.plain = textLabel(message.content || 'Waiting for an answer…', '', true);
                row.body.add_child(row.plain);
            } else {
                // Avoid creating thousands of actors from a deliberately fragmented reply.
                const blocks = markdownBlocks(message.content);
                if (blocks.length > 200) {
                    row.body.add_child(textLabel(message.content, '', true));
                } else {
                    for (const block of blocks) {
                        const label = textLabel(block.text, block.type === 'code' ? 'ai-code' : block.type === 'heading' ? 'ai-heading' : '', true);
                        if (block.type !== 'code')
                            label.clutter_text.set_markup(inlineMarkup(block.text));
                        row.body.add_child(label);
                        if (block.type === 'code')
                            row.body.add_child(this.button('Copy code', 'Copy code block', () => this.copy(block.text)));
                    }
                }
            }
        }
        row.state.text = message.state === 'generating' ? 'Generating…'
            : message.state === 'interrupted' ? 'Interrupted — partial answer retained'
                : message.state === 'failed' ? 'Failed — partial answer retained' : '';
    }

    renderAttachments(ids, store, remove) {
        this.attachments.destroy_all_children();
        ids.forEach((id, index) => {
            const row = box('ai-row');
            row.add_child(new St.Icon({gicon: new Gio.FileIcon({file: store.imageFile(id)}), icon_size: 48, accessible_name: `Draft image ${index + 1}`}));
            row.add_child(this.icon('window-close-symbolic', `Remove image ${index + 1}`, () => remove(id)));
            this.attachments.add_child(row);
        });
    }

    copy(text) {
        St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD, text);
        this.status.text = 'Copied to clipboard.';
    }

    destroy() {
        for (const id of this.adjustmentSignals)
            this.adjustment.disconnect(id);
        this.panel.destroy();
        this.tooltip.destroy();
        this.rows.clear();
    }
}
