# AI Pop Down Extension

Chat with Ollama from a small dropdown in your GNOME top bar. For example: click the chat icon, select a model, type **“Help me write a short email”**, and press **Send**. The answer appears in the dropdown as it is generated.

This extension is an **Ollama client**. It does not contain an AI model, install Ollama, download models, or start a server for you.

- **Chat:** your chosen Ollama server and model generate the answer. The server can be this computer or another computer on your home network.
- **Optional web search:** Ollama's hosted search service supplies recent information, then your chosen model writes the answer. Search has a separate API key and is off by default.

**v0.2.1 is a prerelease for GNOME Shell 51.** Chat and web search have been reported working by the owner. The build environment has no GNOME Shell/GJS, so the new source-disclosure behavior still needs desktop testing. See [validation details](docs/VALIDATION.md). No fabricated screenshots are used.

## Start here

1. [Check requirements](#requirements).
2. [Install the extension](#install-the-extension).
3. Pick one setup path: [Ollama on this computer](#path-1-ollama-on-the-same-computer) or [Ollama on another home-network computer](#path-2-ollama-on-another-home-network-computer).
4. Try ordinary chat first. Then, if wanted, [set up web search](#set-up-optional-web-search).

## Requirements

On the **GNOME computer where you use the dropdown**:

- **GNOME Shell 51**. Other GNOME versions are not declared supported. The intended desktop is CachyOS GNOME 51.1 on Wayland.
- The desktop's GJS, St/Clutter, Gio/GLib, Soup 3 and GdkPixbuf 2 libraries; GTK4/libadwaita for the separate preferences window.
- The desktop portal and its GNOME backend for file choice and interactive screenshots.
- For optional search only: libsecret's `Secret 1` introspection support and an available, unlocked **Secret Service**, normally GNOME Keyring.

These are native desktop components, not a companion web app or background service. The installed extension does not need Python, Node.js or npm. If a desktop component is missing, consult your distribution's GNOME documentation; the extension does not install packages automatically.

You also need an **existing Ollama installation with at least one available chat model**, either on this computer or another computer you can reach. If a remote server provides the AI, **your laptop does not need to store or run a model**. For Ollama itself, use the [official download/setup instructions](https://ollama.com/download).

To check the GNOME version, run this in a terminal **on the GNOME computer**:

```sh
gnome-shell --version
```

Commands below say where to run them. Commands beginning with `sudo` change the specified computer's system configuration and may ask for your administrator password. Do not run server commands on the laptop unless it is also your Ollama server.

## Install the extension

Do this **on the GNOME computer**, logged into your normal desktop account, without `sudo`.

1. Open the project's [Releases page](https://github.com/edjenn1998/ai-pop-down-extension/releases).
2. Open the newest suitable prerelease and expand **Assets**. Download exactly:

   **`ai-pop-down-extension@edjenn1998.github.io.shell-extension.zip`**

   GitHub's **“Source code (zip)” is a different download** and is not the installable extension. `SHA256SUMS` is provided if you want to check the download's checksum.
3. If your browser saved the file in `Downloads`, run:

   ```sh
   gnome-extensions install "$HOME/Downloads/ai-pop-down-extension@edjenn1998.github.io.shell-extension.zip"
   ```

   If you saved it elsewhere, replace the quoted path with that file's actual path. Keep quotes around paths with spaces.
4. **Log out and log back in** if GNOME does not discover the new extension. On Wayland, logout/login is also the reliable way to load changed extension code; the `Alt+F2`, `r` Shell restart method is not available there. Save your work before logging out.
5. Enable the extension:

   ```sh
   gnome-extensions enable ai-pop-down-extension@edjenn1998.github.io
   ```

   If the GNOME **Extensions** application is installed, you can instead find **AI Pop Down Extension** there after installation and switch it on. The command above is the installation-independent way to enable it; simply opening the ZIP in an archive manager does not install it.
6. Open its settings:

   ```sh
   gnome-extensions prefs ai-pop-down-extension@edjenn1998.github.io
   ```

   You can also click the chat icon in the top bar and then the **Preferences** gear button. Hover over icon buttons to read their tooltips.

The UUID in these commands is the extension's identifier. These releases are distributed through GitHub; the project has not been submitted to extensions.gnome.org.

## Path 1: Ollama on the same computer

Here the GNOME computer also runs Ollama. The default connection is **This Computer**, at **`http://localhost:11434`**.

### 1. Check Ollama before opening the extension

Run these **on the computer running Ollama**:

```sh
ollama ls
```

This lists available models. Keep one of the exact names/tags for later. If the list is empty, use Ollama's own app or [CLI model-download instructions](https://docs.ollama.com/cli) to choose and obtain a model that fits your hardware. The extension's model selector does not download models.

Test the HTTP connection, also on this computer:

```sh
curl --connect-timeout 5 --max-time 15 http://localhost:11434/api/tags
```

**Success looks like JSON containing a `models` array.** `{"models":[]}` means the server is reachable but has no models available. You do not need to post this output or any chat content publicly.

If you use the **Linux systemd Ollama service**, check it with:

```sh
systemctl is-active ollama.service
```

`active` means the service is running. If it is installed but inactive and you want to start it:

```sh
sudo systemctl start ollama.service
```

If Ollama was installed another way, start its app or follow its own startup instructions. Do not launch a second `ollama serve` process over an already-running service. `curl` is only a diagnostic tool; the extension does not depend on it.

### 2. Configure the extension

On the **GNOME computer**:

1. Open **Preferences** and scroll to **Ollama connections**.
2. In **This Computer**, leave **Server base URL (HTTP or HTTPS origin)** as `http://localhost:11434`.
3. Leave **Default model** empty to initially use the first available model, or enter an exact name returned by `ollama ls`.
4. Click **Save**, then **Test Connection**. Expect **Connected — … models available**.
5. Open the top-bar dropdown. Click the connection selector and choose **This Computer**.
6. Click the model selector, choose an available model, type a short question and press **Send**. Use the refresh button if the model list has changed.

## Path 2: Ollama on another home-network computer

- **Server:** the computer running Ollama and its model, for example your EVO-X2.
- **Client:** the GNOME computer running this extension, for example your laptop.

**`localhost` and `127.0.0.1` always mean the computer on which they are used.** Entering `localhost` in the laptop's extension settings points at the laptop, not the server.

### 1. Find the server's real LAN address

Run these **on the server**, not the client:

```sh
hostname -I
ip -brief -4 address
ip -4 route
```

`hostname -I` may show several addresses. Use the address of the server's active **home Ethernet or Wi-Fi interface**, as confirmed by network settings, the router's device list and `ip` output. Physical interface names often start with `en` or `wl`. Do not choose an address attached only to `docker0`, a Docker `br-…` bridge, loopback or an unrelated VPN. Do not choose purely by the numbers: some real LANs also use addresses starting with `172`.

**Example only — replace with your real output:** if the server has `192.168.1.50` on Ethernet and `172.17.0.1` on `docker0`, use `192.168.1.50`. A router **DHCP reservation** can keep the server's LAN address stable after reboots.

On the **server**, set a terminal variable for later tests. This value is an **example only; replace it before running**:

```sh
SERVER_IP="192.168.1.50"  # EXAMPLE ONLY: replace with the server's actual LAN IPv4 address
```

Variables apply only to the terminal where you enter them; set them again if you open another terminal.

### 2. Check where Ollama is listening

On the **server**:

```sh
ss -ltn 'sport = :11434'
```

If it listens only at `127.0.0.1:11434`, other computers cannot connect. No matching listening socket usually means Ollama is not running on that port. First verify Ollama and its models locally as in Path 1.

### 3. Allow Ollama to listen on the LAN — Linux systemd installation

This subsection is specifically for a **Linux server with `ollama.service`**. It is not a command sequence for a Docker installation, macOS or Windows; use [Ollama's official configuration guide](https://docs.ollama.com/faq) for those setups.

On the **server**:

```sh
sudo systemctl edit ollama.service
```

The editor opens a service override. **Keep any existing settings and override files.** Add the following setting under `[Service]`, or change only the existing `OLLAMA_HOST` assignment if one is already present. Do not replace the whole file, use `--full`, or clear other environment settings.

This address is an **example only; replace it inside the editor** with the server's actual LAN address. Shell variables such as `$SERVER_IP` are not substituted in this setting:

```ini
[Service]
Environment="OLLAMA_HOST=192.168.1.50:11434"
```

Save and exit your editor. **Restarting Ollama interrupts active requests**, so finish other chats first. Then, on the server:

```sh
sudo systemctl daemon-reload
sudo systemctl restart ollama.service
ss -ltn 'sport = :11434'
```

Confirm it now listens on the real LAN address. Binding specifically to that address avoids listening on every interface. It may no longer accept `localhost` connections on the server itself; use its LAN address for the next tests. If another existing override wins, adjust that `OLLAMA_HOST` assignment rather than deleting unrelated overrides.

### 4. Allow access through the server's firewall

Do this **on the server**, using the firewall manager already in use. Do not disable the firewall, enable a second firewall manager, forward port 11434 on your router, or expose an unauthenticated Ollama server publicly. **Ordinary HTTP LAN traffic is not encrypted.** Use it only on a trusted network; properly trusted HTTPS is an advanced alternative.

First identify the **actual trusted LAN subnet** from `ip -4 route` or your router's LAN settings. A connected route on the physical home interface gives the network/prefix. **Example only:** a route `192.168.1.0/24 dev enp3s0 … src 192.168.1.50` means that interface's subnet is `192.168.1.0/24`. Do not assume every network is `/24`, or use a Docker/VPN route. For access from just one client, its confirmed address with `/32` is a narrower choice.

Set this in the **server terminal**, replacing the example with the subnet or client `/32` you actually trust:

```sh
LAN_SUBNET="192.168.1.0/24"  # EXAMPLE ONLY: replace with your actual trusted subnet or client /32
```

**If the server already uses UFW** (commonly Ubuntu):

```sh
sudo ufw status verbose
sudo ufw allow from "$LAN_SUBNET" to "$SERVER_IP" port 11434 proto tcp
sudo ufw status numbered
```

This allows only that source range to reach that server address/port; it does not open the port to everyone. If UFW says inactive, do not assume this enabled protection—check which firewall your distribution uses before continuing.

**If the server already uses firewalld** (available on several distributions, including some Arch/CachyOS setups):

```sh
sudo firewall-cmd --state
sudo firewall-cmd --get-active-zones
```

Find the zone attached to the physical home-network interface. Set `LAN_ZONE` to that actual zone; `home` below is **an example only**. Do not change all interface/zone assignments just to follow this guide.

```sh
LAN_ZONE="home"  # EXAMPLE ONLY: replace with the existing zone for your home-network interface
RULE="rule family=\"ipv4\" source address=\"$LAN_SUBNET\" destination address=\"$SERVER_IP\" port port=\"11434\" protocol=\"tcp\" accept"
sudo firewall-cmd --zone="$LAN_ZONE" --add-rich-rule="$RULE"
sudo firewall-cmd --permanent --zone="$LAN_ZONE" --add-rich-rule="$RULE"
sudo firewall-cmd --zone="$LAN_ZONE" --list-rich-rules
```

The two add commands apply the same restricted rule now and for future boots without reloading away unrelated runtime-only rules. These examples add an allowance, not a replacement firewall policy. Review any existing broader port allowances too. For another firewall manager, use its documentation to allow TCP 11434 only from the confirmed trusted LAN/client.

### 5. Test from the client before troubleshooting the extension

On the **GNOME client**, set the actual server address again. The address below is **an example only; replace it**:

```sh
SERVER_IP="192.168.1.50"  # EXAMPLE ONLY: replace with the server's actual LAN IPv4 address
curl --connect-timeout 5 --max-time 15 "http://${SERVER_IP}:11434/api/tags"
```

Success is **JSON listing the server's models**. If this fails, fix the server's listening address, firewall, network route or address first; changing extension settings cannot make an unreachable server reachable. Guest Wi-Fi, VPN routes or router client isolation can also block connections between devices.

### 6. Add the server to the extension

On the **GNOME client**:

1. Open **Preferences → Ollama connections → Add Connection**.
2. Give it a **Display name**, such as **EVO-X2** or **Home Server**. This name is just a label.
3. Enter `http://` + the **actual server LAN address** + `:11434` in **Server base URL (HTTP or HTTPS origin)**. The example `http://192.168.1.50:11434` is **only an example to replace**, not your server's known address.
4. Leave **Default model** empty, or enter an exact model name from the server's list.
5. Click **Save**. If a destination-change confirmation appears, check the address and confirm it. Click **Test Connection** and check the model count.
6. Open the dropdown, choose your named connection, then select one of **that server's** models. Send a short question with **Search Web: Off** first.

The extension accepts HTTP/HTTPS server origins, without embedded credentials, URL subpaths, query strings or fragments. It validates HTTPS certificates and refuses redirects. A browser-style CORS workaround such as `OLLAMA_ORIGINS=*` is not needed for this native client.

## Models, images and everyday controls

- **Choose a model:** use the dropdown model selector. Names/tags are preserved exactly; select a model already available on the selected server. Refresh reloads the list.
- **Text or images:** seeing an image requires a **vision-capable model**. A model that explicitly lacks vision is blocked from receiving images. If capability discovery fails, the extension says **unknown** and asks before an explicit attempt.
- **Attach image file:** click the paperclip button to choose a local PNG/JPEG. **Paste image:** use the paste button after explicitly copying an image, not a file icon or URL. There is no clipboard watcher.
- **Capture screen region:** click the camera button. The popup hides; choose **Selection** in GNOME's screenshot dialog and select the area. The image is attached, not automatically sent. Escape cancels without losing the draft.
- **Review and Send:** thumbnails appear before sending. Use each thumbnail's close button to remove it. You may send an image with optional text. Up to four PNG/JPEG source images are allowed, at most 10 MiB each; processed images are resized proportionally to 2048 pixels on the longest side and encoded as JPEG. Transparency is not preserved. More [limits and architecture](docs/MAINTAINER.md) are documented separately.
- **Typing:** Enter sends; Shift+Enter inserts a newline. **Stop** cancels retrieval/generation and retains a marked partial answer. Wait for cancellation to settle before another request.
- **Reading:** select text normally, or use **Copy entire answer** / **Copy code** buttons. Scrolling follows a response only near the bottom; **Jump to latest** returns there. Opening sources pauses follow so you can browse them without jumping.
- **Closing:** Escape or clicking outside closes the dropdown. Closing does not stop a response. Your draft and conversation remain while the extension stays enabled. A configurable popup shortcut is initially unassigned.
- **New Chat and switching:** the New Chat button starts fresh context. Model/connection changes start a new chat; stop an active request first. Existing conversations keep their model and destination. Reusing one at an edited server URL requires explicit confirmation.

**Local versus cloud:** Ollama may run the model on the selected server, or route a cloud model through its cloud service. Cloud generation can send text/images beyond the server even when the connection says `localhost`. Cloud model sign-in is handled on the **Ollama server**, using its app/CLI/account; it is separate from the search API key below. The extension does not promise that all Ollama traffic stays local. See [local/LAN and cloud details](docs/OLLAMA.md).

## Set up optional web search

**Ordinary chat does not need this separate API key.** Start with working ordinary chat, then follow these steps on the **GNOME client**:

1. Open [Ollama's official API-key page](https://ollama.com/settings/keys) in your browser. Sign in to your Ollama account, or create an account if needed.
2. Create a new API key on that page and copy it. Treat it like a password: **do not include it in screenshots, chat messages, source files or bug reports**.
3. Open the extension's **Preferences**, scroll to **Web Search**, and paste the key into **New API key (not displayed or prefilled)**. The field is masked.
4. Click **Save / Replace**. Expect **Search key saved in Secret Service**. The entry clears after the action; that does not mean the saved key was lost. To replace a key, enter the new one and use the same button.
5. Click **Test Search**. This makes one hosted search using the saved key and should say **Search authenticated — … results**. It can count against your provider quota; it does not generate a chat answer.
6. Return to the dropdown. Click **Search Web: Off** so it says **Search Web: On**, then ask:

   > What is the latest stable GNOME release as of today? Cite official sources.

7. Press **Send**. You should see **Searching the web…**, **Reading sources…**, then **Generating answer…**.
8. Beneath the answer, click **Sources (5) ▸** to expand its source titles and domains. The number reflects the actual count and may be smaller. Click again to collapse; Tab to the row and use Enter or Space for the same action. Sources start collapsed, including after reopening the dropdown or restoring history. Source numbers match references such as `[1]` in the answer. Valid inline citations and source links open the browser only after a click; unknown IDs and model-generated URLs are not trusted for launching. Citations are useful evidence, not proof that an answer is correct.

For an ambiguous follow-up such as **“What about today?”**, enter a more specific query in the small **Search query (optional override, max 1,000 characters)** field. If it is empty, the current message is used as the query. Longer queries are rejected rather than silently shortened. No extra model request rewrites queries for you. Search resets Off when starting/opening another conversation.

### Keyring help

The key is saved in your desktop **Secret Service**, normally **GNOME Keyring**, not in GSettings or plaintext history. A locked keyring may prompt you to unlock it. Open **Passwords and Keys** (Seahorse), if available, and unlock the login keyring; then try Save / Replace or Test Search again. If Secret Service or libsecret support is missing, use your distribution's GNOME/keyring help. There is no plaintext fallback; ordinary chat still works with search Off.

**Remove** in Web Search preferences removes an unlocked matching key. If the UI says no unlocked key was removed, unlock the keyring and retry; do not assume it was deleted.

### Where search data goes

- Only the **current question or explicit override query** goes to Ollama's hosted search service.
- Selected result **page URLs** go to its hosted fetch service.
- Conversation history, screenshots and image attachments are **not uploaded to those search/fetch APIs**. The original question, appropriate chat/image context and bounded evidence go to your selected Ollama model for the answer.
- Thus, **local AI inference does not make web search entirely local**. Check the [current official search documentation](https://docs.ollama.com/capabilities/web-search) and your account's requirements, limits and potential costs. The documentation currently requires an Ollama API key and a free Ollama account; this is not a promise of unlimited or permanently free use.

The extension uses up to five results, fetches up to three pages with two requests in parallel, and caps evidence within the normal context budget. Missing pages can fall back to search excerpts with a coverage notice. If search itself fails, **Retry** explicitly tries again or **Answer without web search** generates a clearly labeled answer without research. Neither silently repeats chargeable searches or duplicates your question. See [full search behavior and limits](docs/WEB-SEARCH.md).

## Troubleshooting

Start with the `curl …/api/tags` test **from the same client computer as the extension**. If it fails too, the problem is usually the server or network, not the dropdown.

| What you see | What it means | What to try |
| --- | --- | --- |
| Connection refused | The address answered, but nothing accepted that port, or a firewall rejected it. | On the server, check `systemctl is-active ollama.service` if systemd-managed and `ss -ltn 'sport = :11434'`. Check the URL/port; start the existing server if appropriate. |
| Connection timeout | The server cannot be reached promptly, often because of an address, route, sleeping host or firewall issue. | Wake/check the server, confirm its LAN address, and run the client `curl` test. Check the trusted-LAN firewall rule, guest Wi-Fi and VPN/client isolation. |
| Wrong address / `localhost` for a remote server | The client is trying to contact itself or an old server address. | Use the server's real home-network address. Check its router lease; consider a DHCP reservation. Do not use a Docker-only address. |
| Connected, but empty model list | The API works; that server has no available models. | Run `ollama ls` on the server before changing its bind address, or inspect the API list at its current address. Obtain a suitable model with Ollama's tools, then Refresh. |
| First answer is slow | A model may be loading into memory or waiting for resources. | Allow time; on the server, `ollama ps` shows loaded models. Stop remains available. The generation deadline is ten minutes; try a smaller available model if needed. |
| No search API key available | No matching key was read from Secret Service. | Use Preferences → Web Search → Save / Replace, then Test Search. Keep search Off for ordinary chat. |
| Keyring locked or unavailable | The desktop cannot provide the saved search secret. | Unlock the login keyring in Passwords and Keys; check your GNOME Secret Service/libsecret setup. Retry the explicit action; no plaintext fallback is used. |
| Search authentication failure | The hosted search key/account is not accepted (HTTP 401/403). | Check the account/key page, replace the search key, then Test Search. This is separate from the server's cloud-model sign-in. |
| Search rate limit | Hosted search/fetch limits were reached (HTTP 429). | Wait as instructed, including any Retry-After interval, and check current account limits/costs. There are no automatic retries; don't repeatedly press Retry. |
| Model cannot accept images | It is text-only, or vision support could not be verified. | Select a vision-capable model for a new chat, or remove images. Unknown support requires an explicit attempt; it is not a promise of support. |
| Old interface after updating | GNOME may still have the old JavaScript module loaded. | Confirm you installed the new release's extension ZIP with `--force`, then save your work and log out/in on Wayland. |

For an extension-specific report, include GNOME version, release version, benign reproduction steps and the error text. The commands above list versions/models/listening sockets or test model-list connectivity; they do not require your search key or private prompts. Do not paste credentials, whole history files, screenshots containing secrets or unredacted server logs. More [troubleshooting](docs/TROUBLESHOOTING.md) is available.

## History and privacy

- Conversations and processed images are stored **on the GNOME client**, in `$XDG_DATA_HOME/ai-pop-down-extension/`, normally **`~/.local/share/ai-pop-down-extension/`**. They survive logout/reboot when persistent history is enabled.
- **History is plaintext, not encrypted.** The extension uses private directory/file permissions, but that is not encryption. Source metadata is saved with its answer; downloaded page bodies are not retained in history.
- Open the **Conversation history** button in the dropdown. Use the trash button beside a conversation and confirm to delete it. **Delete all history…** asks for confirmation before deleting all chats/drafts and unreferenced retained images.
- **Preferences → History and privacy → Persistent conversation history** controls disk conversations. While the extension runs with this Off, it clears the saved conversation index and keeps chats only in the enabled session's memory. Prepared images still use private temporary disk storage. Normal disable attempts cleanup; crash leftovers are collected on the next enable. This is not a zero-disk-traces or secure-erasure mode. Unsent drafts are session-only even with persistent history On.
- Clipboard image access happens only after **Paste image**; copy buttons and normal native text editing use the clipboard. There is no clipboard watcher, telemetry or background search.
- Ordinary LAN HTTP is unencrypted. Cloud models and optional hosted search have their own data flows as described above. No model-returned commands/tools/code are executed.

See [privacy/storage details](docs/PRIVACY.md).

## Updating

On the **GNOME client**, download the new release's installable ZIP from [Releases](https://github.com/edjenn1998/ai-pop-down-extension/releases). If it is in Downloads:

```sh
gnome-extensions install --force "$HOME/Downloads/ai-pop-down-extension@edjenn1998.github.io.shell-extension.zip"
```

Save your work and log out/in on Wayland to load the new code, then enable it again if necessary. Updating extension files preserves history outside the installation directory and the separate keyring credential. Review release notes for version-specific changes.

## Uninstalling and removing personal data

On the **GNOME client**, before uninstalling:

1. To remove saved chats/images now, use **Conversation history → Delete all history…** and confirm.
2. To remove the search credential, use **Preferences → Web Search → Remove**, unlocking the login keyring if necessary. These are separate from uninstalling the extension.
3. Disable and uninstall the user-installed extension:

   ```sh
   gnome-extensions disable ai-pop-down-extension@edjenn1998.github.io
   gnome-extensions uninstall ai-pop-down-extension@edjenn1998.github.io
   ```

**Uninstalling alone leaves history and credentials behind**, because they live outside the extension directory. If you already uninstalled it, you can remove **only** its data directory using Files: press Ctrl+L and enter the actual `$XDG_DATA_HOME/ai-pop-down-extension` path (normally `~/.local/share/ai-pop-down-extension`). Delete that folder if you no longer want its history/images. To remove the credential afterward, use Passwords and Keys to find **AI Pop Down — Ollama web search** and delete the matching secret. You may reinstall the extension temporarily to use its Remove action instead.

Saved non-secret preferences can also remain in GNOME's settings database. If you want to reset just this extension's settings and the `dconf` command is available, run on the client:

```sh
dconf reset -f /org/gnome/shell/extensions/ai-pop-down/
```

That resets connection profiles and appearance preferences; it does **not** delete history or keyring secrets. None of these actions removes copies already sent to a server/cloud service or stored in backups.

## More information

- [Current release notes](docs/RELEASE-NOTES-0.2.1.md)
- [Build and package](docs/BUILDING.md) — development tools only, not needed by extension users
- [Maintainer architecture walkthrough](docs/MAINTAINER.md)
- [Verified API and setup references](docs/API-REFERENCES.md)
- [Automated validation and outstanding desktop checks](docs/VALIDATION.md)
- [Manual testing checklist](docs/TESTING.md)
- [GNOME submission checklist](docs/SUBMISSION.md)

License: **GPL-3.0-or-later**, see [LICENSE](LICENSE) and [COPYING](COPYING).
