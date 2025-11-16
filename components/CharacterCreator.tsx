
import React, { useState } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { InfluencerProfile } from '../types';
import Spinner from './common/Spinner';
import { SparklesIcon, UserPlusIcon, ArrowUpTrayIcon, XIcon } from './common/Icons';

interface CharacterCreatorProps {
  onProfileCreated: (profile: InfluencerProfile) => void;
}

const CharacterCreator: React.FC<CharacterCreatorProps> = ({ onProfileCreated }) => {
  const [creationMode, setCreationMode] = useState<'text' | 'photo'>('text');
  const [inspirationImage, setInspirationImage] = useState<{ base64: string; mimeType: string; } | null>(null);
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imagePrompt, setImagePrompt] = useState('');
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<{ base64: string; mimeType: string; } | null>(null);

  const handleInspirationImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 4 * 1024 * 1024) { // 4MB limit
        setError("Image size cannot exceed 4MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result?.toString().split(',')[1];
        if (base64String) {
          setInspirationImage({ base64: base64String, mimeType: file.type });
          setError(null);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateFromPhoto = async () => {
    if (!inspirationImage) {
        setError('Please upload a photo for inspiration.');
        return;
    }
    setIsLoadingImage(true);
    setError(null);
    setGeneratedImage(null);
    
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
        
        const personaPrompt = `Analyze the person in this image. Based on their appearance and style, create a new, unique influencer persona. This new person should be inspired by the original but must be a distinct individual, not a copy, to avoid creating a lookalike.

        Provide the following details for this new persona as a JSON object:
        1. "name": A creative and fitting name (e.g., "Aria Vale", "Kai Sterling").
        2. "description": A short, engaging personality description (2-3 sentences).
        3. "imagePrompt": A detailed text-to-image prompt for a photorealistic portrait of this new person. The prompt should describe their facial features, hair, clothing, and the overall mood, ensuring it's different from the source photo while retaining a similar aesthetic.`;
        
        const imagePart = {
            inlineData: {
                data: inspirationImage.base64,
                mimeType: inspirationImage.mimeType,
            },
        };
        
        const responsePersona = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: { parts: [imagePart, { text: personaPrompt }] },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        description: { type: Type.STRING },
                        imagePrompt: { type: Type.STRING },
                    },
                    required: ["name", "description", "imagePrompt"]
                },
            },
        });
        
        const personaData = JSON.parse(responsePersona.text);
        
        setName(personaData.name);
        setDescription(personaData.description);
        setImagePrompt(personaData.imagePrompt);
        
        const responseImage = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: `Photorealistic portrait of a social media influencer, detailed skin texture, cinematic lighting, ultra-high detail, shot on a high-quality DSLR camera. ${personaData.imagePrompt}`,
            config: {
              numberOfImages: 1,
              outputMimeType: 'image/png',
              aspectRatio: '1:1',
            },
        });

        if (responseImage.generatedImages && responseImage.generatedImages.length > 0 && responseImage.generatedImages[0].image.imageBytes) {
            const base64ImageBytes = responseImage.generatedImages[0].image.imageBytes;
            setGeneratedImage({ base64: base64ImageBytes, mimeType: 'image/png' });
        } else {
            throw new Error("Failed to generate an image based on the photo's description. The AI might have created a prompt that was too restrictive.");
        }
    } catch (e: any) {
        console.error(e);
        setError(e.message || 'Failed to generate influencer from photo. Please try another image.');
    } finally {
        setIsLoadingImage(false);
    }
  };


  const handleGenerateImage = async () => {
    if (!imagePrompt.trim()) {
      setError('Please enter a prompt for the image.');
      return;
    }
    setIsLoadingImage(true);
    setError(null);
    setGeneratedImage(null);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: `Photorealistic portrait of a social media influencer, detailed skin texture, cinematic lighting, ultra-high detail, shot on a high-quality DSLR camera. ${imagePrompt}`,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/png',
          aspectRatio: '1:1',
        },
      });

      if (response.generatedImages && response.generatedImages.length > 0 && response.generatedImages[0].image.imageBytes) {
        const base64ImageBytes = response.generatedImages[0].image.imageBytes;
        setGeneratedImage({ base64: base64ImageBytes, mimeType: 'image/png' });
      } else {
        throw new Error("API did not return an image. This could be due to a restrictive prompt or high service demand. Please try adjusting your prompt or try again.");
      }
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Failed to generate image. Please check your prompt and API key, then try again.');
    } finally {
      setIsLoadingImage(false);
    }
  };

  const handleCreateCharacter = () => {
    if (!name.trim() || !description.trim() || !generatedImage) {
      setError('Please fill in all fields and generate an image before creating the character.');
      return;
    }
    setIsCreating(true);
    setError(null);
    
    const newProfile: InfluencerProfile = {
      id: `influencer-${Date.now()}`,
      name,
      description,
      image: generatedImage.base64,
      imageMimeType: generatedImage.mimeType,
    };

    setTimeout(() => {
      onProfileCreated(newProfile);
      setIsCreating(false);
      setName('');
      setDescription('');
      setImagePrompt('');
      setGeneratedImage(null);
      setInspirationImage(null);
      setCreationMode('text');
    }, 500);
  };
  
  return (
    <div className="p-4 bg-dark-card rounded-lg shadow-lg h-full flex flex-col">
      <div className="flex items-center mb-4">
        <SparklesIcon className="w-8 h-8 text-brand-pink" />
        <h2 className="text-2xl font-bold ml-3">Influencer Creator</h2>
      </div>
      <p className="text-medium-text mb-6">Define the personality and look of your new AI influencer. Describe them via text or get inspired by a photo.</p>
      
      <div className="flex-grow grid md:grid-cols-2 gap-8">
        {/* Left side: Form */}
        <div className="flex flex-col gap-4">
          <div className="flex rounded-md bg-gray-900 border border-dark-border p-1 self-start">
              <button onClick={() => setCreationMode('text')} className={`p-2 px-4 text-sm font-semibold rounded-md transition-colors ${creationMode === 'text' ? 'bg-brand-pink text-white' : 'hover:bg-dark-border'}`}>From Text</button>
              <button onClick={() => setCreationMode('photo')} className={`p-2 px-4 text-sm font-semibold rounded-md transition-colors ${creationMode === 'photo' ? 'bg-brand-pink text-white' : 'hover:bg-dark-border'}`}>From Photo</button>
          </div>

          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-1">Name</label>
            <input type="text" id="name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Nova Starlight" className="w-full p-3 bg-gray-900 border border-dark-border rounded-md focus:ring-2 focus:ring-brand-pink focus:outline-none" />
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-medium mb-1">Personality & Description</label>
            <textarea id="description" value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g., A futuristic tech guru from Neo-Tokyo who loves vintage video games and sustainable fashion." className="w-full h-32 p-3 bg-gray-900 border border-dark-border rounded-md focus:ring-2 focus:ring-brand-pink focus:outline-none resize-none" />
          </div>

          {creationMode === 'text' ? (
            <>
              <div>
                <label htmlFor="imagePrompt" className="block text-sm font-medium mb-1">Profile Image Prompt</label>
                <textarea id="imagePrompt" value={imagePrompt} onChange={e => setImagePrompt(e.target.value)} placeholder="e.g., A young woman with iridescent hair, wearing a sleek silver jacket, smiling warmly." className="w-full h-24 p-3 bg-gray-900 border border-dark-border rounded-md focus:ring-2 focus:ring-brand-pink focus:outline-none resize-none" />
              </div>
              <button onClick={handleGenerateImage} disabled={isLoadingImage} className="w-full bg-brand-pink text-white font-bold py-3 px-6 rounded-md hover:bg-brand-pink/90 focus:outline-none disabled:bg-gray-500">
                {isLoadingImage ? 'Generating...' : 'Generate Image'}
              </button>
            </>
          ) : (
            <>
              <div>
                  <label className="block text-sm font-medium mb-1">Inspiration Photo</label>
                  {inspirationImage ? (
                      <div className="relative w-full aspect-square">
                          <img src={`data:${inspirationImage.mimeType};base64,${inspirationImage.base64}`} alt="Inspiration" className="w-full h-full rounded-lg object-cover" />
                          <button onClick={() => setInspirationImage(null)} className="absolute -top-2 -right-2 bg-red-600 rounded-full p-1 text-white hover:bg-red-700">
                              <XIcon className="w-4 h-4" />
                          </button>
                      </div>
                  ) : (
                      <label htmlFor="inspiration-upload" className="w-full aspect-square flex flex-col items-center justify-center p-4 border-2 border-dashed border-dark-border rounded-lg cursor-pointer hover:bg-dark-border/50">
                          <ArrowUpTrayIcon className="w-8 h-8 text-medium-text mb-2"/>
                          <span className="text-sm text-center text-medium-text">Upload Photo (Max 4MB)</span>
                          <input id="inspiration-upload" type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={handleInspirationImageChange} />
                      </label>
                  )}
              </div>
               <button onClick={handleGenerateFromPhoto} disabled={isLoadingImage || !inspirationImage} className="w-full bg-brand-pink text-white font-bold py-3 px-6 rounded-md hover:bg-brand-pink/90 focus:outline-none disabled:bg-gray-500">
                {isLoadingImage ? 'Generating...' : 'Generate from Photo'}
              </button>
            </>
          )}

        </div>

        {/* Right side: Image Preview */}
        <div className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-dark-border rounded-lg">
          {isLoadingImage ? (
            <Spinner text="Conjuring up an image..." />
          ) : generatedImage ? (
            <img src={`data:${generatedImage.mimeType};base64,${generatedImage.base64}`} alt="Generated influencer" className="w-64 h-64 rounded-full object-cover shadow-2xl" />
          ) : (
            <div className="text-center text-medium-text">
              <UserPlusIcon className="w-16 h-16 mx-auto mb-4" />
              <p>Your generated profile image will appear here.</p>
            </div>
          )}
        </div>
      </div>
      
      <div className="mt-6 pt-6 border-t border-dark-border">
        {error && <p className="text-red-500 mb-4 text-sm">{error}</p>}
        <button onClick={handleCreateCharacter} disabled={!name || !description || !generatedImage || isCreating} className="w-full bg-brand-purple text-white font-bold py-4 px-8 rounded-md hover:bg-brand-purple/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-dark-bg focus:ring-brand-purple disabled:bg-gray-600 disabled:cursor-not-allowed text-lg">
          {isCreating ? 'Creating...' : 'Create Influencer'}
        </button>
      </div>
    </div>
  );
};

export default CharacterCreator;
