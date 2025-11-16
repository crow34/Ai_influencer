
import React, { useState } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { InfluencerProfile } from '../types';
import Spinner from './common/Spinner';
import { MegaphoneIcon, ArrowUpTrayIcon, XIcon, DownloadIcon } from './common/Icons';

interface AdGeneratorProps {
  profile: InfluencerProfile;
}

const AdGenerator: React.FC<AdGeneratorProps> = ({ profile }) => {
  const [productImage, setProductImage] = useState<{ base64: string; mimeType: string; } | null>(null);
  const [prompt, setPrompt] = useState('');
  const [generatedAd, setGeneratedAd] = useState<{ base64: string; mimeType: string; } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleProductImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
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
          setProductImage({ base64: base64String, mimeType: file.type });
          setError(null);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateAd = async () => {
    if (!productImage) {
      setError('Please upload a product image.');
      return;
    }
    if (!prompt.trim()) {
      setError('Please describe the advertisement scene.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setGeneratedAd(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

      const influencerImagePart = {
        inlineData: {
          data: profile.image,
          mimeType: profile.imageMimeType,
        },
      };

      const productImagePart = {
        inlineData: {
          data: productImage.base64,
          mimeType: productImage.mimeType,
        },
      };

      const textPrompt = `Create a photorealistic advertisement image.
      - The person from the first image (the influencer) should be featured prominently, interacting with or presenting the product from the second image.
      - The influencer's identity, face, and style must be preserved. The influencer is described as: "${profile.description}".
      - The product from the second image must be clearly visible and accurately represented.
      - The scene is: "${prompt}".
      - The final image must be high-quality, professional, and look like a genuine advertisement. It should be visually appealing and engaging.
      `;

      const textPart = { text: textPrompt };

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [influencerImagePart, productImagePart, textPart] },
        config: {
          responseModalities: [Modality.IMAGE],
        },
      });

      const responseParts = response.candidates?.[0]?.content?.parts;
      let imageFound = false;
      if (responseParts) {
        for (const part of responseParts) {
          if (part.inlineData) {
            setGeneratedAd({ base64: part.inlineData.data, mimeType: part.inlineData.mimeType });
            imageFound = true;
            break;
          }
        }
      }

      if (!imageFound) {
        let errorMessage = `API did not return an image.`;
        if (response.text && response.text.trim()) {
            errorMessage = `The model refused to generate the ad and responded with: "${response.text}"`;
        } else {
            const promptFeedback = response.promptFeedback;
            if (promptFeedback) {
                if (promptFeedback.blockReason) {
                    errorMessage = `API request was blocked due to: ${promptFeedback.blockReason}. Please adjust your prompt.`;
                } else {
                    const blockedRating = promptFeedback.safetyRatings?.find(r => r.blocked);
                    if (blockedRating) {
                         errorMessage = `Request blocked due to safety category: ${blockedRating.category}. Please adjust your prompt.`;
                    } else {
                         errorMessage += " This might be due to safety filters. Please try again with a different prompt.";
                    }
                }
            } else {
                errorMessage = "Ad generation failed because the API returned an empty response. This can sometimes happen with very complex prompts or during periods of high demand. Please try simplifying your prompt or try again in a moment."
            }
        }
        throw new Error(errorMessage);
      }
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Failed to generate ad. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

    const handleDownload = () => {
    if (generatedAd) {
        const link = document.createElement('a');
        link.href = `data:${generatedAd.mimeType};base64,${generatedAd.base64}`;
        link.download = `${profile.name.replace(/\s+/g, '_')}_ad_${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
  };

  return (
    <div className="p-4 bg-dark-card rounded-lg shadow-lg h-full flex flex-col">
      <div className="flex items-center mb-4">
        <MegaphoneIcon className="w-8 h-8 text-brand-pink" />
        <h2 className="text-2xl font-bold ml-3">AI Ad Generator</h2>
      </div>
      <p className="text-medium-text mb-6">Create stunning ads featuring your influencer. Upload a product, describe the scene, and let AI do the rest.</p>
      
      <div className="flex-grow grid md:grid-cols-2 gap-8 items-start">
        {/* Left side: Inputs */}
        <div className="space-y-4">
            <h3 className="text-lg font-semibold text-medium-text">Inputs</h3>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium mb-1 text-center">Influencer</label>
                    <img src={`data:${profile.imageMimeType};base64,${profile.image}`} alt={profile.name} className="w-full aspect-square rounded-lg object-cover shadow-lg" />
                </div>
                 <div>
                    <label className="block text-sm font-medium mb-1 text-center">Product</label>
                     {productImage ? (
                        <div className="relative w-full aspect-square">
                            <img src={`data:${productImage.mimeType};base64,${productImage.base64}`} alt="Product" className="w-full h-full rounded-lg object-cover" />
                            <button onClick={() => setProductImage(null)} className="absolute -top-2 -right-2 bg-red-600 rounded-full p-1 text-white hover:bg-red-700">
                                <XIcon className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <label htmlFor="product-upload" className="w-full aspect-square flex flex-col items-center justify-center p-4 border-2 border-dashed border-dark-border rounded-lg cursor-pointer hover:bg-dark-border/50">
                            <ArrowUpTrayIcon className="w-8 h-8 text-medium-text mb-2"/>
                            <span className="text-sm text-center text-medium-text">Upload Product</span>
                            <input id="product-upload" type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={handleProductImageChange} />
                        </label>
                    )}
                </div>
            </div>
             <div>
                <label htmlFor="scenePrompt" className="block text-sm font-medium mb-1">Ad Scene Description</label>
                <textarea
                id="scenePrompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., ...holding the product and smiling at a beach party, ...unboxing the product in a cozy, well-lit room."
                className="w-full h-24 p-3 bg-gray-900 border border-dark-border rounded-md focus:ring-2 focus:ring-brand-pink focus:outline-none resize-none"
                disabled={isLoading}
                />
            </div>
        </div>

        {/* Right side: Output */}
        <div className="space-y-4">
            <h3 className="text-lg font-semibold text-medium-text">Generated Ad</h3>
            <div className="w-full aspect-square bg-gray-900 border-2 border-dashed border-dark-border rounded-lg flex items-center justify-center relative">
                {isLoading ? (
                    <Spinner text="Generating your ad..." />
                ) : generatedAd ? (
                    <img src={`data:${generatedAd.mimeType};base64,${generatedAd.base64}`} alt="Generated ad" className="w-full h-full rounded-lg object-cover shadow-2xl" />
                ) : (
                    <div className="text-center text-medium-text p-4">
                        <MegaphoneIcon className="w-16 h-16 mx-auto mb-4"/>
                        <p>Your generated ad will appear here.</p>
                    </div>
                )}
            </div>
            {generatedAd && !isLoading && (
                <button onClick={handleDownload} className="w-full bg-green-600 text-white font-bold py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none flex items-center justify-center text-sm">
                    <DownloadIcon className="w-4 h-4 mr-2" />Download Ad
                </button>
            )}
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-dark-border">
        {error && <p className="text-red-500 mb-4 text-sm">{error}</p>}
        <button
          onClick={handleGenerateAd}
          disabled={isLoading || !productImage || !prompt.trim()}
          className="w-full bg-brand-pink text-white font-bold py-3 px-6 rounded-md hover:bg-brand-pink/90 focus:outline-none disabled:bg-gray-500"
        >
          {isLoading ? 'Generating...' : 'Generate Ad'}
        </button>
      </div>
    </div>
  );
};

export default AdGenerator;
