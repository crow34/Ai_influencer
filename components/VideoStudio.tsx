import React, { useState, useEffect, useCallback } from 'react';
import { GoogleGenAI, GenerateVideosOperation, GenerateVideosResponse, VideosOperation } from "@google/genai";
import { InfluencerProfile } from '../types';
import Spinner from './common/Spinner';
import { VideoCameraIcon } from './common/Icons';

// FIX: Declare global interface for window.aistudio to provide strong typing.
declare global {
    interface AIStudio {
        hasSelectedApiKey: () => Promise<boolean>;
        openSelectKey: () => Promise<void>;
    }
    interface Window {
        // FIX: aistudio is optional to avoid conflicts if not present.
        aistudio?: AIStudio;
    }
}

// Add VideoStudioProps interface
interface VideoStudioProps {
  profile: InfluencerProfile;
}

const loadingMessages = [
    "Warming up the cameras...",
    "Adjusting the lighting...",
    "Directing the digital talent...",
    "Rendering the first few frames...",
    "This can take a few minutes, good things come to those who wait!",
    "Compositing the scene...",
    "Adding special effects...",
    "Finalizing the color grade...",
    "Almost there, preparing for the premiere!"
];

const VideoStudio: React.FC<VideoStudioProps> = ({ profile }) => {
  const [prompt, setPrompt] = useState<string>('');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKeySelected, setApiKeySelected] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState(loadingMessages[0]);
  
  const checkApiKey = useCallback(async () => {
    if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setApiKeySelected(hasKey);
        return hasKey;
    }
    // Fallback for environments where aistudio is not present
    setApiKeySelected(!!process.env.API_KEY);
    return !!process.env.API_KEY;
  }, []);

  useEffect(() => {
    checkApiKey();
  }, [checkApiKey]);

  useEffect(() => {
    // FIX: Use ReturnType<typeof setInterval> for browser compatibility instead of NodeJS.Timeout.
    let interval: ReturnType<typeof setInterval>;
    if (isLoading) {
      interval = setInterval(() => {
        setLoadingMessage(prev => {
          const currentIndex = loadingMessages.indexOf(prev);
          return loadingMessages[(currentIndex + 1) % loadingMessages.length];
        });
      }, 4000);
    }
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isLoading]);


  const handleSelectKey = async () => {
    if (window.aistudio) {
        await window.aistudio.openSelectKey();
        // Assume success and update UI immediately to avoid race condition
        setApiKeySelected(true); 
    }
  };

  const generateVideo = async () => {
    if (!prompt.trim()) {
      setError('Please enter a video prompt.');
      return;
    }
    
    // Final check before making a call
    const hasKey = await checkApiKey();
    if (!hasKey) {
        setError("API Key not selected. Please select a key to continue.");
        return;
    }

    setIsLoading(true);
    setError(null);
    setVideoUrl(null);
    setLoadingMessage(loadingMessages[0]);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      
      let operation: GenerateVideosOperation | VideosOperation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: prompt,
        image: {
            imageBytes: profile.image,
            mimeType: profile.imageMimeType,
        },
        config: {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio: aspectRatio
        }
      });

      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({operation: operation});
      }

      if (operation.error) {
          throw new Error(operation.error.message);
      }
      
      const downloadLink = (operation.response as GenerateVideosResponse)?.generatedVideos?.[0]?.video?.uri;
      
      if (downloadLink) {
        const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
        if (!response.ok) throw new Error("Failed to fetch video from download link.");
        const videoBlob = await response.blob();
        setVideoUrl(URL.createObjectURL(videoBlob));
      } else {
        throw new Error('Video generation finished but no download link was provided.');
      }

    } catch (e: any) {
      console.error(e);
      let errorMessage = 'Failed to generate video. Please try again.';
      if (e.message && e.message.includes("Requested entity was not found")) {
          errorMessage = "Your API Key is invalid. Please select a valid key.";
          setApiKeySelected(false); // Reset key state
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };
  
  if (!apiKeySelected) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center p-4 bg-dark-card rounded-lg">
            <VideoCameraIcon className="w-16 h-16 text-brand-purple mx-auto mb-4" />
            <h2 className="text-3xl font-bold mb-2">Video Studio Access</h2>
            <p className="text-lg text-medium-text mb-6">Video generation requires a dedicated API key and may incur costs.</p>
            <p className="text-sm text-medium-text mb-6 max-w-md">For more information on billing, please visit <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-brand-pink underline">ai.google.dev/gemini-api/docs/billing</a>.</p>
            <button
                onClick={handleSelectKey}
                className="bg-brand-purple text-white font-bold py-3 px-6 rounded-md hover:bg-brand-purple/90 focus:outline-none"
            >
                Select API Key
            </button>
             {error && <p className="text-red-500 mt-4 text-sm">{error}</p>}
        </div>
    );
  }

  return (
    <div className="p-4 bg-dark-card rounded-lg shadow-lg h-full flex flex-col">
      <div className="flex items-center mb-4">
        <VideoCameraIcon className="w-8 h-8 text-brand-purple" />
        <h2 className="text-2xl font-bold ml-3">Video Studio</h2>
      </div>
      <p className="text-medium-text mb-6">Describe a scene and watch your influencer come to life in a short video. Video generation can take several minutes.</p>
      
      <div className="flex-grow flex items-center justify-center">
        {isLoading ? (
          <div className="text-center">
            <Spinner text={loadingMessage}/>
          </div>
        ) : videoUrl ? (
          <video src={videoUrl} controls autoPlay loop className="max-w-full max-h-[60vh] rounded-lg shadow-2xl" />
        ) : (
          <div className="text-center text-medium-text p-4 border-2 border-dashed border-dark-border rounded-lg w-full max-w-2xl aspect-video flex flex-col justify-center items-center">
             <VideoCameraIcon className="w-16 h-16 mx-auto mb-4"/>
             <p>Your generated video will appear here.</p>
          </div>
        )}
      </div>

      <div className="mt-6 pt-6 border-t border-dark-border">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g., Waving at the camera on a sunny day in a futuristic city"
          className="w-full h-24 p-3 bg-gray-900 border border-dark-border rounded-md focus:ring-2 focus:ring-brand-purple focus:outline-none resize-none"
          disabled={isLoading}
        />
        <div className="flex flex-col sm:flex-row gap-4 mt-4 items-center">
          <div className="flex-grow">
            <label className="text-sm text-medium-text mb-1 block">Aspect Ratio</label>
            <select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value as '16:9' | '9:16')}
                className="w-full p-3 bg-gray-900 border border-dark-border rounded-md focus:ring-2 focus:ring-brand-purple focus:outline-none"
                disabled={isLoading}
            >
                <option value="16:9">16:9 (Landscape)</option>
                <option value="9:16">9:16 (Portrait)</option>
            </select>
          </div>
          <button
            onClick={generateVideo}
            disabled={isLoading}
            className="w-full sm:w-auto mt-4 sm:mt-0 self-end bg-brand-purple text-white font-bold py-3 px-6 rounded-md hover:bg-brand-purple/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-dark-bg focus:ring-brand-purple disabled:bg-gray-500 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Generating...' : 'Generate Video'}
          </button>
        </div>
        {error && <p className="text-red-500 mt-2 text-sm">{error}</p>}
      </div>
    </div>
  );
};

export default VideoStudio;