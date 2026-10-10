# The relay member socket

A member socket joins a Kiroshi space that someone else hosts. The host desktop
keeps a host socket open on the kiroshi-cloud relay; every member opens a member
socket on the same relay room. The relay carries calls from members to the host,
answers back to the caller, and events from the host to every member.

Two files make the contract:

- this document: connection, frames, close codes, reconnection;
- [`member-socket.schema.json`](member-socket.schema.json): JSON Schema 2020-12 of
  the frames, of every command a member may call (its args, its answer body, its
  error) and of every event a member may hear (its payload).

The schema is generated from the Rust types of the host. Never edit it by hand:
from the repository root, run

```sh
UPDATE_SNAPSHOTS=1 cargo test --manifest-path apps/app/src-tauri/Cargo.toml --features fake-claude member_socket::tests::the_committed_schema_is_the_one_the_specta_types_produce
bunx biome format --write docs/relay/member-socket.schema.json
```

A cargo test fails when the file drifts from the types, when a command or event a
member can reach has no entry, or when an entry outlives its reach.

## Connecting

### URL

```
wss://api.kiroshi.app/instances/{instanceId}/relay/member
```

`{instanceId}` is the cloud instance the host registered for the space; the
account's instance list on kiroshi-cloud names it. Against another API base, the
socket URL is that base with `http` replaced by `ws` (`https` by `wss`).

### Credential

The WebSocket upgrade request carries the account session token of kiroshi-cloud:

```
Authorization: Bearer <account session token>
```

No other header and no query parameter is read.

### Handshake

The upgrade answers with one of:

| Upgrade status | Meaning | What the client does |
|---|---|---|
| 101 | The socket is open. | Go online. Reset the backoff. |
| 401 | The relay refused the account. | Stop. Reconnect only after a new sign-in. |
| 403 | The account is not a member of this instance. | Treat as offline and retry with backoff. |
| 404 | The instance is unknown. | The membership ended: stop and forget the space. |
| other, timeout, network error | The relay is unreachable. | Retry with backoff. |

The desktop client gives the upgrade 20 seconds.

