import { useState, useEffect } from 'react';
import { RotateCcw } from 'lucide-react';
import { CharacterCard } from './components/CharacterCard';
import { ChatContainer } from './components/ChatContainer';
import { ChatInput } from './components/ChatInput';
import { PricingPage } from './components/PricingPage';
import { Message } from './types';
import { ChatService } from './services/chatService';
import { supabase } from './services/supabase';
import {
  getConversationData,
  addMessage,
  getRemainingMessages,
  canSendMessage,
} from './utils/storage';
import { SubscriptionTier } from './types/subscription';

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [remainingMessages, setRemainingMessages] = useState(50);
  const [isTyping, setIsTyping] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [showPricing, setShowPricing] = useState(false);
  const [currentTier, setCurrentTier] = useState<SubscriptionTier>('free');
  const [showGamesMenu, setShowGamesMenu] = useState(false);
  const [chatMode, setChatMode] = useState<'chat' | 'assistant'>('chat');

  // ADD THIS NEW CODE HERE:
  const getSelectedCharacter = () => {
    try {
      const matchData = JSON.parse(localStorage.getItem('matchAnswers') || '{}');
      return matchData.selectedAvatar || 'riley';
    } catch (error) {
      return 'riley';
    }
  };
  
  const selectedCharacter = getSelectedCharacter();
  const currentMood = 'positive';

  // Then your return statement:
  return (
    <BrowserRouter>
      ...

  useEffect(() => {
    checkAuthAndOnboarding();
  }, []);

  const checkAuthAndOnboarding = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        const matchData = JSON.parse(localStorage.getItem('matchAnswers') || '{}');
        if (matchData.userName) {
          await createUserAccount(matchData);
        }
        setIsCheckingAuth(false);
        return;
      }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('subscription_tier')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.subscription_tier) {
        setCurrentTier(profile.subscription_tier as SubscriptionTier);
      }

      await loadMessages();
    } catch (error) {
      console.error('Error checking auth:', error);
    } finally {
      setIsCheckingAuth(false);
    }
  };

  useEffect(() => {
    if (!isCheckingAuth) {
      loadMessages();
    }
  }, [isCheckingAuth]);

  const loadMessages = async () => {
    try {
      const history = await ChatService.getConversationHistory(50);
      const formattedMessages: Message[] = history.map(msg => ({
        id: msg.id,
        content: msg.content,
        sender: msg.role === 'user' ? 'user' : 'ai',
        timestamp: new Date(msg.created_at).getTime(),
      }));
      setMessages(formattedMessages);

      if (formattedMessages.length === 0) {
        await sendFirstMessage();
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      const data = getConversationData();
      setMessages(data.messages);
    }
    setRemainingMessages(getRemainingMessages());
  };

  const sendFirstMessage = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('character_type, name')
        .eq('id', user.id)
        .maybeSingle();

      const characterType = profile?.character_type || 'riley';
      const userName = profile?.name || 'there';

      const userPreferences = JSON.parse(localStorage.getItem('userPreferences') || '{}');

      const { firstMessageService } = await import('./services/firstMessageService');
      const { getCharacter } = await import('./config/characters');
      const character = getCharacter(characterType);

      const thinkingDelay = 1000 + Math.random() * 1500;
      await new Promise(resolve => setTimeout(resolve, thinkingDelay));

      setIsTyping(true);

      const firstMsg = await firstMessageService.generateFirstMessage(
        character,
        userName,
        userPreferences
      );

      const typingDelay = Math.min(firstMsg.length * 15, 3000);
      await new Promise(resolve => setTimeout(resolve, typingDelay));

      setIsTyping(false);

      await ChatService.saveMessage('assistant', firstMsg);
      await firstMessageService.markFirstMessageSent(user.id);

      const aiMessage: Message = {
        id: `${Date.now()}-ai`,
        content: firstMsg,
        sender: 'ai',
        timestamp: Date.now(),
        isTyping: true,
      };

      setMessages([aiMessage]);
      addMessage(aiMessage);
    } catch (error) {
      console.error('Error sending first message:', error);
      setIsTyping(false);
    }
  };

  const handleSendMessage = async (content: string) => {
    console.log('handleSendMessage called with:', content);
    console.log('canSendMessage:', canSendMessage());
    console.log('isTyping:', isTyping);

    if (!canSendMessage() || isTyping) {
      console.log('Message blocked - canSend:', canSendMessage(), 'isTyping:', isTyping);
      return;
    }

    const userMessage: Message = {
      id: `${Date.now()}-user`,
      content,
      sender: 'user',
      timestamp: Date.now(),
    };

    console.log('Adding user message:', userMessage);
    setMessages(prev => [...prev, userMessage]);
    addMessage(userMessage);
    setRemainingMessages(getRemainingMessages());

    const thinkingDelay = 800 + Math.random() * 1200;
    await new Promise(resolve => setTimeout(resolve, thinkingDelay));

    setIsTyping(true);

    try {
      console.log('Calling ChatService.sendMessage...');
      const response = await ChatService.sendMessage(content);
      console.log('Got response:', response);
      console.log('Response type:', typeof response);
      console.log('Response length:', response?.length);

      const typingDelay = Math.min(response.length * 15, 3000);
      await new Promise(resolve => setTimeout(resolve, typingDelay));

      setIsTyping(false);

      const aiMessage: Message = {
        id: `${Date.now()}-ai`,
        content: response,
        sender: 'ai',
        timestamp: Date.now(),
        isTyping: true,
      };

      console.log('Created AI message object:', aiMessage);
      console.log('AI message content:', aiMessage.content);

      setMessages(prev => {
        const updated = [...prev, aiMessage];
        console.log('Updated messages array:', updated);
        return updated;
      });
      addMessage(aiMessage);
      setRemainingMessages(getRemainingMessages());
    } catch (error) {
      console.error('Error sending message:', error);
      setIsTyping(false);

      const errorMessage: Message = {
        id: `${Date.now()}-error`,
        content: error instanceof Error ? error.message : "Sorry babe, I'm having trouble connecting right now. Try again?",
        sender: 'ai',
        timestamp: Date.now(),
        isTyping: true,
      };

      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const handleReset = async () => {
    const confirmed = window.confirm(
      'Are you sure? This will delete your current companion and all conversation history.'
    );

    if (!confirmed) return;

    try {
      await supabase.auth.signOut();
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/';
    } catch (error) {
      console.error('Error during reset:', error);
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/';
    }
  };

  const createUserAccount = async (matchData: any) => {
    try {
      const randomEmail = `user_${Date.now()}@aicompanion.app`;
      const randomPassword = `pwd_${Math.random().toString(36).slice(2)}${Date.now()}`;

      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: randomEmail,
        password: randomPassword,
        options: {
          data: {
            character_type: matchData.selectedAvatar,
            user_name: matchData.userName,
          },
        },
      });

      if (signUpError) {
        console.error('Error signing up:', signUpError);
        return;
      }

      if (authData.user) {
        await ChatService.completeOnboarding(matchData.selectedAvatar as any, {});

        await supabase
          .from('user_profiles')
          .update({ name: matchData.userName })
          .eq('id', authData.user.id);

        await loadMessages();
      }
    } catch (error) {
      console.error('Error creating user account:', error);
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 via-pink-50 to-orange-50">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-14 w-14 border-b-3 border-primary-500 mx-auto"></div>
            <div className="absolute inset-0 rounded-full bg-primary-100 opacity-20 animate-pulse-slow"></div>
          </div>
          <p className="mt-5 text-gray-600 font-medium">Loading...</p>
        </div>
      </div>
    );
  }


  return (
    <div className="h-screen flex flex-col bg-gradient-to-b from-gray-50 to-white">
      <div className="fixed top-4 right-4 z-50 flex gap-2">
        <button
          onClick={() => setChatMode(chatMode === 'chat' ? 'assistant' : 'chat')}
          className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg shadow-lg border-2 border-gray-200 hover:border-rose-300 hover:shadow-xl transition-all duration-200"
          title={chatMode === 'chat' ? 'Switch to Assistant Mode' : 'Switch to Chat Mode'}
        >
          <span className="text-lg">{chatMode === 'chat' ? '💬' : '🌐'}</span>
          <div className="text-left">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {chatMode === 'chat' ? 'Chat' : 'Assistant'}
            </div>
          </div>
        </button>
        <div className="relative">
          <button
            onClick={() => setShowGamesMenu(!showGamesMenu)}
            className="px-3 py-2 bg-gradient-to-r from-rose-400 to-pink-500 text-white rounded-lg font-semibold hover:from-rose-500 hover:to-pink-600 flex items-center gap-2 transition-all shadow-lg hover:shadow-xl"
          >
            🎮 Play Together
          </button>

          {showGamesMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowGamesMenu(false)}
              />

              <div className="absolute top-full right-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-200 py-2 min-w-[240px] z-50">
                <button
                  onClick={() => {
                    handleSendMessage("hey wanna play truth or dare? 😊");
                    setShowGamesMenu(false);
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-gradient-to-r hover:from-rose-50 hover:to-pink-50 transition-all flex items-center gap-3"
                >
                  <span className="text-2xl">💕</span>
                  <div>
                    <div className="font-semibold text-gray-800">Truth or Dare</div>
                    <div className="text-xs text-gray-500">Get to know each other deeper</div>
                  </div>
                </button>

                <div className="px-4 py-2 mt-1 border-t border-gray-100">
                  <p className="text-xs text-gray-400 italic">More games coming soon...</p>
                </div>
              </div>
            </>
          )}
        </div>

        <button
          onClick={() => setShowPricing(true)}
          className="bg-gradient-to-r from-blue-500 to-sky-500 text-white px-4 py-2 rounded-lg font-semibold hover:from-blue-600 hover:to-sky-600 shadow-lg hover:shadow-xl transition-all duration-200"
        >
          {currentTier === 'free' ? 'Upgrade' : 'Manage Plan'}
        </button>
        <button
          onClick={handleReset}
          className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-1.5 shadow-lg hover:shadow-xl"
          title="Start Over - Clear all data and return to character creation"
        >
          <RotateCcw size={16} />
          Reset
        </button>
      </div>
      <CharacterCard character={selectedCharacter} mood={currentMood} />
      <ChatContainer messages={messages} characterName={getCharacterName(selectedCharacter)} />
      <ChatInput
        onSend={handleSendMessage}
        disabled={!canSendMessage() || isTyping}
        remainingMessages={remainingMessages}
      />
      {isTyping && (
        <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 glass-effect px-5 py-3 rounded-full shadow-soft border border-white/20 animate-slide-up">
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
            <p className="text-sm text-gray-600 font-medium">Riley is typing</p>
          </div>
        </div>
      )}
      {showPricing && (
        <PricingPage
          currentTier={currentTier}
          onClose={() => setShowPricing(false)}
        />
      )}
    </div>
  );
}

export default App;
