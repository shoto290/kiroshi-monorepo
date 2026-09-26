# Space archive

`space_export` writes one Space to a single uncompressed tar file; `space_import` recreates it
from that file under the application data directory of any machine.

## Layout

```
manifest.json                 { "format_version": 1, "space_id": "<exported space id>" }
rows.json                     every sqlite row of the space, keyed by table name
space/                        the space plugin directory (spaces/<space id>)
bots/<bot id>/                the plugin directory of each bot seated in the space, .git included
env/space/                    the space env file (env/space/<space id>)
env/space-servers/            the space MCP server env files (env/server/space/<space id>)
env/bots/<bot id>/            the bot env file (env/bot/<bot id>)
env/bot-servers/<bot id>/     the bot MCP server env files (env/server/bot/<bot id>)
attachments/<conversation id>/  the attachment files of each conversation of the space
```

`manifest.json` is always the first entry and `rows.json` the second. Symbolic links inside a
plugin or env directory are not carried.

`rows.json` holds the rows of `spaces`, `space_settings`, `sections`, `bots`, `bot_spaces`,
`conversations`, `conversation_participants`, `turns`, `messages`, `message_pins`, `activities`,
`context_checkpoints`, `conversation_arrivals`, `application_installs`, `routines`,
`routine_runs`, `routine_dedupe_values`, `missions` and `mission_events`, read inside one read
transaction. The bots are those seated in the space plus every participant of its conversations.

`runtime_sessions` rows are left out, as are the checkpoints tied to one, and
`messages.runtime_session_id` travels as null: an imported companion starts a new session on its
next message.

## `format_version`

An integer, currently `1`. The importer refuses any other value with `unsupportedArchive`, naming
the version found and the version it supports, before it writes anything. Bump it whenever the
layout or the meaning of a row changes.

## Import

- An id already present on the target (a row, or a directory named after it) is replaced by a
  fresh one, and every row, directory name and env path that references it is rewritten.
- The imported space is appended at the end of the space order.
- Each seated bot is seated in the imported space only. A participant that was not seated in the
  exported space arrives retired.
- Attachment paths quoted in message contents are rewritten to the attachment directory of the
  target.
- Files are laid down first, then the rows are written in one transaction. If any step fails,
  every directory the import created is removed and no row lands.

## Security

Env values travel **unencrypted**: anyone holding the archive reads every secret of the space and
its bots. The file is written with owner-only permissions; keep it that way.