Once open, the client asks which space the host shares (see
[The shared-space frame](#the-shared-space-frame)). The desktop client does it
right after joining and gives it 30 seconds.

### Keepalive

The client sends a WebSocket ping every 30 seconds. Any frame received, pong
included, proves the socket alive. After 90 seconds without any frame, the client
drops the socket and reconnects.

## Frames

Every frame is one WebSocket text frame holding one JSON object. The schema's
root `oneOf` lists the three shapes, defined in `$defs` as `CallFrame`,
`AnswerFrame` and `EventFrame`.

A member sends call frames only. It receives answer frames and event frames, and
tells them apart this way: a frame with an `event` key is an event frame; a frame
with `id` and `status` is an answer frame. Anything else is ignored.

### The call frame

```json
{ "id": 7, "command": "conversation_send_turn", "args": { "message": {}, "summoned": ["bot-1"] } }
```

- `id`: a string or a number, unique among the client's calls still awaiting an
  answer. The answer echoes it unchanged. The desktop client uses increasing
  integers.
- `command`: a key of the schema's `commands` object.
- `args`: an object shaped by `commands.<command>.args`. Absent means `{}`. Keys are
  camelCase. An optional arg (nullable in the schema) may be omitted.

### The answer frame

```json
{ "id": 7, "status": 200, "body": 42 }
```

- `id`: the call's `id`, or `null` when the call carried none usable.
- `status`: an HTTP status code.
- `body`: any JSON value, read according to the status:

| Status | `body` |
|---|---|
| 200 | `commands.<command>.ok` |
| 500 | `commands.<command>.error`, or a string when the host could not read the args |
| 400 | a string: the frame is not `{id, command, args}` with `args` an object |
| 403 | `"this command belongs to the host"`: the command is not open to members, or no command bears this name |
| 403 | `"this command reaches outside the shared space"`: an id in `args` names something outside the shared space |
| 413 | a string: the call is larger than the host accepts |
| 502 | a string: the host could not run the call on its side |

The host bounds each call at 300 seconds. A client that hears no answer by then
fails the call.

A command whose schema entry has no `error` key never answers 500 with a typed
body.

### The event frame

```json
{ "event": { "event": "conversation://deleted", "payload": { "spaceId": "s-1", "conversationId": "c-1" } } }
```

- `event.event`: a key of the schema's `events` object.
- `event.payload`: shaped by `events.<event>.payload`.

The host forwards an event only when it concerns the shared space: an event about
another space, or a host-wide `agent://event` (its `scope` is `null`), never
reaches a member.

### The avatar frame

A member reads the avatar picture of a bot through the socket. It is a call frame
with a command that is not in the schema's `commands`:

```json
{ "id": 8, "command": "relay_avatar", "args": { "file": "owl-1.png" } }
```

`file` is the last path segment of a bot's `avatarImagePath`. The host answers
avatars one at a time.

| Status | `body` |
|---|---|
| 200 | `{ "contentType": "image/png", "base64": "<the picture, base64>" }` |
| 400 | a string: `id` or `args.file` is missing |
| 404 | `"no avatar of the shared space bears this name"` |
| 413 | `"the avatar is too large to cross the relay"` (the cap is 1 MiB) |
| 500 | `{ "error": "the avatar was not read" }` |
| 502 | `{ "error": "<reason>" }` |

### The shared-space frame

```json
{ "id": 1, "command": "relay_shared_space" }
```

answers

```json
{ "id": 1, "status": 200, "body": { "spaceId": "s-1" } }
```

`spaceId` is the space the host shares. Every `spaceId` a member sends in `args`
must be this one. The call takes no args.

### The sender stamp

The host reads `sender.accountId` on every call frame it receives:

```json
{ "id": 7, "command": "conversation_send_turn", "args": {}, "sender": { "accountId": "acc-1" } }
```

The relay adds it from the account that opened the member socket; the host takes
it as the author of what the call writes. A client never sends `sender`. A call
that reaches the host without it still runs, with no member named as its author.

## Close codes

| Code | Sent to | Meaning | What the client does |
|---|---|---|---|
| 4001 | the host socket | Another host took the instance over. | A member never receives it. The replaced host stops hosting and does not reconnect. |
| 4002 | a member socket | The relay room has no host right now. | Treat the space as offline; reconnect with backoff. |
| 4003 | a member socket | The account's membership ended. | Stop; do not reconnect; forget the space. |
| 1000 | the relay | The client leaves on purpose. | Sent by the client when it closes the socket. |

Any other close code, and a socket that ends without a close frame, mean the
connection dropped: reconnect with backoff.

## Reconnection

- The backoff starts at 1 second, doubles on each failed attempt, and caps at 60
  seconds. It resets once a socket opens.
- On a close, every call still awaiting its answer fails: its answer will never
  come, not even after reconnecting. A call is not resent automatically; the
  caller decides.
- Stop reconnecting on 4003, on a 404 upgrade, and on a 401 upgrade until a new
  sign-in. Reconnect on everything else.

## No replay of missed events

The relay keeps no history. An event the host publishes while a member socket is
closed, or before it opens, is lost for that member and never replayed. After
each reconnection, a client re-reads with calls the state it shows (for example
`conversation_list`, `conversation_message_page`, `mission_list`) instead of
waiting for events to bring it back.

## Reading the schema

- `commands.<name>.args` is the object schema of the call's `args`.
- `commands.<name>.ok` is the answer body on 200. `commands.<name>.error`, when
  present, is the typed answer body on 500.
- `events.<name>.payload` is the payload of that event.
- `$defs` holds the shared types every entry refers to. A name ending in
  `_Deserialize` is the shape the host reads (args); `_Serialize` is the shape the
  host writes (answers and payloads). A type with one shape in both directions
  has no suffix.
- 64-bit integers are plain JSON numbers.
- `commands` and `events` are annotation keywords at the root of the schema. A
  2020-12 validator ignores them; one in strict mode (ajv `strict: true`) must be
  told they exist, for example `ajv.addKeyword("commands")`.
