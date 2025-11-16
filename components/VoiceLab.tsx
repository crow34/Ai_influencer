
import React, { useState, useCallback, useRef } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import Spinner from './common/Spinner';
import { SpeakerWaveIcon, PlayIcon } from './common/Icons';

// Helper functions for audio decoding
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


const VoiceLab: React.FC = () => {
  const [text, setText] = useState<string>('');
  const [voice, setVoice] = useState<string>('Kore');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const availableVoices = ['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr'];

  const generateSpeech = useCallback(async () => {
    if (!text.trim()) {
      setError('Please enter some text to generate speech.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setAudioUrl(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Say with a standard, clear voice: ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        const audioBytes = decode(base64Audio);
        const audioBuffer = await decodeAudioData(audioBytes, outputAudioContext, 24000, 1);
        
        // Convert AudioBuffer to a WAV blob URL to use with <audio> element
        const getWavBlob = (buffer: AudioBuffer) => {
          const numOfChan = buffer.numberOfChannels;
          const length = buffer.length * numOfChan * 2 + 44;
          const bufferArr = new ArrayBuffer(length);
          const view = new DataView(bufferArr);
          const channels = [];
          let i;
          let sample;
          let offset = 0;
          let pos = 0;

          // write WAVE header
          setUint32(0x46464952); // "RIFF"
          setUint32(length - 8); // file length - 8
          setUint32(0x45564157); // "WAVE"
          setUint32(0x20746d66); // "fmt " chunk
          setUint32(16); // length = 16
          setUint16(1); // PCM (uncompressed)
          setUint16(numOfChan);
          setUint32(buffer.sampleRate);
          setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
          setUint16(numOfChan * 2); // block-align
          setUint16(16); // 16-bit
          setUint32(0x61746164); // "data" - chunk
          setUint32(length - pos - 4); // chunk length

          function setUint16(data: number) {
            view.setUint16(pos, data, true);
            pos += 2;
          }

          function setUint32(data: number) {
            view.setUint32(pos, data, true);
            pos += 4;
          }

          for (i = 0; i < numOfChan; i++) {
            channels.push(buffer.getChannelData(i));
          }

          while (pos < length) {
            for (i = 0; i < numOfChan; i++) {
              sample = Math.max(-1, Math.min(1, channels[i][offset]));
              sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
              view.setInt16(pos, sample, true);
              pos += 2;
            }
            offset++;
          }
          return new Blob([view], { type: "audio/wav" });
        };
        const wavBlob = getWavBlob(audioBuffer);
        const url = URL.createObjectURL(wavBlob);
        setAudioUrl(url);

      } else {
        throw new Error('No audio data returned from API.');
      }
    } catch (e) {
      console.error(e);
      setError('Failed to generate speech. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [text, voice]);

  return (
    <div className="p-4 bg-dark-card rounded-lg shadow-lg h-full flex flex-col">
      <div className="flex items-center mb-4">
        <SpeakerWaveIcon className="w-8 h-8 text-blue-400" />
        <h2 className="text-2xl font-bold ml-3">Voice Lab</h2>
      </div>
      <p className="text-medium-text mb-6">Give your influencer a voice. Enter any text and generate realistic speech using different AI voices.</p>
      
      <div className="flex-grow flex flex-col">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter text to convert to speech..."
          className="w-full flex-grow p-3 bg-gray-900 border border-dark-border rounded-md focus:ring-2 focus:ring-blue-400 focus:outline-none resize-none"
          disabled={isLoading}
        />
        <div className="flex flex-col sm:flex-row gap-4 mt-4 items-center">
          <div className="w-full sm:w-1/3">
             <label className="text-sm text-medium-text mb-1 block">Voice</label>
             <select
                 value={voice}
                 onChange={(e) => setVoice(e.target.value)}
                 className="w-full p-3 bg-gray-900 border border-dark-border rounded-md focus:ring-2 focus:ring-blue-400 focus:outline-none"
                 disabled={isLoading}
             >
                 {availableVoices.map(v => <option key={v} value={v}>{v}</option>)}
             </select>
          </div>
          <button
            onClick={generateSpeech}
            disabled={isLoading}
            className="w-full sm:w-auto self-end bg-blue-500 text-white font-bold py-3 px-6 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-dark-bg focus:ring-blue-500 disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center justify-center"
          >
            <SpeakerWaveIcon className={`w-5 h-5 mr-2 ${isLoading ? 'animate-pulse' : ''}`} />
            {isLoading ? 'Generating...' : 'Generate Speech'}
          </button>
        </div>
        {error && <p className="text-red-500 mt-2 text-sm">{error}</p>}
      </div>

      <div className="mt-6 pt-6 border-t border-dark-border flex flex-col items-center justify-center">
        {isLoading && <Spinner text="Synthesizing audio..." />}
        {audioUrl && !isLoading && (
            <div className="w-full max-w-md">
                 <h3 className="text-lg font-semibold mb-2 text-center">Playback</h3>
                 <audio controls src={audioUrl} ref={audioRef} className="w-full">
                     Your browser does not support the audio element.
                 </audio>
            </div>
        )}
        {!audioUrl && !isLoading && (
             <div className="text-center text-medium-text">
                <PlayIcon className="w-12 h-12 mx-auto mb-2 text-gray-600"/>
                Your generated audio will appear here for playback.
             </div>
        )}
      </div>
    </div>
  );
};

export default VoiceLab;
