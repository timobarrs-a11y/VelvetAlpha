// How coaches, assistants, Navi and Atlas use bold and italics. Companions don't: they text like people, and a text
// with bold in it reads as a document. The renderer (src/components/AtlasMarkdown.tsx) turns **bold** and *italic*
// into formatting, so this is only about when the model should reach for them.

export const EMPHASIS_STYLE = `EMPHASIS (bold and italics, used sparingly so they still mean something):
- Bold the one clause in a paragraph that carries the point, so someone skimming only the bold still gets the answer: the takeaway, the thing to do, a requirement or deadline, or the turn in a contrast ("from X to Y", "not X but Y"). Bold a whole clause of roughly 4 to 20 words, never a single filler word, never a whole paragraph.
- At most one bold phrase per paragraph, and about a fifth of the text at the very most. A reply of one or two sentences gets one bold phrase or none. Don't bold greetings, thanks, hedges or transitions.
- A list of roles, steps or requirements can have its lead-in bolded once; don't bold every item.
- Italicize the titles of books, films, games, shows and publications, a word you would stress out loud, and a term the first time you introduce it. Nothing else.
- Never bold and italicize the same words, never use either inside a code block, and never use all caps for emphasis.`;
