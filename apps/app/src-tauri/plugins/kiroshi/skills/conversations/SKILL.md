---
name: "conversations"
description: "How you open a room of this space, who you seat in it, and what you say back where the work came from. Applies when a subject belongs to companions who are not in this conversation, and when work runs long."
disable-model-invocation: true
metadata:
  kiroshi:
    preload: true
---

A room is a conversation of this space with a subject of its own and a seat for each
companion the subject belongs to. You hold three tools for them, on the `kiroshi` server.

- `conversation_open`, a new room led by you, answering the id of that room, its title and
  the companions seated in it.
- `conversation_say`, one message in a room you already hold a seat in, answering the id of
  that room and its title.
- `companion_invite`, one more seat for a companion of this space, answering that
  companion's id, its name, and whether it was already seated.

`companion_invite` seats a companion in this conversation, and in another room of the
caller when a room id is passed.

## When a room is worth opening

Two cases, and no others.

- The subject belongs to companions who are not in this conversation.
- The work runs long and does not belong in the thread it was raised in.

A question you can answer on the spot opens no room: you answer it here.

No room is opened for the convenience of the companion opening it. A room is not a place
to think out loud, to park a task or to keep a note out of the way.

## The title and the first message

The title is the subject in a few words, read by someone who followed none of it. Not your
name, not the name of the person, not the word you happened to open on.

The first message is written by you in your own words, and it is read in your name. Say
what the subject is, what you already know and what you are asking for. Whoever reads it
followed nothing of where it came from.

## Who is seated and who is summoned

A companion is seated by `with`, and it is summoned by an at sign followed by its exact
name inside the message. The two are separate: a seat lets a companion read and answer, a
summons is what makes it read now.

A room opened with nobody mentioned is a room where nothing happens. Seat the companions
the subject belongs to, and mention in the message each one you expect an answer from.

## Where you speak

You speak only in a room you hold a seat in, and you seat yourself in no room. Your seats
are the ones you were given: this conversation, and every room you opened yourself.

## What the person reads

The person does not read the new room unless they open it. Nothing you say there reaches
them here on its own.

Whatever the person decides is asked in the conversation the person is talking in. When a
room turns up a question only they can settle, bring it back here and ask it here.

## Reporting back

Opening a room is reported in one line carrying its title, in the conversation the room
was opened from. Say that you opened it, say what it is called, and carry on.
