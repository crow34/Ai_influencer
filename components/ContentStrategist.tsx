import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { InfluencerProfile } from '../types';
import Spinner from './common/Spinner';
import { LightBulbIcon } from './common/Icons';

interface ContentStrategistProps {
  profile: InfluencerProfile;
}

const ContentStrategist: React.FC<ContentStrategistProps> = ({ profile }) => {
  const [topic, setTopic] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<string | null>(null);

  const handleGenerateStrategy = async () => {
    if (!topic.trim()) {
      setError('Please enter a topic or goal.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setStrategy(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      const prompt = `
        You are a world-class social media content strategist. Your client is an AI influencer with the following profile:
        - Name: ${profile.name}
        - Personality: ${profile.description}

        Your task is to create a one-week content strategy based on the following theme or goal: "${topic}".
        
        Please provide a detailed plan in Markdown format. The plan should include:
        1.  A brief overview of the strategy.
        2.  Three creative and engaging content ideas (e.g., for Instagram posts, TikTok videos, or a blog post). For each idea, provide a catchy title, a short description, and suggested hashtags.
        3.  A suggested posting schedule for the week (e.g., Monday, Wednesday, Friday).
        
        Make sure the content ideas are perfectly aligned with the influencer's personality.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      
      setStrategy(response.text);

    } catch (e: any) {
      console.error(e);
      setError('Failed to generate content strategy. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 bg-dark-card rounded-lg shadow-lg h-full flex flex-col">
      <div className="flex items-center mb-4">
        <LightBulbIcon className="w-8 h-8 text-yellow-400" />
        <h2 className="text-2xl font-bold ml-3">Content Strategist</h2>
      </div>
      <p className="text-medium-text mb-6">Get AI-powered content ideas tailored to your influencer. Enter a topic or a goal to generate a weekly content plan.</p>
      
      <div className="flex-grow flex flex-col">
        <div className="bg-gray-900 rounded-lg p-4 overflow-y-auto h-full min-h-[40vh]">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Spinner text="Brainstorming ideas..." />
            </div>
          ) : strategy ? (
            <pre className="whitespace-pre-wrap text-sm font-sans">{strategy}</pre>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center text-medium-text">
              <LightBulbIcon className="w-16 h-16 mx-auto mb-4"/>
              <p>Your generated content strategy will appear here.</p>
            </div>
          )}
        </div>
      </div>
      
      <div className="mt-6 pt-6 border-t border-dark-border">
        <div className="flex flex-col sm:flex-row gap-4 items-center">
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., 'Launch a new product', 'Promote mental wellness', 'Collaborate with another AI'"
              className="flex-grow p-3 bg-gray-900 border border-dark-border rounded-md focus:ring-2 focus:ring-yellow-400 focus:outline-none"
              disabled={isLoading}
            />
            <button
                onClick={handleGenerateStrategy}
                disabled={isLoading}
                className="w-full sm:w-auto bg-yellow-500 text-black font-bold py-3 px-6 rounded-md hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-dark-bg focus:ring-yellow-500 disabled:bg-gray-500 disabled:cursor-not-allowed"
            >
                {isLoading ? 'Generating...' : 'Generate Strategy'}
            </button>
        </div>
        {error && <p className="text-red-500 mt-2 text-sm">{error}</p>}
      </div>
    </div>
  );
};

export default ContentStrategist;
