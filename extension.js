// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 AI Pop Down Extension contributors
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
