// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 AI Pop Down Extension contributors
// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import {ChatController} from './lib/chatController.js';

export default class AiPopDownExtension extends Extension {
    enable() {
        this.controller = new ChatController(this);
    }

    disable() {
        this.controller?.destroy();
        this.controller = null;
    }
}
