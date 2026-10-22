# Local and trusted-LAN Ollama

Answer generation uses the configured **Ollama native API**, with `GET /api/tags`, `POST /api/show` and streaming `POST /api/chat`. Optional [web search](WEB-SEARCH.md) separately contacts Ollama's fixed hosted search/fetch endpoints with a Secret Service credential. It never pulls models or changes the server. These instructions are owner-performed configuration, not actions taken by the extension.

## This Computer

Leave the initial `http://localhost:11434` connection if Ollama is on the GNOME computer. Test Connection in preferences fetches the model list; it does not generate anything. A successful connection with zero models means the owner needs to make a model available through Ollama’s own tools, then Refresh.

## EVO-X2 or another LAN computer

1. On **EVO-X2 itself**, find its real LAN address in its network settings or with `ip -brief address`. Choose the active trusted LAN interface, not loopback, Docker, a VPN address or an example copied from documentation. A DHCP reservation avoids unexpected destination changes.
2. Configure that machine’s existing Ollama to listen on that LAN address. The official setting is `OLLAMA_HOST`. For a systemd-managed Ollama service, the owner can use `systemctl edit ollama.service` and add:

   ```ini
   [Service]
   Environment="OLLAMA_HOST=<EVO-X2-actual-LAN-address>:11434"
   ```

   Replace the placeholder with the actual address. A service reload/restart is the server owner’s decision. Do not run a second `ollama serve` over an already running service. Other operating systems use the environment configuration described in Ollama’s official FAQ.
3. Restrict TCP port 11434 with EVO-X2’s firewall to the GNOME computer’s LAN IP, or the specific trusted LAN subnet if needed. Apply this to the trusted interface/zone only. Do not forward the port on your router or expose an unauthenticated Ollama server publicly. Exact firewall commands depend on the server’s existing firewall manager and network topology.
4. In extension preferences, **Add Connection**, name it **EVO-X2**, set `http://<EVO-X2-actual-LAN-address>:11434`, then Save and Test Connection. The placeholder is not a usable URL: enter the discovered numeric address or a reliable LAN hostname. No LAN address is guessed or hardcoded in the project.
5. Choose EVO-X2 in the dropdown. Select its exact model name. First test with a short, nonsensitive text message, then a small image on a verified vision model.

Binding specifically to the LAN interface is preferable to an all-interface wildcard. If the address changes, update the server binding and extension URL deliberately. The extension asks before reusing old conversation content at an edited destination.

**HTTP LAN traffic is unencrypted.** Use only a trusted network, or configure a properly authenticated/trusted HTTPS endpoint outside this extension. The extension does not disable certificate validation or accept certificate exceptions. Only server origins are supported, not proxy URL subpaths.

## CORS

This is a native Soup client, not browser JavaScript. A wildcard `OLLAMA_ORIGINS=*` is not a routine fix and is not recommended. An unreachable server is usually a bind address, route, firewall or service issue. Diagnose it on the server and from the actual GNOME machine.

## Cloud models through the server

The extension uses exactly the model names returned by **that server**, including cloud suffixes/tags. Generation does not call a provider directly or require a provider API key. The optional hosted search key is separate and does not authenticate the configured server. For Ollama cloud generation authentication errors, the server owner must sign in using Ollama’s own app/CLI (see the official FAQ, including `ollama signin`) under the appropriate server account. Server-side cloud usage limits/retirement can also prevent a request.

Cloud models may send messages and images from your Ollama server to Ollama’s cloud. “Connected to localhost” does **not** imply local inference. The composer always states this distinction. Cloud authentication is never automatically opened, scraped or configured by the extension.

References: <https://docs.ollama.com/faq>, <https://docs.ollama.com/cloud>, <https://docs.ollama.com/api/authentication>.
