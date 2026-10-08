import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Download, Save, Loader, Settings, MessageCircle, X, ListChecks, FileDown, FileType } from 'lucide-react';
import { CollaborativeEditor, CollaborativeEditorHandle, EditorStyles, type InlineAction } from './CollaborativeEditor';
import { InstructionPanel } from './InstructionPanel';
import { CoAuthorChatPanel } from './CoAuthorChatPanel';
import { coAuthorService, CoAuthorSession, CoAuthorChatMessage, type OutlineSection } from '../services/coAuthorService';
import { getCompanion } from '../services/companionService';
import { supabase } from '../shared/supabase/client';
import { AvatarConfig } from '../types/avatar';
import { buildSystemPrompt } from '../config/systemPromptBuilder';
import { colorNameToHex } from '../utils/colorMapping';
import { MODEL_CONFIG } from '../services/modelSelector';
import { getUserContext, contextToPromptBlock } from '../services/memoryBus';
import { getTemplateById, type CoAuthorTemplate } from '../config/coAuthorTemplates';

interface CoAuthorCanvasProps {
  sessionId: string;
}

export function CoAuthorCanvas({ sessionId }: CoAuthorCanvasProps) {
  const navigate = useNavigate();
  const editorRef = useRef<CollaborativeEditorHandle>(null);
  const [session, setSession] = useState<CoAuthorSession | null>(null);
  const [documentContent, setDocumentContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [companionName, setCompanionName] = useState('');
  const [avatarColor, setAvatarColor] = useState('#3b82f6');
  const [showSettings, setShowSettings] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [chatMessages, setChatMessages] = useState<CoAuthorChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [canvasError, setCanvasError] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(true);
  const [userAvatarConfig, setUserAvatarConfig] = useState<AvatarConfig | null>(null);
  const [companionAvatarConfig, setCompanionAvatarConfig] = useState<AvatarConfig | null>(null);
  const [companionData, setCompanionData] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [editorStyles, setEditorStyles] = useState<EditorStyles>({
    fontFamily: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
    fontSize: '18px',
    fontColor: '#1A202C',
  });
  const [userFavoriteColor, setUserFavoriteColor] = useState<string>('');
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [outline, setOutline] = useState<OutlineSection[]>([]);
  const [showOutline, setShowOutline] = useState(false);
  const [isGeneratingOutline, setIsGeneratingOutline] = useState(false);
  const [template, setTemplate] = useState<CoAuthorTemplate | null>(null);

  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const stylesSaveTimeoutRef = useRef<NodeJS.Timeout>();
  const isCreatingGreetingRef = useRef(false);

  const fetchMemoryContext = async (): Promise<string> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return '';
      const ctx = await getUserContext(user.id, { surface: 'co-author', maxFacts: 6, maxTopics: 4 });
      return contextToPromptBlock(ctx, { includeGoals: false, includeFacts: true, includeTopics: true, includeCommitments: false, includeSessions: false });
    } catch {
      return '';
    }
  };

  const buildQuestionnaireData = (companion: any) => ({
    interestText: companion.interest_text,
    loveLanguage: companion.love_language,
    supportStyle: companion.support_style,
    lifeContext: companion.life_context,
    energyPreference: companion.energy_preference,
    dynamicPreference: companion.dynamic_preference,
    confrontationStyle: companion.confrontation_style,
    availabilityLevel: companion.availability_level,
    flirtingStyle: companion.flirting_style,
    humorStyle: companion.humor_style,
    communicationStyle: companion.communication_style,
    emotionalOpenness: companion.emotional_openness,
    conversationDepth: companion.conversation_depth,
    expressiveness: companion.expressiveness,
    initiative: companion.initiative,
  });

  useEffect(() => {
    loadSession();
  }, [sessionId]);

  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    if (hasUnsavedChanges && !isGenerating) {
      saveTimeoutRef.current = setTimeout(() => {
        handleSave();
      }, 2000);
    }
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [documentContent, hasUnsavedChanges]);

  const loadSession = async () => {
    try {
      setIsLoading(true);
      const sessionData = await coAuthorService.getSession(sessionId);
      if (!sessionData) {
        navigate('/co-author');
        return;
      }

      setSession(sessionData);
      setTemplate(getTemplateById(sessionData.template_id));
      await coAuthorService.updateLastAccessed(sessionId);

      if (sessionData.outline) {
        setOutline(sessionData.outline);
        setShowOutline(!sessionData.outline_completed && sessionData.outline.length > 0);
      }

      const blocks = await coAuthorService.getSessionBlocks(sessionId);
      const content = blocks.map(b => b.content).join('\n\n');
      setDocumentContent(content);

      const messages = await coAuthorService.getChatMessages(sessionId);
      setChatMessages(messages);

      if (messages.length === 0 && sessionData.companion_id && !isCreatingGreetingRef.current) {
        isCreatingGreetingRef.current = true;
        await createInitialGreeting(sessionId, sessionData.companion_id, sessionData);
      }

      if (sessionData.companion_id) {
        const companion = await getCompanion(sessionData.companion_id);
        if (companion) {
          setCompanionName(companion.custom_name);
          setCompanionData(companion);
          setCompanionAvatarConfig(companion.avatar_config || null);
        }
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (profile) {
          setUserAvatarConfig(profile.avatar_config);
          setUserData(profile);
          const userFavColor = profile.favorite_color || '';
          setUserFavoriteColor(userFavColor);
          const favHex = userFavColor ? colorNameToHex(userFavColor) : '#3b82f6';
          setAvatarColor(favHex);

          if (sessionData.editor_preferences) {
            setEditorStyles({
              fontFamily: sessionData.editor_preferences.font_family,
              fontSize: sessionData.editor_preferences.font_size,
              fontColor: sessionData.editor_preferences.font_color,
            });
          } else {
            setEditorStyles({
              fontFamily: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
              fontSize: '18px',
              fontColor: favHex,
            });
          }
        }
      }
    } catch (error) {
      console.error('Error loading session:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const createInitialGreeting = async (sessionId: string, companionId: string, sessionData: CoAuthorSession) => {
    try {
      const companion = companionData || await getCompanion(companionId);
      if (!companion) return;

      const { data: { session: authSession } } = await supabase.auth.getSession();
      const authToken = authSession?.access_token;

      if (!authToken) {
        const fallbackGreeting = sessionData.session_prompt
          ? `Hey! So we're working on: "${sessionData.session_prompt}". What direction are you thinking?`
          : `Hey! What are we working on?`;

        const greetingMessage = await coAuthorService.createChatMessage(sessionId, 'avatar', fallbackGreeting);
        setChatMessages(prev => [...prev, greetingMessage]);
        return;
      }

      const systemPrompt = buildSystemPrompt({
        companionName: companion.custom_name,
        companionGender: companion.character_type || 'female',
        userName: userData?.full_name || 'there',
        userGender: userData?.gender || 'unknown',
        userAge: userData?.age || 25,
        interests: companion.interest_text || '',
        hobbies: companion.hobbies || '',
        favoriteColor: companion.favorite_color,
        musicGenre: companion.music_genre,
        newsTopics: companion.news_categories,
        relationshipType: companion.relationship_type || 'friend',
        signatureVoice: companion.signature_voice || 'authentic',
        questionnaireData: buildQuestionnaireData(companion),
      }) + await fetchMemoryContext();

      const tpl = getTemplateById(sessionData.template_id);
      let userPrompt = '';

      if (tpl) {
        const questions = tpl.guidingQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n');
        userPrompt = `The user just created a "${tpl.label}" co-authoring session with you. ${sessionData.session_prompt ? `They said: "${sessionData.session_prompt}"` : ''}

Generate a brief, friendly initial chat message (1-2 sentences) that:
1. Acknowledges what they want to work on
2. Asks ONE of these clarifying questions to help you write better:
${questions}
3. Stay in character with your personality

Pick the most relevant question based on what they've told you. DO NOT list all questions.`;
      } else if (sessionData.session_prompt) {
        userPrompt = `The user just created a new co-authoring session with you. They described what they want to work on: "${sessionData.session_prompt}"

Generate a brief, friendly initial chat message (1-2 sentences) that:
1. Acknowledges what they want to work on
2. Asks ONE clarifying question that would help you write better (tone, genre, audience, perspective, mood, or any detail that informs style)
3. Stay in character with your personality`;
      } else {
        userPrompt = `The user just created a new co-authoring session but didn't specify what they want to work on yet. Generate a brief, friendly initial greeting (1 sentence) asking what they're working on. Stay in character with your personality.`;
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({
          messages: [{ role: 'user' as const, content: userPrompt }],
          systemPrompt,
          promptType: 'coauthor_greeting',
          maxTokens: 150,
          model: MODEL_CONFIG.PREMIUM_MODEL,
        }),
      });

      if (!response.ok) throw new Error('Failed to generate greeting');

      const data = await response.json();
      let aiResponse = '';
      if (data.content?.[0]?.text) {
        aiResponse = data.content[0].text;
      } else if (typeof data.message === 'string') {
        aiResponse = data.message;
      }

      if (!aiResponse) {
        aiResponse = sessionData.session_prompt
          ? `Hey! So we're working on: "${sessionData.session_prompt}". What direction are you thinking?`
          : `Hey! What are we working on?`;
      }

      const greetingMessage = await coAuthorService.createChatMessage(sessionId, 'avatar', aiResponse);
      setChatMessages(prev => [...prev, greetingMessage]);
    } catch (error) {
      console.error('Error creating initial greeting:', error);
      const fallbackGreeting = sessionData.session_prompt
        ? `Hey! So we're working on: "${sessionData.session_prompt}". What direction are you thinking?`
        : `Hey! What are we working on?`;
      try {
        const greetingMessage = await coAuthorService.createChatMessage(sessionId, 'avatar', fallbackGreeting);
        setChatMessages(prev => [...prev, greetingMessage]);
      } catch (e) {
        console.error('Fallback greeting error:', e);
      }
    }
  };

  const handleChatSend = async (message: string) => {
    if (!session || isChatLoading) return;
    try {
      setIsChatLoading(true);
      const userMessage = await coAuthorService.createChatMessage(sessionId, 'user', message);
      setChatMessages(prev => [...prev, userMessage]);

      const context = buildChatContext();
      const systemPrompt = (buildChatSystemPrompt() || `You are a helpful co-authoring assistant named ${companionName || 'Assistant'}. Keep responses conversational.`) + await fetchMemoryContext();

      const { data: { session: authSession } } = await supabase.auth.getSession();
      const authToken = authSession?.access_token;
      if (!authToken) throw new Error('Authentication required - please log in again');

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({
          messages: [{ role: 'user' as const, content: context + '\n\n' + message }],
          systemPrompt,
          promptType: 'coauthor_chat',
          maxTokens: 500,
          model: MODEL_CONFIG.PREMIUM_MODEL,
        }),
      });

      if (!response.ok) throw new Error(`Edge function error (${response.status})`);

      const data = await response.json();
      let aiResponse = '';
      if (data.content?.[0]?.text) {
        aiResponse = data.content[0].text;
      } else if (typeof data.message === 'string') {
        aiResponse = data.message;
      } else if (typeof data.text === 'string') {
        aiResponse = data.text;
      }

      if (!aiResponse) throw new Error('No valid response content found');

      const avatarMessage = await coAuthorService.createChatMessage(sessionId, 'avatar', aiResponse);
      setChatMessages(prev => [...prev, avatarMessage]);
    } catch (error) {
      console.error('Error sending chat message:', error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      setCanvasError(`Failed to send message: ${msg}`);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleSave = async () => {
    if (!session || !hasUnsavedChanges) return;
    try {
      setIsSaving(true);
      await supabase.from('co_author_blocks').delete().eq('session_id', sessionId);
      await coAuthorService.createBlock(sessionId, 'user', documentContent, 0);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Error saving document:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDocumentChange = (newContent: string) => {
    setDocumentContent(newContent);
    setHasUnsavedChanges(true);
  };

  const handleEditorStyleChange = (newStyles: EditorStyles) => {
    setEditorStyles(newStyles);
    if (stylesSaveTimeoutRef.current) clearTimeout(stylesSaveTimeoutRef.current);
    stylesSaveTimeoutRef.current = setTimeout(async () => {
      try {
        await supabase.from('co_author_sessions').update({ editor_preferences: newStyles }).eq('id', sessionId);
      } catch (error) {
        console.error('Error saving editor preferences:', error);
      }
    }, 500);
  };

  const handleUpdateSession = async (updates: Partial<CoAuthorSession>) => {
    if (!session) return;
    try {
      const updated = await coAuthorService.updateSession(sessionId, updates);
      setSession(updated);
    } catch (error) {
      console.error('Error updating session:', error);
    }
  };

  const callAiApi = async (systemPrompt: string, userPrompt: string, maxTokens: number = 1000): Promise<string> => {
    const { data: { session: authSession } } = await supabase.auth.getSession();
    const authToken = authSession?.access_token;
    if (!authToken) throw new Error('Authentication required');

    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
      body: JSON.stringify({
        messages: [{ role: 'user' as const, content: userPrompt }],
        systemPrompt,
        promptType: 'coauthor_canvas',
        maxTokens,
        model: MODEL_CONFIG.PREMIUM_MODEL,
      }),
    });

    if (!response.ok) throw new Error('Failed to generate response');

    const data = await response.json();
    if (data.content?.[0]?.text) return data.content[0].text;
    if (typeof data.message === 'string') return data.message;
    if (typeof data.text === 'string') return data.text;
    throw new Error('No valid response content found');
  };

  const handleCoAuthor = async () => {
    if (!session || isGenerating) return;
    setIsGenerating(true);
    try {
      await handleSave();
      const isRevision = detectRevisionRequest(chatMessages);
      const context = buildContext();
      const systemPrompt = buildCanvasSystemPrompt();

      let userPrompt = '';
      if (isRevision) {
        const lastAvatarBlock = await coAuthorService.getMostRecentAvatarBlock(sessionId);
        userPrompt = lastAvatarBlock
          ? context + `\n\nThe user gave feedback in chat about your last contribution. Here's what you wrote:\n\n"${lastAvatarBlock.content}"\n\nPlease revise it based on their feedback and write a new version.`
          : context + '\n\nContinue writing from where the document left off.';
      } else {
        userPrompt = context + '\n\nContinue writing from where the document left off. Pick up naturally from the last sentence and continue the flow.';
      }

      const aiResponse = await callAiApi(systemPrompt, userPrompt, 1000);

      const cursorPos = editorRef.current?.getCursorPosition() ?? documentContent.length;
      const needsSpace = cursorPos > 0 && !documentContent[cursorPos - 1]?.match(/[\s\n]/);
      const textToInsert = (needsSpace ? ' ' : '') + aiResponse;

      let currentIndex = 0;
      const streamInterval = setInterval(() => {
        if (currentIndex < textToInsert.length) {
          editorRef.current?.insertAtCursor(textToInsert[currentIndex]);
          currentIndex++;
        } else {
          clearInterval(streamInterval);
          setIsGenerating(false);
          setHasUnsavedChanges(true);
        }
      }, 20);
    } catch (error) {
      console.error('Error generating response:', error);
      setCanvasError('Failed to generate response. Please try again.');
      setIsGenerating(false);
    }
  };

  const handleInlineAction = useCallback(async (action: InlineAction, selectedText: string, start: number, end: number) => {
    if (!session || isActionLoading) return;
    setIsActionLoading(true);
    try {
      const actionPrompts: Record<InlineAction, string> = {
        'rewrite_concise': 'Rewrite the following text to be more concise. Keep the meaning but make it tighter and shorter. Return ONLY the rewritten text, no commentary.',
        'rewrite_expand': 'Expand the following text with more detail and richness. Add depth without changing the meaning. Return ONLY the expanded text, no commentary.',
        'rewrite_funny': 'Rewrite the following text to be funnier and more playful while keeping the core message. Return ONLY the rewritten text, no commentary.',
        'rewrite_formal': 'Rewrite the following text to be more formal and professional. Return ONLY the rewritten text, no commentary.',
        'fix_grammar': 'Fix any grammar, spelling, or flow issues in the following text. Keep the meaning and tone the same. Return ONLY the corrected text, no commentary.',
        'continue': 'Continue writing from where this text ends. Pick up naturally and continue the flow. Return ONLY the new text to append, no commentary.',
      };

      const systemPrompt = buildCanvasSystemPrompt();
      const userPrompt = `${actionPrompts[action]}\n\nText:\n${selectedText}`;

      const aiResponse = await callAiApi(systemPrompt, userPrompt, 600);

      if (action === 'continue') {
        editorRef.current?.replaceRange(end, end, ' ' + aiResponse);
      } else {
        editorRef.current?.replaceRange(start, end, aiResponse);
      }
      setHasUnsavedChanges(true);
    } catch (error) {
      console.error('Inline action error:', error);
      setCanvasError('Failed to apply AI action. Please try again.');
    } finally {
      setIsActionLoading(false);
    }
  }, [session, isActionLoading]);

  const handleGenerateOutline = async () => {
    if (!session || isGeneratingOutline) return;
    setIsGeneratingOutline(true);
    try {
      const tpl = template;
      const systemPrompt = buildCanvasSystemPrompt();
      const suggestedSections = tpl?.suggestedOutline.join(', ') || 'Introduction, Main Body, Conclusion';
      const userPrompt = `Generate a document outline for this ${session.purpose} project: "${session.title}".
${session.session_prompt ? `Session description: ${session.session_prompt}` : ''}
${tpl ? `Template type: ${tpl.label}. Suggested sections: ${suggestedSections}.` : ''}

Return ONLY a JSON array of section objects with "title" and "status" fields (status should be "pending"):
[{"title": "Section Name", "status": "pending"}]

Generate 4-6 sections that make sense for this type of document. Be specific to the topic.`;

      const response = await callAiApi(systemPrompt, userPrompt, 400);
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : response) as Array<{ title: string; status: string }>;

      const sections: OutlineSection[] = parsed.map((s, i) => ({
        id: `section-${Date.now()}-${i}`,
        title: s.title,
        status: 'pending' as const,
      }));

      setOutline(sections);
      setShowOutline(true);
      await handleUpdateSession({ outline: sections, outline_completed: false });
    } catch (error) {
      console.error('Outline generation error:', error);
      // Fall back to template suggested outline
      if (template) {
        const fallback: OutlineSection[] = template.suggestedOutline.map((title, i) => ({
          id: `section-${Date.now()}-${i}`,
          title,
          status: 'pending' as const,
        }));
        setOutline(fallback);
        setShowOutline(true);
        await handleUpdateSession({ outline: fallback, outline_completed: false });
      } else {
        setCanvasError('Failed to generate outline. Please try again.');
      }
    } finally {
      setIsGeneratingOutline(false);
    }
  };

  const handleOutlineSectionClick = (section: OutlineSection) => {
    const header = `\n\n## ${section.title}\n\n`;
    const cursorPos = editorRef.current?.getCursorPosition() ?? documentContent.length;
    editorRef.current?.insertAtCursor(header);
    setHasUnsavedChanges(true);

    // Mark section as in-progress
    const updated = outline.map(s => s.id === section.id ? { ...s, status: 'in-progress' as const } : s);
    setOutline(updated);
    handleUpdateSession({ outline: updated });
  };

  const handleCompleteOutline = async () => {
    const updated = outline.map(s => ({ ...s, status: 'completed' as const }));
    setOutline(updated);
    setShowOutline(false);
    await handleUpdateSession({ outline: updated, outline_completed: true });
  };

  const detectRevisionRequest = (recentMessages: CoAuthorChatMessage[]): boolean => {
    const revisionKeywords = ['too', 'make it', 'try again', 'revise', 'change', 'rewrite', 'different', 'better', 'fix', 'redo'];
    const lastFewMessages = recentMessages.slice(-5);
    return lastFewMessages.filter(m => m.sender_type === 'user').some(msg => {
      const content = msg.message_content.toLowerCase();
      return revisionKeywords.some(keyword => content.includes(keyword));
    });
  };

  const buildChatContext = (): string => {
    if (!session) return '';
    let context = `Co-Author Session Context:\nTitle: ${session.title}\nPurpose: ${session.purpose}`;
    if (session.session_prompt) context += `\n\nSession Instructions: ${session.session_prompt}`;
    const recentMessages = chatMessages.slice(-10);
    if (recentMessages.length > 0) {
      context += `\n\nRecent Chat:\n`;
      recentMessages.forEach(msg => {
        const sender = msg.sender_type === 'user' ? 'User' : companionName;
        context += `${sender}: ${msg.message_content}\n`;
      });
    }
    if (documentContent) {
      context += `\n\nCurrent Canvas Content:\n${documentContent.substring(0, 500)}${documentContent.length > 500 ? '...' : ''}`;
    }
    return context;
  };

  const buildChatSystemPrompt = (): string => {
    if (!session || !companionData) return '';
    const systemPrompt = buildSystemPrompt({
      companionName: companionData.custom_name,
      companionGender: companionData.character_type || 'female',
      userName: userData?.full_name || 'there',
      userGender: userData?.gender || 'unknown',
      userAge: userData?.age || 25,
      interests: companionData.interest_text || '',
      hobbies: companionData.hobbies || '',
      favoriteColor: companionData.favorite_color,
      musicGenre: companionData.music_genre,
      newsTopics: companionData.news_categories,
      relationshipType: companionData.relationship_type || 'friend',
      signatureVoice: companionData.signature_voice || 'authentic',
      questionnaireData: buildQuestionnaireData(companionData),
    });

    const templateRole = template?.systemRole ? `\n${template.systemRole}\n` : '';

    return `${systemPrompt}

You are in a Co-Author session, having a conversation in the chat sidebar about a ${session.purpose.toLowerCase()} project titled "${session.title}".${templateRole}
${session.session_prompt ? `Session Goal: ${session.session_prompt}` : ''}

IMPORTANT: This is just chat discussion. You are NOT writing to the canvas here. Keep responses conversational and ${session.length_preference} in length. Discuss ideas, give feedback, and help brainstorm, but don't write actual content blocks here.`;
  };

  const buildContext = (): string => {
    if (!session) return '';
    let context = `Co-Author Session Context:\nTitle: ${session.title}\nPurpose: ${session.purpose}`;
    if (session.session_prompt) context += `\n\nSession Description: ${session.session_prompt}`;
    context += `\n\nCurrent Document Content:\n${documentContent || '[Document is empty - this is the beginning]'}`;
    return context;
  };

  const buildCanvasSystemPrompt = (): string => {
    if (!session || !companionData) return '';

    const lengthGuide = {
      '1-2 sentences': 'Keep contributions very brief (1-2 sentences).',
      '3-4 sentences': 'Provide 3-4 sentences.',
      '1 paragraph': 'Provide a single paragraph contribution.',
      '2-3 paragraphs': 'Provide 2-3 paragraphs.'
    };

    const purposeGuide = {
      'Writing': 'You are co-writing creative content. Focus on storytelling, narrative flow, character development, and engaging prose. Be expressive and creative.',
      'Research': 'You are helping with research and structured content. Focus on clarity, organization, facts, and well-organized information. Be analytical and thorough.'
    };

    const basePrompt = buildSystemPrompt({
      companionName: companionData.custom_name,
      companionGender: companionData.character_type || 'female',
      userName: userData?.full_name || 'there',
      userGender: userData?.gender || 'unknown',
      userAge: userData?.age || 25,
      interests: companionData.interest_text || '',
      hobbies: companionData.hobbies || '',
      favoriteColor: companionData.favorite_color,
      musicGenre: companionData.music_genre,
      newsTopics: companionData.news_categories,
      relationshipType: companionData.relationship_type || 'friend',
      signatureVoice: companionData.signature_voice || 'authentic',
      questionnaireData: buildQuestionnaireData(companionData),
    });

    const templateRole = template?.systemRole ? `\n${template.systemRole}\n` : '';

    return `${basePrompt}

You are co-authoring a document with ${userData?.full_name || 'your user'}. You are writing in the same document together, like two writers collaborating.
${templateRole}
Session Purpose: ${purposeGuide[session.purpose]}

Contribution Length: ${lengthGuide[session.length_preference]}

${session.session_prompt ? `Session Goal: ${session.session_prompt}` : ''}

CRITICAL INSTRUCTIONS:
- Continue writing naturally from where the document left off
- Pick up from the last sentence and maintain narrative/topical flow
- Do NOT add meta-commentary like "Here's my contribution" or "I'll continue with..."
- Write as if you're typing directly into the document
- Stay in character with your personality and signature voice
- If the document is empty, start the content based on the session goal
- Your response should be ONLY the text to add to the document
- DO NOT repeat or rewrite what's already in the document`;
  };

  const exportAsText = () => {
    if (!session) return;
    const blob = new Blob([documentContent], { type: 'text/plain' });
    downloadBlob(blob, `${session.title.replace(/[^a-z0-9]/gi, '_')}.txt`);
    setShowExportMenu(false);
  };

  const exportAsMarkdown = () => {
    if (!session) return;
    let md = `# ${session.title}\n\n`;
    if (session.session_prompt) md += `> ${session.session_prompt}\n\n`;
    md += documentContent;
    const blob = new Blob([md], { type: 'text/markdown' });
    downloadBlob(blob, `${session.title.replace(/[^a-z0-9]/gi, '_')}.md`);
    setShowExportMenu(false);
  };

  const exportAsHtml = () => {
    if (!session) return;
    const paragraphs = documentContent.split(/\n\n+/).map(p => `<p>${p.replace(/\n/g, '<br/>')}</p>`).join('\n');
    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${session.title}</title>
<style>
body { font-family: Georgia, serif; max-width: 800px; margin: 40px auto; line-height: 1.8; color: #1a1a1a; }
h1 { font-size: 28px; }
h2 { font-size: 22px; margin-top: 32px; }
p { margin-bottom: 16px; }
</style>
</head>
<body>
<h1>${session.title}</h1>
${paragraphs}
</body>
</html>`;
    const blob = new Blob([html], { type: 'text/html' });
    downloadBlob(blob, `${session.title.replace(/[^a-z0-9]/gi, '_')}.html`);
    setShowExportMenu(false);
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!session) return null;

  const completedSections = outline.filter(s => s.status === 'completed').length;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <button onClick={() => navigate('/co-author')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <input
              type="text"
              value={session.title}
              onChange={(e) => handleUpdateSession({ title: e.target.value })}
              className="text-xl font-semibold text-gray-900 bg-transparent border-none outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1 flex-1 max-w-md"
              placeholder="Untitled Document"
            />
            {template && (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-violet-100 text-violet-700 border border-violet-200">
                {template.label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 relative">
            {isSaving && (
              <span className="text-sm text-gray-500 flex items-center gap-2">
                <Loader className="w-4 h-4 animate-spin" /> Saving...
              </span>
            )}
            {hasUnsavedChanges && !isSaving && (
              <span className="text-sm text-amber-600">Unsaved changes</span>
            )}
            <button
              onClick={() => setShowOutline(!showOutline)}
              disabled={outline.length === 0}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Toggle outline"
            >
              <ListChecks className="w-4 h-4" /> Outline
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
            >
              <Settings className="w-4 h-4" /> Settings
            </button>
            <button
              onClick={handleSave}
              disabled={!hasUnsavedChanges}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" /> Save
            </button>
            {/* Export dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" /> Export
              </button>
              {showExportMenu && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl py-1 z-50 min-w-[160px]">
                  <button onClick={exportAsText} className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                    <FileDown className="w-4 h-4 text-gray-400" /> Plain Text (.txt)
                  </button>
                  <button onClick={exportAsMarkdown} className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                    <FileType className="w-4 h-4 text-gray-400" /> Markdown (.md)
                  </button>
                  <button onClick={exportAsHtml} className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                    <FileType className="w-4 h-4 text-gray-400" /> HTML (.html)
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={handleCoAuthor}
              disabled={isGenerating}
              className="px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all flex items-center gap-2 font-medium shadow-sm"
              style={{ background: isGenerating ? undefined : `linear-gradient(to right, ${avatarColor}, ${avatarColor}dd)` }}
            >
              {isGenerating ? (
                <><Loader className="w-5 h-5 animate-spin" /> {companionName} is writing...</>
              ) : (
                <><Sparkles className="w-5 h-5" /> Co-Author</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Outline bar */}
      {showOutline && outline.length > 0 && (
        <div className="bg-violet-50 border-b border-violet-200 px-6 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-violet-600" />
              <span className="text-sm font-semibold text-violet-900">Outline</span>
              <span className="text-xs text-violet-500">({completedSections}/{outline.length} sections)</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleCompleteOutline} className="text-xs text-violet-600 hover:text-violet-800 font-medium">
                Mark all complete & close
              </button>
              <button onClick={() => setShowOutline(false)} className="text-violet-400 hover:text-violet-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {outline.map((section, i) => (
              <button
                key={section.id}
                onClick={() => handleOutlineSectionClick(section)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  section.status === 'completed'
                    ? 'bg-green-100 text-green-700 border border-green-200'
                    : section.status === 'in-progress'
                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : 'bg-white text-violet-700 border border-violet-200 hover:border-violet-400'
                }`}
              >
                <span className="text-xs opacity-60">{i + 1}.</span>
                {section.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Generate outline button (only when no outline and template exists) */}
      {!showOutline && outline.length === 0 && template && (
        <div className="bg-violet-50 border-b border-violet-200 px-6 py-2.5">
          <button
            onClick={handleGenerateOutline}
            disabled={isGeneratingOutline}
            className="text-sm text-violet-600 hover:text-violet-800 font-medium flex items-center gap-2 disabled:opacity-50"
          >
            {isGeneratingOutline ? (
              <><Loader className="w-4 h-4 animate-spin" /> Generating outline...</>
            ) : (
              <><ListChecks className="w-4 h-4" /> Generate an outline to structure your document</>
            )}
          </button>
        </div>
      )}

      {showSettings && (
        <div className="bg-blue-50 border-b border-blue-200 px-6 py-4">
          <InstructionPanel session={session} onUpdateSession={handleUpdateSession} />
        </div>
      )}

      <div className="flex-1 overflow-hidden flex">
        <div className={`flex-1 overflow-hidden transition-all duration-300 ${showChat ? 'lg:w-[65%]' : 'w-full'}`}>
          <div className="h-full px-6 py-6">
            <CollaborativeEditor
              ref={editorRef}
              value={documentContent}
              onChange={handleDocumentChange}
              disabled={isGenerating}
              aiColor={avatarColor}
              editorStyles={editorStyles}
              onStyleChange={handleEditorStyleChange}
              userFavoriteColor={userFavoriteColor}
              onInlineAction={handleInlineAction}
              isActionLoading={isActionLoading}
              placeholder={`Start typing your ${session.purpose.toLowerCase()} here, or click "Co-Author" to have ${companionName} begin...`}
            />
          </div>
        </div>

        <div className={`hidden lg:block transition-all duration-300 ${showChat ? 'lg:w-[35%]' : 'w-0'}`}>
          {showChat && (
            <CoAuthorChatPanel
              companionName={companionName}
              companionAvatarConfig={companionAvatarConfig}
              userAvatarConfig={userAvatarConfig}
              messages={chatMessages}
              onSendMessage={handleChatSend}
              isLoading={isChatLoading}
              favoriteColor={avatarColor}
            />
          )}
        </div>

        <button
          onClick={() => setShowChat(!showChat)}
          className="lg:hidden fixed bottom-24 right-6 w-14 h-14 bg-gradient-to-br from-primary-500 to-primary-600 text-white rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform z-50"
        >
          {showChat ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
        </button>

        {showChat && (
          <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setShowChat(false)}>
            <div className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
              <CoAuthorChatPanel
                companionName={companionName}
                companionAvatarConfig={companionAvatarConfig}
                userAvatarConfig={userAvatarConfig}
                messages={chatMessages}
                onSendMessage={handleChatSend}
                isLoading={isChatLoading}
                favoriteColor={avatarColor}
              />
            </div>
          </div>
        )}
      </div>

      <div className="bg-white border-t border-gray-200 px-6 py-3">
        <div className="max-w-6xl mx-auto">
          <p className="text-xs text-gray-500 text-center">
            Type directly or select text for AI actions • Click <span className="font-semibold">Co-Author</span> to have {companionName} continue • Export as TXT, MD, or HTML
          </p>
        </div>
      </div>

      {canvasError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-red-900/90 border border-red-500/40 text-red-200 px-5 py-3 rounded-xl flex items-center gap-3 shadow-xl max-w-sm w-full">
          <span className="text-sm flex-1">{canvasError}</span>
          <button onClick={() => setCanvasError(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
