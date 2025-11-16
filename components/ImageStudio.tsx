
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Modality, GenerateContentResponse } from "@google/genai";
import { InfluencerProfile } from '../types';
import Spinner from './common/Spinner';
import { PhotoIcon, ArrowPathIcon, PencilIcon, ArrowUturnLeftIcon, DownloadIcon, ArrowUpTrayIcon, XIcon, UserGroupIcon, CameraIcon, ArrowsRightLeftIcon } from './common/Icons';

interface ImageStudioProps {
  profile: InfluencerProfile;
  onProfileUpdate: (profile: InfluencerProfile) => void;
}

const ImageStudio: React.FC<ImageStudioProps> = ({ profile, onProfileUpdate }) => {
  // Generation state
  const [prompt, setPrompt] = useState('');
  const [pose, setPose] = useState('');
  const [facialExpression, setFacialExpression] = useState('');
  const [lighting, setLighting] = useState('Cinematic Lighting');
  const [cameraShot, setCameraShot] = useState('Medium Shot');
  const [secondPersonImage, setSecondPersonImage] = useState<{ base64: string; mimeType: string; } | null>(null);
  const [sceneImage, setSceneImage] = useState<{ base64: string; mimeType: string; } | null>(null);
  const [outfitSwapImage, setOutfitSwapImage] = useState<{ base64: string; mimeType: string; } | null>(null);

  // Camera state
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraAspectRatio, setCameraAspectRatio] = useState<'portrait' | 'landscape'>('portrait');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Mode and output state
  const [mode, setMode] = useState<'single' | 'photoshoot' | 'outfitSwap'>('single');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [photoshootImages, setPhotoshootImages] = useState<( { base64: string; mimeType: string; } | 'loading' | 'error' | null )[]>( [null, null, null, null] );
  const [selectedPhotoshootIndex, setSelectedPhotoshootIndex] = useState<number | null>(null);
  
  // Edit and result state
  const [editPrompt, setEditPrompt] = useState('');
  const [generatedImage, setGeneratedImage] = useState<{ base64: string; mimeType: string; } | null>(null);
  const [originalGeneratedImage, setOriginalGeneratedImage] = useState<{ base64: string; mimeType: string; } | null>(null);
  
  // Status state
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    if (isCameraOpen) {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: 'environment',
          aspectRatio: cameraAspectRatio === 'portrait' ? 9/16 : 16/9
        }
      };

      navigator.mediaDevices.getUserMedia(constraints)
        .then(mediaStream => {
          stream = mediaStream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch(err => {
          console.warn("Rear camera failed or not found, trying default camera:", err);
          // Fallback to any available camera if the rear one fails
          navigator.mediaDevices.getUserMedia({ video: true })
            .then(mediaStream => {
              stream = mediaStream;
              if (videoRef.current) {
                videoRef.current.srcObject = stream;
              }
            })
            .catch(finalErr => {
              console.error("Camera access error:", finalErr);
              setError("Camera access was denied. Please allow camera permissions in your browser settings.");
              setIsCameraOpen(false);
            });
        });
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isCameraOpen, cameraAspectRatio]);


  const handleCompanionFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
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
          setSecondPersonImage({ base64: base64String, mimeType: file.type });
          setError(null);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSceneFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
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
          setSceneImage({ base64: base64String, mimeType: file.type });
          setError(null);
        }
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleOutfitSwapFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
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
          setOutfitSwapImage({ base64: base64String, mimeType: file.type });
          setError(null);
        }
      };
      reader.readAsDataURL(file);
    }
  };


  const handleErrorResponse = (response: GenerateContentResponse, action: 'generate' | 'edit') => {
    let errorMessage = `API did not return an image during ${action}.`;

    if (response.text && response.text.trim()) {
        errorMessage = `The model refused to ${action} the image and responded with: "${response.text}"`;
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
            errorMessage = "Image generation failed because the API returned an empty response. This can sometimes happen with very complex prompts or during periods of high demand. Please try simplifying your prompt or try again in a moment."
        }
    }
    throw new Error(errorMessage);
  }

  const generateSingleImageAPI = async (extraPromptDetails: string): Promise<{ base64: string, mimeType: string }> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      
    // Always start with the main influencer's image
    const parts: any[] = [{
      inlineData: {
        data: profile.image,
        mimeType: profile.imageMimeType,
      },
    }];
    
    let fullPrompt: string;

    const basePrompt = `The style is a ${cameraShot} with ${lighting}. ${extraPromptDetails} The final image should be a highly detailed, professional DSLR photograph with an aspect ratio of ${aspectRatio}.`;
    
    if (sceneImage && secondPersonImage) {
        parts.push({ inlineData: { data: secondPersonImage.base64, mimeType: secondPersonImage.mimeType } });
        parts.push({ inlineData: { data: sceneImage.base64, mimeType: sceneImage.mimeType } });

        fullPrompt = `A photorealistic image. Place the two people from the first two reference images into the scene provided in the third reference image.
The main person (first image) is described as "${profile.description}". The second person (second image) is their companion.
In the scene, they are performing this action: ${prompt}.
The main person should have a ${facialExpression || 'natural expression'} and be in a ${pose || 'natural pose'}.
${basePrompt}
Crucially, maintain the identities of both people from their reference images and blend them naturally and seamlessly into the new scene.`;

    } else if (sceneImage) {
        parts.push({ inlineData: { data: sceneImage.base64, mimeType: sceneImage.mimeType } });

        fullPrompt = `A photorealistic image. Place the person from the first reference image into the scene provided in the second reference image.
The person is described as "${profile.description}".
In the scene, they are performing this action: ${prompt}.
The person should have a ${facialExpression || 'natural expression'} and be in a ${pose || 'natural pose'}.
${basePrompt}
Crucially, maintain the person's identity from the reference image and blend them naturally and seamlessly into the new scene.`;

    } else if (secondPersonImage) {
      parts.push({ inlineData: { data: secondPersonImage.base64, mimeType: secondPersonImage.mimeType } });

      fullPrompt = `A photorealistic image featuring two people. The main person (first image) is described as "${profile.description}". The second person (second image) is their companion.
They are in the following scene: ${prompt}.
The main person has a ${facialExpression || 'natural expression'} and is in a ${pose || 'natural pose'}.
${basePrompt}
Crucially, maintain the identities of both people from the provided reference images.`;

    } else { // Only the influencer
      fullPrompt = `A photorealistic image of a person, who is described as "${profile.description}".
Scene: ${prompt}.
The person has a ${facialExpression || 'natural expression'} and is in a ${pose || 'natural pose'}.
${basePrompt}
Crucially, maintain the person's identity from the provided reference image.`;
    }

    parts.push({ text: fullPrompt });
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts },
      config: {
        responseModalities: [Modality.IMAGE],
      },
    });

    const responseParts = response.candidates?.[0]?.content?.parts;
    if (responseParts) {
      for (const part of responseParts) {
        if (part.inlineData) {
          return { base64: part.inlineData.data, mimeType: part.inlineData.mimeType };
        }
      }
    }
    
    handleErrorResponse(response, 'generate');
    // This line should not be reached if handleErrorResponse throws, but is needed for type safety.
    throw new Error("Unknown error while generating image.");
  };

  const handleGenerate = async () => {
    if (mode !== 'outfitSwap' && !prompt.trim()) {
      setError('Please describe the scene for your image.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setGeneratedImage(null);
    setOriginalGeneratedImage(null);
    setEditPrompt('');
    setSelectedPhotoshootIndex(null);
    setPhotoshootImages([null, null, null, null]);

    if (mode === 'outfitSwap') {
        await handleGenerateOutfitSwap();
    } else if (mode === 'photoshoot') {
        await handleGeneratePhotoshoot();
    } else {
        await handleGenerateSingleImage();
    }
    setIsLoading(false);
  };
  
  const handleGenerateSingleImage = async () => {
    try {
        const image = await generateSingleImageAPI("");
        setGeneratedImage(image);
        setOriginalGeneratedImage(image);
    } catch(e: any) {
        console.error(e);
        setError(e.message || 'Failed to generate image. Please check your prompt and try again.');
    }
  }

  const handleGeneratePhotoshoot = async () => {
    setPhotoshootImages(['loading', 'loading', 'loading', 'loading']);
    const photoshootPrompts = [
        "A confident pose, looking directly at the camera.",
        "A joyful, laughing expression, candid style.",
        "A thoughtful, serious expression, looking slightly away from the camera.",
        "A dynamic, active pose, as if in mid-motion."
    ];
    
    const promises = photoshootPrompts.map(p => generateSingleImageAPI(p));
    const results = await Promise.allSettled(promises);

    const newImages = results.map(result => {
        if (result.status === 'fulfilled') {
            return result.value;
        }
        console.error("Photoshoot image failed:", result.reason);
        return 'error';
    });
    setPhotoshootImages(newImages);

    const firstSuccess = newImages.findIndex(img => typeof img === 'object' && img !== null);
    if (firstSuccess !== -1) {
        const firstImage = newImages[firstSuccess] as { base64: string; mimeType: string; };
        setSelectedPhotoshootIndex(firstSuccess);
        setGeneratedImage(firstImage);
        setOriginalGeneratedImage(firstImage);
    }
  };

  const handleGenerateOutfitSwap = async () => {
    if (!outfitSwapImage) {
        setError('Please upload a source image for the outfit swap.');
        return;
    }
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
        
        const sourceImagePart = { inlineData: { data: outfitSwapImage.base64, mimeType: outfitSwapImage.mimeType } };
        const influencerImagePart = { inlineData: { data: profile.image, mimeType: profile.imageMimeType } };
        
        const promptText = `Recreate the first image (the source) precisely, but replace the person with the influencer from the second image (the reference).
- From the first image, you MUST use: the background, the person's pose, and all of their clothing.
- From the second image, you MUST use: the person's face, hair, and overall identity.
The influencer's description is: "${profile.description}".
The final image should look as if the influencer was the person originally photographed in the first image.`;

        const textPart = { text: promptText };
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [sourceImagePart, influencerImagePart, textPart] },
            config: { responseModalities: [Modality.IMAGE] },
        });

        const responseParts = response.candidates?.[0]?.content?.parts;
        if (responseParts) {
            for (const part of responseParts) {
                if (part.inlineData) {
                    const newImage = { base64: part.inlineData.data, mimeType: part.inlineData.mimeType };
                    setGeneratedImage(newImage);
                    setOriginalGeneratedImage(newImage);
                    return; // Exit after finding the image
                }
            }
        }
        
        handleErrorResponse(response, 'generate');
        
    } catch(e: any) {
        console.error(e);
        setError(e.message || 'Failed to perform swap. Please try a different source image.');
    }
  };


  const handleApplyEdit = async () => {
    if (!editPrompt.trim() || !generatedImage) {
      setError('Please enter an edit instruction.');
      return;
    }
    setIsEditing(true);
    setError(null);

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
        const imagePart = { inlineData: { data: generatedImage.base64, mimeType: generatedImage.mimeType } };
        const textPart = { text: `Apply this edit to the image: ${editPrompt}` };
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [imagePart, textPart] },
            config: { responseModalities: [Modality.IMAGE] },
        });
        
        const responseParts = response.candidates?.[0]?.content?.parts;
        let imageFound = false;
        if (responseParts) {
            for (const part of responseParts) {
                if (part.inlineData) {
                    const newImage = { base64: part.inlineData.data, mimeType: part.inlineData.mimeType };
                    setGeneratedImage(newImage);
                    if (mode === 'photoshoot' && selectedPhotoshootIndex !== null) {
                        const updatedImages = [...photoshootImages];
                        updatedImages[selectedPhotoshootIndex] = newImage;
                        setPhotoshootImages(updatedImages);
                    }
                    imageFound = true;
                    break;
                }
            }
        }

        if (!imageFound) {
            handleErrorResponse(response, 'edit');
        }

    } catch (e: any) {
        console.error(e);
        setError(e.message || 'Failed to apply edit. Please try a different prompt.');
    } finally {
        setIsEditing(false);
    }
  };

  const handleSetAsProfileImage = () => {
    if (generatedImage) {
      onProfileUpdate({
        ...profile,
        image: generatedImage.base64,
        imageMimeType: generatedImage.mimeType,
      });
      // Reset state after setting profile image for a clean slate
      setGeneratedImage(null);
      setOriginalGeneratedImage(null);
      setPrompt('');
      setPose('');
      setFacialExpression('');
      setSecondPersonImage(null);
      setSceneImage(null);
      setPhotoshootImages([null, null, null, null]);
      setSelectedPhotoshootIndex(null);
      setOutfitSwapImage(null);
    }
  };

  const handleDownload = () => {
    if (generatedImage) {
        const link = document.createElement('a');
        link.href = `data:${generatedImage.mimeType};base64,${generatedImage.base64}`;
        link.download = `${profile.name.replace(/\s+/g, '_')}_${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
  };

  const handleRevert = () => {
    if (originalGeneratedImage) {
        setGeneratedImage(originalGeneratedImage);
        setEditPrompt('');
        if (mode === 'photoshoot' && selectedPhotoshootIndex !== null) {
            const updatedImages = [...photoshootImages];
            updatedImages[selectedPhotoshootIndex] = originalGeneratedImage;
            setPhotoshootImages(updatedImages);
        }
    }
  };
  
  const handleSelectPhotoshootImage = (index: number) => {
    const image = photoshootImages[index];
    if (image && image !== 'loading' && image !== 'error') {
        setSelectedPhotoshootIndex(index);
        setGeneratedImage(image);
        setOriginalGeneratedImage(image);
        setEditPrompt(''); // Clear edit prompt when switching images
    }
  };

  const handleOpenCamera = () => setIsCameraOpen(true);
  const handleCloseCamera = () => setIsCameraOpen(false);

  const handleCapturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d');
        if (context) {
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg');
            const base64 = dataUrl.split(',')[1];
            setSceneImage({ base64, mimeType: 'image/jpeg' });
        }
        handleCloseCamera();
    }
  };


  const hasBeenEdited = originalGeneratedImage && generatedImage && originalGeneratedImage.base64 !== generatedImage.base64;

  const renderGeneratedContent = () => {
    if (mode === 'photoshoot') {
       // Photo Shoot mode
        return (
            <div className="w-full max-w-sm">
                <div className="grid grid-cols-2 gap-2 aspect-square">
                    {photoshootImages.map((img, index) => (
                        <button 
                            key={index} 
                            onClick={() => handleSelectPhotoshootImage(index)}
                            className={`relative w-full h-full bg-gray-900 border-2 rounded-lg flex items-center justify-center transition-all duration-200
                                    ${selectedPhotoshootIndex === index ? 'border-brand-purple' : 'border-dashed border-dark-border'}
                                    ${(img && img !== 'loading' && img !== 'error') ? 'hover:scale-105' : 'cursor-default'}`}
                        >
                            {img === 'loading' && <Spinner text=""/>}
                            {img === 'error' && <div className="text-red-500 text-xs p-1 text-center">Failed</div>}
                            {img && typeof img === 'object' && <img src={`data:${img.mimeType};base64,${img.base64}`} alt={`Photoshoot image ${index+1}`} className="w-full h-full object-cover rounded-md" />}
                        </button>
                    ))}
                </div>
            </div>
        )
    }

    // Single Image or Outfit Swap mode
    return (
        <div className="w-full max-w-sm aspect-square bg-gray-900 border-2 border-dashed border-dark-border rounded-lg flex items-center justify-center relative">
            {isLoading ? (
              <Spinner text="Rendering your vision..." />
            ) : generatedImage ? (
              <>
                <img src={`data:${generatedImage.mimeType};base64,${generatedImage.base64}`} alt="Generated scene" className="w-full h-full rounded-lg object-cover shadow-2xl" />
                {isEditing && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-lg">
                       <Spinner text="Applying edit..."/>
                    </div>
                )}
              </>
            ) : (
              <div className="text-center text-medium-text p-4">
                 <UserGroupIcon className="w-16 h-16 mx-auto mb-4"/>
                 <p>Your new image will appear here.</p>
              </div>
            )}
        </div>
    )
  }

  return (
    <div className="p-4 bg-dark-card rounded-lg shadow-lg h-full flex flex-col">
      <div className="flex items-center mb-4">
        <PhotoIcon className="w-8 h-8 text-brand-pink" />
        <h2 className="text-2xl font-bold ml-3">Image Studio</h2>
      </div>
      <p className="text-medium-text mb-6">Create consistent images of your influencer. Use Photo Shoot mode for variety, and refine any image with text prompts.</p>
      
      <div className="flex-grow grid md:grid-cols-2 gap-8 items-start">
        {/* Left side: Reference Images */}
        <div className="space-y-4">
            <div>
                <h3 className="text-lg font-semibold text-medium-text mb-2">Reference Image</h3>
                <img src={`data:${profile.imageMimeType};base64,${profile.image}`} alt="Reference" className="w-full max-w-sm aspect-square rounded-lg object-cover shadow-lg" />
            </div>
            
            {mode !== 'outfitSwap' && (
              <>
                <div className="p-4 bg-gray-900 rounded-lg border border-dark-border">
                    <h3 className="text-sm font-medium mb-2">Scene</h3>
                    {sceneImage ? (
                        <div className="relative w-full aspect-video">
                            <img src={`data:${sceneImage.mimeType};base64,${sceneImage.base64}`} alt="Scene" className="w-full h-full rounded-lg object-cover" />
                            <button onClick={() => setSceneImage(null)} className="absolute -top-2 -right-2 bg-red-600 rounded-full p-1 text-white hover:bg-red-700">
                                <XIcon className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <div className="flex gap-2">
                            <label htmlFor="scene-upload" className="flex-1 flex flex-col items-center justify-center p-4 border-2 border-dashed border-dark-border rounded-lg cursor-pointer hover:bg-dark-border/50">
                                <ArrowUpTrayIcon className="w-8 h-8 text-medium-text mb-2"/>
                                <span className="text-sm text-center text-medium-text">Upload</span>
                            </label>
                            <input id="scene-upload" type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={handleSceneFileChange} />
                            <button onClick={handleOpenCamera} className="flex-1 flex flex-col items-center justify-center p-4 border-2 border-dashed border-dark-border rounded-lg cursor-pointer hover:bg-dark-border/50">
                                <CameraIcon className="w-8 h-8 text-medium-text mb-2"/>
                                <span className="text-sm text-center text-medium-text">Use Camera</span>
                            </button>
                        </div>
                    )}
                </div>

                <div className="p-4 bg-gray-900 rounded-lg border border-dark-border">
                    <h3 className="text-sm font-medium mb-2">Add a Companion</h3>
                    {secondPersonImage ? (
                        <div className="relative w-32 h-32">
                            <img src={`data:${secondPersonImage.mimeType};base64,${secondPersonImage.base64}`} alt="Second person" className="w-full h-full rounded-lg object-cover" />
                            <button onClick={() => setSecondPersonImage(null)} className="absolute -top-2 -right-2 bg-red-600 rounded-full p-1 text-white hover:bg-red-700">
                                <XIcon className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <div>
                        <label htmlFor="companion-upload" className="w-full flex flex-col items-center justify-center p-4 border-2 border-dashed border-dark-border rounded-lg cursor-pointer hover:bg-dark-border/50">
                            <ArrowUpTrayIcon className="w-8 h-8 text-medium-text mb-2"/>
                            <span className="text-sm text-center text-medium-text">Upload Photo (Max 4MB)</span>
                            <input id="companion-upload" type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={handleCompanionFileChange} />
                        </label>
                        </div>
                    )}
                </div>
              </>
            )}
        </div>


        {/* Right side: Generated Image(s) */}
        <div className="flex flex-col items-center justify-start h-full">
            <h3 className="text-lg font-semibold text-medium-text mb-2">{mode === 'photoshoot' ? 'Photo Shoot Results' : 'Generated Image'}</h3>
            {renderGeneratedContent()}
             {generatedImage && !isLoading && (
                 <div className="w-full max-w-sm mt-4 space-y-4">
                    <div className="flex items-center justify-center gap-2">
                         <button onClick={handleSetAsProfileImage} className="flex-1 bg-brand-purple text-white font-bold py-2 px-4 rounded-md hover:bg-brand-purple/90 focus:outline-none flex items-center justify-center text-sm"><ArrowPathIcon className="w-4 h-4 mr-2" />Set as Profile</button>
                         <button onClick={handleDownload} className="flex-1 bg-green-600 text-white font-bold py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none flex items-center justify-center text-sm"><DownloadIcon className="w-4 h-4 mr-2" />Download</button>
                         {hasBeenEdited && <button onClick={handleRevert} disabled={isEditing} className="flex-1 bg-gray-600 text-white font-bold py-2 px-4 rounded-md hover:bg-gray-700 focus:outline-none flex items-center justify-center text-sm"><ArrowUturnLeftIcon className="w-4 h-4 mr-2" />Revert</button>}
                    </div>

                    {/* Edit Section */}
                    <div className="p-4 bg-gray-900 rounded-lg border border-dark-border">
                        <label htmlFor="editPrompt" className="flex items-center text-sm font-medium mb-2">
                           <PencilIcon className="w-4 h-4 mr-2 text-brand-pink"/> Refine Selected Image
                        </label>
                        <textarea
                          id="editPrompt"
                          value={editPrompt}
                          onChange={(e) => setEditPrompt(e.target.value)}
                          placeholder="e.g., Change hair to blue, add sunglasses..."
                          className="w-full h-16 p-2 bg-dark-bg border border-dark-border rounded-md focus:ring-2 focus:ring-brand-pink focus:outline-none resize-none text-sm"
                          disabled={isEditing || isLoading}
                        />
                         <button
                            onClick={handleApplyEdit}
                            disabled={isEditing || isLoading || !editPrompt.trim()}
                            className="w-full mt-2 bg-brand-pink text-white font-bold py-2 px-4 rounded-md hover:bg-brand-pink/90 focus:outline-none disabled:bg-gray-500 text-sm"
                        >
                            {isEditing ? 'Applying...' : 'Apply Edit'}
                        </button>
                    </div>
                 </div>
            )}
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-dark-border space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium mb-1">Mode</label>
                <div className="flex rounded-md bg-gray-900 border border-dark-border p-1">
                    <button onClick={() => setMode('single')} className={`flex-1 p-2 text-sm font-semibold rounded-md transition-colors ${mode === 'single' ? 'bg-brand-purple text-white' : 'hover:bg-dark-border'}`}>Single Image</button>
                    <button onClick={() => setMode('photoshoot')} className={`flex-1 p-2 text-sm font-semibold rounded-md transition-colors ${mode === 'photoshoot' ? 'bg-brand-purple text-white' : 'hover:bg-dark-border'}`}>Photo Shoot</button>
                    <button onClick={() => setMode('outfitSwap')} className={`flex-1 p-2 text-sm font-semibold rounded-md transition-colors ${mode === 'outfitSwap' ? 'bg-brand-purple text-white' : 'hover:bg-dark-border'}`}>Outfit Swap</button>
                </div>
            </div>
            {mode !== 'outfitSwap' && (
            <div>
                <label htmlFor="aspectRatio" className="block text-sm font-medium mb-1">Aspect Ratio</label>
                <select id="aspectRatio" value={aspectRatio} onChange={e => setAspectRatio(e.target.value)} disabled={isLoading || isEditing} className="w-full p-3 bg-gray-900 border border-dark-border rounded-md focus:ring-2 focus:ring-brand-pink focus:outline-none">
                    <option value="1:1">1:1 (Square)</option>
                    <option value="3:4">3:4 (Portrait)</option>
                    <option value="4:3">4:3 (Landscape)</option>
                    <option value="9:16">9:16 (Story)</option>
                    <option value="16:9">16:9 (Widescreen)</option>
                </select>
            </div>
            )}
        </div>
        {mode === 'outfitSwap' ? (
           <div className="p-4 bg-gray-900 rounded-lg border border-dark-border">
                <h3 className="text-sm font-medium mb-2">Source Image for Swap</h3>
                {outfitSwapImage ? (
                    <div className="relative w-full max-w-sm mx-auto aspect-square">
                        <img src={`data:${outfitSwapImage.mimeType};base64,${outfitSwapImage.base64}`} alt="Source for swap" className="w-full h-full rounded-lg object-contain" />
                        <button onClick={() => setOutfitSwapImage(null)} className="absolute -top-2 -right-2 bg-red-600 rounded-full p-1 text-white hover:bg-red-700">
                            <XIcon className="w-4 h-4" />
                        </button>
                    </div>
                ) : (
                    <label htmlFor="outfit-swap-upload" className="w-full flex flex-col items-center justify-center p-4 border-2 border-dashed border-dark-border rounded-lg cursor-pointer hover:bg-dark-border/50">
                        <ArrowUpTrayIcon className="w-8 h-8 text-medium-text mb-2"/>
                        <span className="text-sm text-center text-medium-text">Upload Image (Max 4MB)</span>
                        <input id="outfit-swap-upload" type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={handleOutfitSwapFileChange} />
                    </label>
                )}
            </div>
        ) : (
        <>
            <div>
                <label htmlFor="scenePrompt" className="block text-sm font-medium mb-1">Action / Scene Description</label>
                <textarea
                id="scenePrompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={`e.g., ...sitting at a café in Paris, ...hiking a mountain at sunrise.`}
                className="w-full h-20 p-3 bg-gray-900 border border-dark-border rounded-md focus:ring-2 focus:ring-brand-pink focus:outline-none resize-none"
                disabled={isLoading || isEditing}
            />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="pose" className="block text-sm font-medium mb-1">Pose</label>
                    <input type="text" id="pose" value={pose} onChange={e => setPose(e.target.value)} placeholder="e.g., Hands on hips" disabled={isLoading || isEditing} className="w-full p-3 bg-gray-900 border border-dark-border rounded-md focus:ring-2 focus:ring-brand-pink focus:outline-none" />
                </div>
                <div>
                    <label htmlFor="facialExpression" className="block text-sm font-medium mb-1">Facial Expression</label>
                    <input type="text" id="facialExpression" value={facialExpression} onChange={e => setFacialExpression(e.target.value)} placeholder="e.g., Joyful, smiling" disabled={isLoading || isEditing} className="w-full p-3 bg-gray-900 border border-dark-border rounded-md focus:ring-2 focus:ring-brand-pink focus:outline-none" />
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="lighting" className="block text-sm font-medium mb-1">Lighting</label>
                    <select id="lighting" value={lighting} onChange={e => setLighting(e.target.value)} disabled={isLoading || isEditing} className="w-full p-3 bg-gray-900 border border-dark-border rounded-md focus:ring-2 focus:ring-brand-pink focus:outline-none">
                        <option>Cinematic Lighting</option>
                        <option>Studio Lighting</option>
                        <option>Golden Hour</option>
                        <option>Blue Hour</option>
                        <option>Dramatic Lighting</option>
                        <option>Soft Lighting</option>
                    </select>
                </div>
                <div>
                    <label htmlFor="cameraShot" className="block text-sm font-medium mb-1">Camera Shot</label>
                    <select id="cameraShot" value={cameraShot} onChange={e => setCameraShot(e.target.value)} disabled={isLoading || isEditing} className="w-full p-3 bg-gray-900 border border-dark-border rounded-md focus:ring-2 focus:ring-brand-pink focus:outline-none">
                        <option>Close-up</option>
                        <option>Medium Shot</option>
                        <option>Full Body Shot</option>
                        <option>Portrait</option>
                        <option>Dutch Angle</option>
                        <option>Low Angle</option>
                    </select>
                </div>
            </div>
        </>
        )}
        <div>
            <button
                onClick={handleGenerate}
                disabled={isLoading || isEditing || (mode === 'outfitSwap' && !outfitSwapImage) || (mode !== 'outfitSwap' && !prompt.trim())}
                className="w-full bg-brand-pink text-white font-bold py-3 px-6 rounded-md hover:bg-brand-pink/90 focus:outline-none disabled:bg-gray-500"
            >
                {isLoading ? 'Generating...' : 
                    mode === 'outfitSwap' ? 'Perform Swap' :
                    mode === 'photoshoot' ? 'Generate Photo Shoot' : 'Generate Image'
                }
            </button>
        </div>
        {error && <p className="text-red-500 mt-2 text-sm">{error}</p>}
      </div>
      {isCameraOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <div className="bg-dark-card rounded-lg p-4 max-w-3xl w-full flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold">Capture Scene</h3>
                    <div className="flex rounded-md bg-gray-900 border border-dark-border p-1">
                        <button onClick={() => setCameraAspectRatio('portrait')} className={`p-2 px-3 text-sm font-semibold rounded-md transition-colors ${cameraAspectRatio === 'portrait' ? 'bg-brand-purple text-white' : 'hover:bg-dark-border'}`}>Portrait</button>
                        <button onClick={() => setCameraAspectRatio('landscape')} className={`p-2 px-3 text-sm font-semibold rounded-md transition-colors ${cameraAspectRatio === 'landscape' ? 'bg-brand-purple text-white' : 'hover:bg-dark-border'}`}>Landscape</button>
                    </div>
                </div>
                <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    className={`w-full rounded-md bg-black object-cover ${cameraAspectRatio === 'portrait' ? 'aspect-[9/16]' : 'aspect-video'}`}
                ></video>
                <canvas ref={canvasRef} className="hidden"></canvas>
                <div className="flex justify-end gap-4 mt-4">
                    <button onClick={handleCloseCamera} className="bg-gray-600 text-white font-bold py-2 px-6 rounded-md hover:bg-gray-700">Cancel</button>
                    <button onClick={handleCapturePhoto} className="bg-brand-purple text-white font-bold py-2 px-6 rounded-md hover:bg-brand-purple/90">Capture</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default ImageStudio;
