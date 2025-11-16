import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, Chat } from "@google/genai";
import { InfluencerProfile, ChatMessage } from '../types';
import { MicrophoneIcon } from './common/Icons';

// FIX: Add SpeechRecognition to the window interface to fix TypeScript error.
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface VoiceChatProps {
  profile: InfluencerProfile;
  elevenlabsApiKey: string;
  elevenlabsVoiceId: string;
  onNavigateToSettings: () => void;
}

const VoiceChat: React.FC<VoiceChatProps> = ({ profile, elevenlabsApiKey, elevenlabsVoiceId, onNavigateToSettings }) => {
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [interimTranscript, setInterimTranscript] = useState('');
  const recognitionRef = useRef<any>(null); // Using 'any' for SpeechRecognition for cross-browser compatibility
  const audioQueueRef = useRef<HTMLAudioElement[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    const newChat = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: `You are an AI influencer. Your personality is: "${profile.description}". Answer questions from this persona. Keep your responses concise and conversational, suitable for a voice chat.`,
      },
    });
    setChat(newChat);
    setMessages([]);

    // Speech Recognition setup
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => setStatus('listening');
      recognition.onend = () => {
         // Don't set status to idle if we are already thinking/speaking
         setStatus(prev => prev === 'listening' ? 'idle' : prev);
      };
      recognition.onerror = (event: any) => console.error('Speech recognition error:', event.error);
      
      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        setInterimTranscript(interim);
        if (finalTranscript) {
          setInterimTranscript('');
          handleUserSpeech(finalTranscript.trim());
        }
      };
      recognitionRef.current = recognition;
    } else {
        console.warn("Speech Recognition not supported in this browser.");
    }
  }, [profile]);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages, interimTranscript]);

  const handleUserSpeech = async (text: string) => {
    if (!text || !chat) return;

    setMessages(prev => [...prev, { role: 'user', text }]);
    setStatus('thinking');

    try {
      const response = await chat.sendMessage({ message: text });
      const modelText = response.text;
      setMessages(prev => [...prev, { role: 'model', text: modelText }]);
      speakText(modelText);
    } catch (error) {
      console.error("Chat error:", error);
      const errorText = "Sorry, I'm having trouble connecting right now.";
      setMessages(prev => [...prev, { role: 'model', text: errorText }]);
      speakText(errorText);
    }
  };

  const speakText = async (text: string) => {
    if (!elevenlabsApiKey || !elevenlabsVoiceId) {
      setStatus('idle');
      return;
    }
    setStatus('speaking');
    try {
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${elevenlabsVoiceId}`, {
            method: 'POST',
            headers: {
                'Accept': 'audio/mpeg',
                'Content-Type': 'application/json',
                'xi-api-key': elevenlabsApiKey,
            },
            body: JSON.stringify({
                text,
                model_id: 'eleven_turbo_v2',
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75,
                    style: 0.1,
                    use_speaker_boost: true,
                },
            }),
        });

        if (!response.ok) throw new Error(`ElevenLabs API error: ${response.statusText}`);

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        
        // Add to queue and play if it's the only one
        const isPlaying = audioQueueRef.current.length > 0;
        audioQueueRef.current.push(audio);
        if (!isPlaying) {
            playNextInQueue();
        }

    } catch (error) {
        console.error("TTS Error:", error);
        setStatus('idle');
    }
  };
  
  const playNextInQueue = () => {
    if (audioQueueRef.current.length > 0) {
        setStatus('speaking');
        const audio = audioQueueRef.current[0];
        audio.play();
        audio.onended = () => {
            audioQueueRef.current.shift();
            playNextInQueue();
        };
    } else {
        setStatus('idle');
    }
  };


  const handleMicClick = () => {
    if (status === 'listening') {
      recognitionRef.current?.stop();
    } else if (status === 'idle') {
      recognitionRef.current?.start();
    }
  };
  
  if (!elevenlabsApiKey || !elevenlabsVoiceId) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <MicrophoneIcon className="w-24 h-24 text-brand-purple mb-4" />
            <h2 className="text-3xl font-bold mb-2">Voice Chat Disabled</h2>
            <p className="text-lg text-medium-text mb-6 max-w-md">
                An ElevenLabs API key and Voice ID are required for voice chat. Please add your credentials in the settings tab.
            </p>
            <button
                onClick={onNavigateToSettings}
                className="bg-brand-purple text-white font-bold py-3 px-6 rounded-md hover:bg-brand-purple/90"
            >
                Go to Settings
            </button>
        </div>
    );
  }

  const getStatusText = () => {
      switch(status) {
          case 'listening': return 'Listening...';
          case 'thinking': return 'Thinking...';
          case 'speaking': return `${profile.name} is speaking...`;
          default: return 'Tap the mic to speak';
      }
  }

  return (
    <div className="p-4 bg-dark-card rounded-lg shadow-lg h-full flex flex-col justify-between">
      {/* Header */}
      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold">Voice Chat with {profile.name}</h2>
        <p className="text-sm text-medium-text h-5">{getStatusText()}</p>
      </div>

      {/* Main Content Area */}
      <div className="flex-grow flex flex-col items-center justify-center space-y-4">
        {/* Animated Avatar */}
        <div className={`relative w-48 h-48 rounded-full transition-all duration-300 ${status === 'speaking' ? 'animate-pulse-ring' : ''}`}>
          <img src={`data:${profile.imageMimeType};base64,${profile.image}`} alt={profile.name} className="w-full h-full rounded-full object-cover shadow-2xl ring-4 ring-dark-border" />
        </div>
        
        {/* Chat Log */}
        <div className="w-full h-48 max-h-48 bg-gray-900 rounded-lg p-4 overflow-y-auto space-y-4">
          {messages.map((msg, index) => (
            <div key={index} className={`flex items-start gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xs md:max-w-md lg:max-w-lg px-4 py-2 rounded-2xl ${msg.role === 'user' ? 'bg-brand-purple text-white rounded-br-none' : 'bg-gray-700 text-light-text rounded-bl-none'}`}>
                <p className="text-sm">{msg.text}</p>
              </div>
            </div>
          ))}
          {interimTranscript && (
              <div className="flex items-start gap-2 justify-end">
                   <div className="max-w-xs md:max-w-md lg:max-w-lg px-4 py-2 rounded-2xl bg-brand-purple/70 text-white/80 rounded-br-none">
                      <p className="text-sm italic">{interimTranscript}</p>
                  </div>
              </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Mic Control */}
      <div className="flex flex-col items-center justify-center pt-4 mt-4 border-t border-dark-border">
          <button onClick={handleMicClick} className={`relative w-24 h-24 rounded-full transition-all duration-300 flex items-center justify-center ${status === 'listening' ? 'bg-red-500 shadow-lg scale-110' : 'bg-brand-purple hover:bg-brand-purple/90'}`} disabled={status === 'thinking' || status === 'speaking'}>
             <MicrophoneIcon className="w-12 h-12 text-white"/>
             {status === 'listening' && <div className="absolute inset-0 rounded-full border-4 border-white animate-pulse"></div>}
          </button>
      </div>
    </div>
  );
};

export default VoiceChat;