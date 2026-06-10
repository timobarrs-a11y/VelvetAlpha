# Co-Author Collaborative Editor - Implementation Guide

## Overview

The Co-Author feature has been completely redesigned from a block-based chat system to a true collaborative document editor. Now you and your companion write directly in the same document, like working together in Google Docs or Word.

## What Changed

### Before (Block System)
- Separate blocks for user and AI content
- Input box at the bottom
- Content appeared as separate messages
- Felt like a chat interface

### After (Collaborative Editor)
- Single shared document
- Type directly in the main editor
- AI continues from your cursor position
- Feels like real-time collaboration

## How It Works

### User Experience Flow

1. **Create a Session**
   - Set title, purpose (Writing/Research), tone, and session description
   - Example: "A comedy piece about a boy named Mike trying to navigate high school"

2. **Start Writing**
   - Type directly in the document
   - No input box - the entire canvas is your editor
   - Write: "Mike walked into the cafeteria and immediately realized he'd forgotten his lunch money."

3. **Click "Co-Author"**
   - Your companion reads the full document
   - Analyzes the context, tone, and flow
   - Continues writing from where you left off
   - Text appears character-by-character like real-time typing

4. **Keep Collaborating**
   - Edit any part of the document
   - Place cursor anywhere
   - Click "Co-Author" again
   - AI continues from your cursor position

### Features

- **Auto-Save**: Changes save automatically after 2 seconds of inactivity
- **Manual Save**: Click the Save button anytime
- **Export**: Download as .txt file
- **Settings Panel**: Adjust purpose, tone, length preference, and custom instructions
- **Real-Time Streaming**: See AI text appear character-by-character (20ms per character)
- **Smart Spacing**: Automatically adds space if needed before AI content

## Technical Implementation

### Components Created

#### CollaborativeEditor.tsx
- Single large textarea with auto-resize
- Cursor position tracking
- Character insertion at cursor
- Tab key support for indentation
- Uses serif font for writing feel (18px, 1.8 line-height)

#### Updated CoAuthorCanvas.tsx
- Removed block-based UI
- Single document content state
- Auto-save with debouncing (2 second delay)
- Streaming text insertion
- Settings panel toggle
- Co-Author button in header

### Database Strategy

The document is stored as a single block in `co_author_blocks`:
- When saving, all existing blocks are deleted
- A new single block is created with the full document content
- `author_type` is set to 'user'
- This maintains backward compatibility while simplifying the model

### AI Integration

#### System Prompt
The AI receives clear instructions:
- Continue naturally from where the document left off
- Match existing style, tone, and voice
- No meta-commentary
- Only output the text to add
- Don't repeat existing content

#### Context Building
The AI receives:
- Session title, purpose, tone
- Session description (user's instructions about what they're writing)
- Full current document content
- Length preference (Short/Medium/Long)

#### Response Handling
1. AI generates complete response
2. Text is inserted at cursor position
3. Characters appear one at a time (20ms intervals)
4. Cursor advances with each character
5. Document is marked as having unsaved changes
6. Auto-save triggers after 2 seconds

## User Benefits

### Natural Collaboration
- Write together in real-time
- No artificial separation between user and AI
- Seamless flow of ideas

### Full Control
- Edit any part anytime
- AI continues from wherever you place the cursor
- Keep what you like, change what you don't

### Context-Aware
- AI understands the full document
- Maintains consistency in style and tone
- Picks up narrative threads naturally

### Session Memory
- Title and description guide the entire session
- Tone setting persists throughout
- Custom instructions apply to all AI contributions

## Example Use Cases

### Comedy Writing
**Session Setup:**
- Title: "Mike's High School Adventures"
- Purpose: Writing
- Tone: Playful
- Description: "A comedy about a clumsy teenager named Mike who gets into absurd situations"

**Collaboration:**
```
User types: Mike walked into chemistry class and sat down at his lab table.

[Clicks Co-Author]

AI continues: Before he could even open his notebook, he accidentally knocked over
a beaker of bright purple liquid. It spilled across the table, and his lab partner,
Sarah, jumped back with wide eyes. "Mike," she said with exasperated patience,
"that was just water with food coloring." Mike felt his face turn the same shade
as the spill. "I knew that," he muttered.
```

### Research Paper
**Session Setup:**
- Title: "Climate Change Impact on Marine Ecosystems"
- Purpose: Research
- Tone: Academic
- Description: "Exploring how rising ocean temperatures affect coral reef biodiversity"

**Collaboration:**
```
User types: Recent studies indicate that ocean temperatures have risen by
0.13°C per decade since 1980.

[Clicks Co-Author]

AI continues: This warming trend has significant implications for coral reef
ecosystems, which are particularly sensitive to temperature fluctuations.
Coral bleaching events, triggered when water temperatures exceed seasonal
maximums by 1-2°C for extended periods, have increased in both frequency
and severity (Hughes et al., 2018). The Great Barrier Reef, for instance,
experienced unprecedented back-to-back bleaching events in 2016 and 2017,
resulting in widespread mortality across large sections of the reef system.
```

## Troubleshooting

### AI Response Not Appearing
- Check browser console for errors
- Verify companion is properly configured
- Ensure authentication token is valid
- Check Supabase edge function logs

### Document Not Saving
- Check for unsaved changes indicator
- Manually click Save button
- Verify Supabase connection
- Check RLS policies on co_author_blocks table

### Streaming Too Fast/Slow
- Adjust interval in CoAuthorCanvas.tsx line 177
- Current: 20ms per character
- Faster: Lower number (e.g., 10ms)
- Slower: Higher number (e.g., 50ms)

## Future Enhancements

Potential improvements:
- Rich text formatting (bold, italic, headings)
- Version history and undo/redo
- Multiple document views (outline, focus mode)
- Character count and word count stats
- Collaborative editing with multiple users
- AI suggestions without auto-insertion
- Voice-to-text input
- Export to multiple formats (PDF, DOCX, Markdown)
