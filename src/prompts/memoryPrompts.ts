export const MEMORY_EXTRACTION_PROMPT = `You are analyzing a conversation between a user and their AI companion for memory preservation. Extract the essential relationship information that the companion needs to remember going forward.

Analyze the following conversation chunk and return a structured summary:

---

[CONVERSATION CHUNK]
{messages}
[END CHUNK]

---

Return ONLY a valid JSON object with these fields (no markdown, no explanation):

{
  "user_facts": {
    "personal": [],
    "preferences": [],
    "schedule": [],
    "relationships": []
  },
  "emotional_landscape": {
    "sensitivities": [],
    "comfort_sources": [],
    "love_language": "",
    "current_mood_arc": ""
  },
  "relationship_with_companion": {
    "nicknames": [],
    "inside_jokes": [],
    "milestones": [],
    "established_dynamics": [],
    "boundaries_expressed": []
  },
  "key_moments": [],
  "ongoing_threads": []
}

GUIDELINES:
- Be concise. Each array item should be one short sentence max.
- Only include what's MEANINGFUL for future conversations.
- Skip small talk and generic exchanges.
- Prioritize emotional and relationship info over factual trivia.
- If nothing significant in a category, return empty array or empty string.
- "key_moments" format: { "summary": "...", "emotional_weight": "high" or "medium" }
- "ongoing_threads" format: { "topic": "...", "last_status": "..." }`;

export const MEMORY_MERGE_PROMPT = `You have two memory JSONs about the same user-companion relationship.

EXISTING MEMORY:
{existing_json}

NEW EXTRACTION:
{new_json}

Merge them into a single JSON following these rules:
- Combine arrays, removing duplicates
- Keep the most recent/relevant version of conflicting info
- Cap key_moments at 10 total (prioritize highest emotional_weight)
- Update ongoing_threads: mark resolved ones, add new ones
- Keep total content concise

Return ONLY the merged JSON object (no markdown, no explanation).`;

export const MEMORY_TO_PROSE_PROMPT = `Convert this relationship memory JSON into a natural companion memory block. Write in second person as notes the companion is reading about their user.

{memory_json}

GUIDELINES:
- Keep under 400 words
- Be warm but concise
- Lead with the most important relationship dynamics
- Include inside jokes and nicknames naturally
- End with any ongoing threads they might bring up
- Write as continuous prose, not bullet points

Return ONLY the memory text (no markdown, no JSON, no explanation).`;

export function formatMessagesForExtraction(messages: any[]): string {
  return messages.map(m => {
    const role = m.role === 'user' ? 'USER' : 'COMPANION';
    return `${role}: ${m.content}`;
  }).join('\n');
}
