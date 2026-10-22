// SPDX-License-Identifier: GPL-3.0-or-later
import {validateSearchKey} from './webCore.js';

// Lazy loading keeps ordinary chat functional if Secret introspection is absent.
export async function searchCredential(action, cancellable, value = '') {
    try {
        const {default: Secret} = await import('gi://Secret?version=1');
        if (cancellable.is_cancelled())
            throw new Error('Cancelled');
        const schema = Secret.Schema.new('org.gnome.shell.extensions.ai-pop-down.WebSearch', Secret.SchemaFlags.NONE,
            {purpose: Secret.SchemaAttributeType.STRING});
        const attributes = {purpose: 'ollama-web-search'};
        const call = (method, finish, args) => new Promise((resolve, reject) => {
            Secret[method](...args, (_source, result) => {
                try {
                    resolve(Secret[finish](result));
                } catch {
                    reject(new Error('Secret Service failed. Unlock your login keyring in Passwords and Keys, then retry. No plaintext fallback is used.'));
                }
            });
        });
        if (action === 'save') {
            const saved = await call('password_store', 'password_store_finish', [schema, attributes, Secret.COLLECTION_DEFAULT,
                'AI Pop Down — Ollama web search', validateSearchKey(value), cancellable]);
            if (!saved)
                throw new Error('Secret Service did not save the key. Unlock your login keyring and retry.');
            return true;
        }
        if (action === 'remove') {
            // Lookup may unlock the matching item before password_clear, which clears unlocked items.
            await call('password_lookup', 'password_lookup_finish', [schema, attributes, cancellable]);
            return await call('password_clear', 'password_clear_finish', [schema, attributes, cancellable]);
        }
        if (action !== 'lookup')
            throw new Error('Unsupported credential action.');
        const key = await call('password_lookup', 'password_lookup_finish', [schema, attributes, cancellable]);
        if (!key)
            throw new Error('No search API key is available. Unlock your keyring and save a key in Preferences → Web Search.');
        return validateSearchKey(key);
    } catch (error) {
        if (cancellable.is_cancelled())
            throw new Error('Search credential operation cancelled.');
        if (error.message.startsWith('Secret Service') || error.message.startsWith('No search') || error.message.startsWith('Enter a valid'))
            throw error;
        throw new Error('Secret Service is unavailable. Use a GNOME session with an unlocked login keyring and libsecret support. No plaintext fallback is used.');
    }
}
