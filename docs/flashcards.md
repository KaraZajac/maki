# Flashcards

maki's Flashcards app shows decks of cards a card at a time, and brings back the cards you don't
know sooner than the ones you do. maki desktop sends it the decks, from a file, pasted text or
Anki; it keeps up to eight of them, with how well you know each card.

## Studying

The app opens on its decks, each with how many cards it has for today. The centre opens one, and
the centre again starts studying it.

A card's front shows as big as it fits. The centre turns it over: its back, under a line of its
front. Then **left** says you didn't know it ("again") and **right** that you did ("knew it"). A
card too long to show at once scrolls with the dial on maki's side. A card you didn't know comes
round again three cards on, until you know it, but only its first answer counts toward when it
comes back.

maki's menu (left and right together) has **Stop studying** while you study. Otherwise it has
**New cards a day** (5 to 100: how many cards a deck brings in each day it has new ones, after the
cards due; 20 at first) and **Room on maki**, and on a deck **Delete this deck** too.

## When cards come back

Leitner's boxes: seven of them, and a card in box *n* comes back 2^(*n*−1) days after you last saw
it, so one day, then two, four, eight, sixteen, thirty-two and sixty-four. A new card you know goes
in box 2, one you don't in box 1; after that, knowing it moves it up a box and missing it puts it
back in box 1. The days in a row you've studied show on the list once there are two.

A day is maki's clock's, in UTC: apps aren't told maki's time zone, so a day turns at midnight UTC
(5 pm in Las Vegas in summer). maki loses the time when it's switched off, until maki desktop sets
it again. Without it, the app takes the day to be the last one it knew, and says so on its list:
what you study is scheduled from that day, so cards come back no later than they should, and the
days in a row wait for the date.

## Sending decks from maki desktop

In maki desktop, under **Connections**, **Flashcards**: open a CSV or tab-separated file, paste text
(a card a line: its front, a tab or a comma, then its back), or open what Anki exports (**File**,
**Export**, **Cards in Plain Text**; maki desktop reads its header lines, takes the HTML off, makes a
card of each cloze deletion, and asks which deck, if the file has several). Files in UTF-8, UTF-16
or Windows-1252 all read.

Before anything is sent, maki desktop shows the deck as maki will have it. maki's fonts draw Latin
letters with Western Europe's accents, digits and the usual punctuation (Œ and œ, curly quotes, …
and € too). A character they don't draw is changed to one they do where there's an obvious one
(ą to a, — to -, ﬁ to fi), and the card that has one with none (another script, an emoji) is left
out; the preview says which, line by line, and how much of maki's room the deck takes.

Sending a deck again, under the same name, replaces it and keeps the progress of each card whose
front it still has. Removing a deck from maki desktop or from maki's menu takes its progress too.

## Limits

Eight decks, of up to 1000 cards each, in the app's 64 KiB: about 2000 short cards in all. A deck's
name has up to 32 characters, a card's front up to 200 and its back up to 500; line breaks may be
in either. The decks and their progress are in maki's backups, as the app's storage is.
