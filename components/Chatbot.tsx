import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, Chat } from "@google/genai";
import { InfluencerProfile, ChatMessage } from '../types';
import Spinner from './common/Spinner';

interface ChatbotProps {
  profile: InfluencerProfile;
}

const Chatbot: React.FC<ChatbotProps> = ({ profile }) => {
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initChat = () => {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      const newChat = ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
          systemInstruction: `You are an AI influencer. Your personality and style are described as: "${profile.description}". You must answer all questions strictly from this persona. Be engaging, friendly, and stay in character.`,
        },
      });
      setChat(newChat);
      setMessages([]);
    };
    initChat();
  }, [profile]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSendMessage = useCallback(async () => {
    if (!userInput.trim() || !chat || isLoading) return;
    
    const userMessage: ChatMessage = { role: 'user', text: userInput };
    setMessages(prev => [...prev, userMessage]);
    setUserInput('');
    setIsLoading(true);

    try {
      const response = await chat.sendMessage({ message: userInput });
      const modelMessage: ChatMessage = { role: 'model', text: response.text };
      setMessages(prev => [...prev, modelMessage]);
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: ChatMessage = { role: 'model', text: "Sorry, I'm having a little trouble connecting right now. Let's try again in a moment." };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [userInput, chat, isLoading]);

  return (
    <div className="p-4 bg-dark-card rounded-lg shadow-lg h-full flex flex-col">
      <div className="flex items-center mb-4">
        <img src={`data:${profile.imageMimeType};base64,${profile.image}`} alt="Influencer" className="w-12 h-12 rounded-full object-cover"/>
        <div className='ml-3'>
            <h2 className="text-2xl font-bold">Chat with your Influencer</h2>
            <p className="text-sm text-medium-text">Ask questions and get answers in character.</p>
        </div>
      </div>
      <div className="flex-grow bg-gray-900 rounded-lg p-4 overflow-y-auto mb-4 space-y-4">
        {messages.map((msg, index) => (
          <div key={index} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'model' && <img src={`data:${profile.imageMimeType};base64,${profile.image}`} alt="Influencer" className="w-8 h-8 rounded-full object-cover self-start"/>}
            <div className={`max-w-xs md:max-w-md lg:max-w-lg px-4 py-2 rounded-2xl ${msg.role === 'user' ? 'bg-brand-purple text-white rounded-br-none' : 'bg-gray-700 text-light-text rounded-bl-none'}`}>
              <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
            </div>
          </div>
        ))}
        {isLoading && (
            <div className="flex items-end gap-2 justify-start">
                 <img src={`data:${profile.imageMimeType};base64,${profile.image}`} alt="Influencer" className="w-8 h-8 rounded-full object-cover self-start"/>
                 <div className="max-w-xs md:max-w-md lg:max-w-lg px-4 py-2 rounded-2xl bg-gray-700 text-light-text rounded-bl-none">
                    <div className="flex items-center justify-center h-5">
                        <div className="w-2 h-2 bg-medium-text rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                        <div className="w-2 h-2 bg-medium-text rounded-full animate-bounce [animation-delay:-0.15s] mx-1"></div>
                        <div className="w-2 h-2 bg-medium-text rounded-full animate-bounce"></div>
                    </div>
                 </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="flex gap-4">
        <input
          type="text"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="Ask your influencer anything..."
          className="flex-grow p-3 bg-gray-900 border border-dark-border rounded-md focus:ring-2 focus:ring-brand-purple focus:outline-none"
          disabled={isLoading}
        />
        <button
          onClick={handleSendMessage}
          disabled={isLoading || !userInput.trim()}
          className="bg-brand-purple text-white font-bold py-3 px-6 rounded-md hover:bg-brand-purple/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-dark-bg focus:ring-brand-purple disabled:bg-gray-500 disabled:cursor-not-allowed"
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default Chatbot;