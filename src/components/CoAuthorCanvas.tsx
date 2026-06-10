import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Download, Save, Loader, Settings, MessageCircle, X } from 'lucide-react';
import { CollaborativeEditor, CollaborativeEditorHandle, EditorStyles } from './CollaborativeEditor';
import { InstructionPanel } from './InstructionPanel';
import { CoAuthorChatPanel } from './CoAuthorChatPanel';
import { coAuthorService, CoAuthorSession, CoAuthorChatMessage } from '../services/coAuthorService';
import { getCompanion } from '../services/companionService';
import { supabase } from '../shared/supabase/client';
import { AvatarConfig } from '../types/avatar';
import { buildSystemPrompt } from '../config/systemPromptBuilder';
import { colorNameToHex } from '../utils/colorMapping';

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
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const stylesSaveTimeoutRef = useRef<NodeJS.Timeout>();
  const isCreatingGreetingRef = useRef(false);

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
      await coAuthorService.updateLastAccessed(sessionId);

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

        const greetingMessage = await coAuthorService.createChatMessage(
          sessionId,
          'avatar',
          fallbackGreeting
        );
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
      });

      let userPrompt = '';
      if (sessionData.session_prompt) {
        userPrompt = `The user just created a new co-authoring session with you. They described what they want to work on: "${sessionData.session_prompt}"

Generate a brief, friendly initial chat message (1-2 sentences) that:
1. Acknowledges what they want to work on
2. Asks ONE clarifying question that would help you write better (tone, genre, audience, perspective, mood, or any detail that informs style)
3. Stay in character with your personality

Examples:
- "Cups coming to life... love it. Are we going dark and existential or keeping it light and funny?"
- "Okay, resignation letter. Are we burning bridges or keeping it professional?"
- "Time travel — classic. Are we doing paradoxes and consequences, or more of an adventure vibe?"

DO NOT use the examples above. Generate a unique, natural response specific to their prompt.`;
      } else {
        userPrompt = `The user just created a new co-authoring session but didn't specify what they want to work on yet. Generate a brief, friendly initial greeting (1 sentence) asking what they're working on. Stay in character with your personality.`;
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          messages: [{ role: 'user' as const, content: userPrompt }],
          systemPrompt,
          maxTokens: 150,
          model: 'claude-sonnet-4-5-20250929',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate greeting');
      }

      const data = await response.json();
      let aiResponse = '';
      if (data.content && Array.isArray(data.content) && data.content.length > 0) {
        const firstContent = data.content[0];
        if (firstContent && firstContent.type === 'text' && typeof firstContent.text === 'string') {
          aiResponse = firstContent.text;
        }
      }

      if (!aiResponse) {
        const fallbackGreeting = sessionData.session_prompt
          ? `Hey! So we're working on: "${sessionData.session_prompt}". What direction are you thinking?`
          : `Hey! What are we working on?`;
        aiResponse = fallbackGreeting;
      }

      const greetingMessage = await coAuthorService.createChatMessage(
        sessionId,
        'avatar',
        aiResponse
      );

      setChatMessages(prev => [...prev, greetingMessage]);
    } catch (error) {
      console.error('Error creating initial greeting:', error);

      const fallbackGreeting = sessionData.session_prompt
        ? `Hey! So we're working on: "${sessionData.session_prompt}". What direction are you thinking?`
        : `Hey! What are we working on?`;

      try {
        const greetingMessage = await coAuthorService.createChatMessage(
          sessionId,
          'avatar',
          fallbackGreeting
        );
        setChatMessages(prev => [...prev, greetingMessage]);
      } catch (fallbackError) {
        console.error('Error creating fallback greeting:', fallbackError);
      }
    }
  };

  const handleChatSend = async (message: string) => {
    if (!session || isChatLoading) return;

    try {
      setIsChatLoading(true);

      const userMessage = await coAuthorService.createChatMessage(
        sessionId,
        'user',
        message
      );
      setChatMessages(prev => [...prev, userMessage]);

      const context = buildChatContext();
      const systemPrompt = buildChatSystemPrompt() || `You are a helpful co-authoring assistant named ${companionName || 'Assistant'}. Keep responses conversational.`;

      const { data: { session: authSession } } = await supabase.auth.getSession();
      const authToken = authSession?.access_token;

      if (!authToken) {
        throw new Error('Authentication required - please log in again');
      }

      const chatMessages = [
        {
          role: 'user' as const,
          content: context + '\n\n' + message,
        }
      ];

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          messages: chatMessages,
          systemPrompt,
          maxTokens: 500,
          model: 'claude-sonnet-4-5-20250929',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMsg = `Edge function error (${response.status})`;
        try {
          const errorData = JSON.parse(errorText);
          errorMsg = errorData.error || errorData.message || errorMsg;
        } catch {
          errorMsg = errorText || errorMsg;
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();

      let aiResponse = '';
      if (data.content && Array.isArray(data.content) && data.content.length > 0) {
        const firstContent = data.content[0];
        if (firstContent && firstContent.type === 'text' && typeof firstContent.text === 'string') {
          aiResponse = firstContent.text;
        }
      } else if (typeof data.message === 'string') {
        aiResponse = data.message;
      } else if (typeof data.text === 'string') {
        aiResponse = data.text;
      } else if (typeof data.response === 'string') {
        aiResponse = data.response;
      }

      if (!aiResponse) {
        console.error('Unexpected API response shape:', JSON.stringify(data));
        throw new Error('No valid response content found');
      }

      const avatarMessage = await coAuthorService.createChatMessage(
        sessionId,
        'avatar',
        aiResponse
      );
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

      await supabase
        .from('co_author_blocks')
        .delete()
        .eq('session_id', sessionId);

      await coAuthorService.createBlock(
        sessionId,
        'user',
        documentContent,
        0
      );

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
    if (stylesSaveTimeoutRef.current) {
      clearTimeout(stylesSaveTimeoutRef.current);
    }
    stylesSaveTimeoutRef.current = setTimeout(async () => {
      try {
        await supabase
          .from('co_author_sessions')
          .update({ editor_preferences: newStyles })
          .eq('id', sessionId);
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

  const handleCoAuthor = async () => {
    if (!session || isGenerating) return;

    setIsGenerating(true);

    try {
      await handleSave();

      const isRevision = detectRevisionRequest(chatMessages);
      const context = buildContext();
      const systemPrompt = buildCanvasSystemPrompt();

      const { data: { session: authSession } } = await supabase.auth.getSession();
      const authToken = authSession?.access_token;

      if (!authToken) {
        throw new Error('Authentication required');
      }

      let userPrompt = '';
      if (isRevision) {
        const lastAvatarBlock = await coAuthorService.getMostRecentAvatarBlock(sessionId);
        if (lastAvatarBlock) {
          userPrompt = context + `\n\nThe user gave feedback in chat about your last contribution. Here's what you wrote:\n\n"${lastAvatarBlock.content}"\n\nPlease revise it based on their feedback and write a new version.`;
        } else {
          userPrompt = context + '\n\nContinue writing from where the document left off.';
        }
      } else {
        userPrompt = context + '\n\nContinue writing from where the document left off. Pick up naturally from the last sentence and continue the flow.';
      }

      const messages = [
        {
          role: 'user' as const,
          content: userPrompt,
        }
      ];

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          messages,
          systemPrompt,
          maxTokens: 1000,
          model: 'claude-sonnet-4-5-20250929',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || 'Failed to generate response');
      }

      const data = await response.json();

      let aiResponse = '';
      if (data.content && Array.isArray(data.content) && data.content.length > 0) {
        const firstContent = data.content[0];
        if (firstContent && firstContent.type === 'text' && typeof firstContent.text === 'string') {
          aiResponse = firstContent.text;
        }
      } else if (typeof data.message === 'string') {
        aiResponse = data.message;
      } else if (typeof data.text === 'string') {
        aiResponse = data.text;
      } else if (typeof data.response === 'string') {
        aiResponse = data.response;
      }

      if (!aiResponse) {
        throw new Error('No valid response content found in API response');
      }

      const cursorPos = editorRef.current?.getCursorPosition() ?? documentContent.length;
      const needsSpace = cursorPos > 0 && !documentContent[cursorPos - 1]?.match(/[\s\n]/);
      const textToInsert = (needsSpace ? ' ' : '') + aiResponse;

      let currentIndex = 0;
      const streamInterval = setInterval(() => {
        if (currentIndex < textToInsert.length) {
          const char = textToInsert[currentIndex];
          editorRef.current?.insertAtCursor(char);
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

  const detectRevisionRequest = (recentMessages: CoAuthorChatMessage[]): boolean => {
    const revisionKeywords = [
      'too',
      'make it',
      'try again',
      'revise',
      'change',
      'rewrite',
      'different',
      'better',
      'fix',
      'redo'
    ];

    const lastFewMessages = recentMessages.slice(-5);
    const userMessages = lastFewMessages.filter(m => m.sender_type === 'user');

    return userMessages.some(msg => {
      const content = msg.message_content.toLowerCase();
      return revisionKeywords.some(keyword => content.includes(keyword));
    });
  };

  const buildChatContext = (): string => {
    if (!session) return '';

    let context = `Co-Author Session Context:\n`;
    context += `Title: ${session.title}\n`;
    context += `Purpose: ${session.purpose}\n`;

    if (session.session_prompt) {
      context += `\nSession Instructions: ${session.session_prompt}\n`;
    }

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

    return `${systemPrompt}

You are in a Co-Author session, having a conversation in the chat sidebar about a ${session.purpose.toLowerCase()} project titled "${session.title}".

${session.session_prompt ? `Session Goal: ${session.session_prompt}` : ''}

IMPORTANT: This is just chat discussion. You are NOT writing to the canvas here. Keep responses conversational and ${session.length_preference} in length. Discuss ideas, give feedback, and help brainstorm, but don't write actual content blocks here.`;
  };

  const buildContext = (): string => {
    if (!session) return '';

    let context = `Co-Author Session Context:\n`;
    context += `Title: ${session.title}\n`;
    context += `Purpose: ${session.purpose}\n`;

    if (session.session_prompt) {
      context += `\nSession Description: ${session.session_prompt}\n`;
    }

    context += `\nCurrent Document Content:\n`;
    context += documentContent || '[Document is empty - this is the beginning]';

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

    return `${basePrompt}

You are co-authoring a document with ${userData?.full_name || 'your user'}. You are writing in the same document together, like two writers collaborating.

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

  const handleExport = async () => {
    if (!session) return;
    try {
      const blob = new Blob([documentContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${session.title.replace(/[^a-z0-9]/gi, '_')}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting document:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <button
              onClick={() => navigate('/co-author')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <input
              type="text"
              value={session.title}
              onChange={(e) => handleUpdateSession({ title: e.target.value })}
              className="text-xl font-semibold text-gray-900 bg-transparent border-none outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1 flex-1 max-w-md"
              placeholder="Untitled Document"
            />
          </div>
          <div className="flex items-center gap-2">
            {isSaving && (
              <span className="text-sm text-gray-500 flex items-center gap-2">
                <Loader className="w-4 h-4 animate-spin" />
                Saving...
              </span>
            )}
            {hasUnsavedChanges && !isSaving && (
              <span className="text-sm text-amber-600">Unsaved changes</span>
            )}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              Settings
            </button>
            <button
              onClick={handleSave}
              disabled={!hasUnsavedChanges}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              Save
            </button>
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            <button
              onClick={handleCoAuthor}
              disabled={isGenerating}
              className="px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all flex items-center gap-2 font-medium shadow-sm"
              style={{
                background: isGenerating
                  ? undefined
                  : `linear-gradient(to right, ${avatarColor}, ${avatarColor}dd)`
              }}
            >
              {isGenerating ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  {companionName} is writing...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Co-Author
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {showSettings && (
        <div className="bg-blue-50 border-b border-blue-200 px-6 py-4">
          <InstructionPanel
            session={session}
            onUpdateSession={handleUpdateSession}
          />
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
            <div
              className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-white shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
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
            Type directly in the document • Click <span className="font-semibold">Co-Author</span> to have {companionName} continue from your current position • All changes auto-save
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
