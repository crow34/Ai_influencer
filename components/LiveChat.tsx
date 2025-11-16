import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveSession, LiveServerMessage, Modality, Blob } from '@google/genai';
import { InfluencerProfile } from '../types';
import { SignalIcon } from './common/Icons';

// Audio Encoding & Decoding Helpers
function encode(bytes: Uint8Array) {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function decode(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

async function decodeAudioData(
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number,
): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return buffer;
}


const LiveChat: React.FC<{ profile: InfluencerProfile }> = ({ profile }) => {
    const [status, setStatus] = useState<'idle' | 'connecting' | 'active' | 'error'>('idle');
    const [transcripts, setTranscripts] = useState<{ role: 'user' | 'model', text: string }[]>([]);
    
    const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const nextStartTimeRef = useRef<number>(0);
    const sourcesRef = useRef(new Set<AudioBufferSourceNode>());
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [transcripts]);
    
    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (sessionPromiseRef.current) {
                sessionPromiseRef.current.then(session => session.close());
            }
            inputAudioContextRef.current?.close();
            outputAudioContextRef.current?.close();
        };
    }, []);

    const stopSession = useCallback(() => {
        if (sessionPromiseRef.current) {
            sessionPromiseRef.current.then(session => session.close());
            sessionPromiseRef.current = null;
        }

        scriptProcessorRef.current?.disconnect();
        mediaStreamSourceRef.current?.disconnect();
        
        sourcesRef.current.forEach(source => source.stop());
        sourcesRef.current.clear();
        nextStartTimeRef.current = 0;

        setStatus('idle');
    }, []);


    const startSession = useCallback(async () => {
        if (status !== 'idle') return;

        setStatus('connecting');
        setTranscripts([]);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            
            let currentInputTranscription = '';
            let currentOutputTranscription = '';

            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => {
                        setStatus('active');
                        mediaStreamSourceRef.current = inputAudioContextRef.current!.createMediaStreamSource(stream);
                        scriptProcessorRef.current = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
                        
                        scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const pcmBlob: Blob = {
                                data: encode(new Uint8Array(new Int16Array(inputData.map(x => x * 32768)).buffer)),
                                mimeType: 'audio/pcm;rate=16000',
                            };
                            if (sessionPromiseRef.current) {
                                sessionPromiseRef.current.then((session) => {
                                    session.sendRealtimeInput({ media: pcmBlob });
                                });
                            }
                        };
                        mediaStreamSourceRef.current.connect(scriptProcessorRef.current);
                        scriptProcessorRef.current.connect(inputAudioContextRef.current!.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        // Handle transcriptions
                        if (message.serverContent?.inputTranscription) {
                            currentInputTranscription += message.serverContent.inputTranscription.text;
                        }
                        if (message.serverContent?.outputTranscription) {
                             currentOutputTranscription += message.serverContent.outputTranscription.text;
                        }

                        if (message.serverContent?.turnComplete) {
                            const finalInput = currentInputTranscription.trim();
                            const finalOutput = currentOutputTranscription.trim();
                            if (finalInput) setTranscripts(prev => [...prev, {role: 'user', text: finalInput}]);
                            if (finalOutput) setTranscripts(prev => [...prev, {role: 'model', text: finalOutput}]);
                            currentInputTranscription = '';
                            currentOutputTranscription = '';
                        }
                        
                        // Handle audio playback
                        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                        if (base64Audio && outputAudioContextRef.current) {
                            const outputCtx = outputAudioContextRef.current;
                            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
                            const audioBuffer = await decodeAudioData(decode(base64Audio), outputCtx, 24000, 1);
                            const source = outputCtx.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(outputCtx.destination);
                            source.addEventListener('ended', () => {
                                sourcesRef.current.delete(source);
                            });
                            source.start(nextStartTimeRef.current);
                            nextStartTimeRef.current += audioBuffer.duration;
                            sourcesRef.current.add(source);
                        }
                        
                        if (message.serverContent?.interrupted) {
                           sourcesRef.current.forEach(source => source.stop());
                           sourcesRef.current.clear();
                           nextStartTimeRef.current = 0;
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        console.error('Session error', e);
                        setStatus('error');
                        stopSession();
                    },
                    onclose: () => {
                        setStatus('idle');
                        stopSession();
                    },
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    outputAudioTranscription: {},
                    inputAudioTranscription: {},
                    systemInstruction: `You are an AI influencer. Your personality is: "${profile.description}". Respond in character, keeping your answers conversational and relatively brief for a voice chat.`,
                },
            });
        } catch (err) {
            console.error("Failed to start session:", err);
            setStatus('error');
        }
    }, [profile, status, stopSession]);
    
    const getStatusText = () => {
        switch(status) {
            case 'connecting': return 'Connecting...';
            case 'active': return 'Live';
            case 'error': return 'Connection error. Please try again.';
            default: return 'Tap to start live session';
        }
    };

    const handleButtonClick = () => {
        if (status === 'idle' || status === 'error') {
            startSession();
        } else {
            stopSession();
        }
    };

    return (
      <div className="p-4 bg-dark-card rounded-lg shadow-lg h-full flex flex-col justify-between">
         <div className="text-center mb-4">
            <h2 className="text-2xl font-bold">Live Chat with {profile.name}</h2>
            <p className="text-sm text-medium-text h-5">{getStatusText()}</p>
         </div>
         
         <div className="flex-grow flex flex-col items-center justify-center space-y-4">
            <div className={`relative w-48 h-48 rounded-full transition-all duration-300 ${status === 'active' ? 'animate-pulse-ring' : ''}`}>
                <img src={`data:${profile.imageMimeType};base64,${profile.image}`} alt={profile.name} className="w-full h-full rounded-full object-cover shadow-2xl ring-4 ring-dark-border" />
            </div>
            
            <div className="w-full h-48 max-h-48 bg-gray-900 rounded-lg p-4 overflow-y-auto space-y-4">
               {transcripts.map((t, i) => (
                    <div key={i} className={`flex items-start gap-2 ${t.role === 'user' ? 'text-right justify-end' : 'text-left justify-start'}`}>
                         <p className={`text-sm max-w-xs md:max-w-md lg:max-w-lg px-4 py-2 rounded-2xl ${t.role === 'user' ? 'bg-brand-purple text-white rounded-br-none' : 'bg-gray-700 text-light-text rounded-bl-none'}`}>
                           <strong>{t.role === 'user' ? 'You' : profile.name}:</strong> {t.text}
                         </p>
                    </div>
               ))}
               <div ref={messagesEndRef} />
            </div>
         </div>

         <div className="flex flex-col items-center justify-center pt-4 mt-4 border-t border-dark-border">
            <button onClick={handleButtonClick} className={`w-48 font-bold py-3 px-6 rounded-md focus:outline-none transition-colors duration-200 flex items-center justify-center ${status === 'active' || status === 'connecting' ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-purple hover:bg-brand-purple/90'}`}>
                <SignalIcon className="w-5 h-5 mr-2" />
                {status === 'active' || status === 'connecting' ? 'Stop Session' : 'Start Session'}
            </button>
         </div>
      </div>
    );
};

export default LiveChat;
