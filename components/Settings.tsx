
import React, { useState, useEffect, useRef } from 'react';
import { Cog6ToothIcon, DownloadIcon, ArrowUpTrayIcon } from './common/Icons';
import { InfluencerProfile } from '../types';

interface SettingsProps {
  apiKey: string;
  onApiKeySave: (key: string) => void;
  elevenLabsVoiceId: string;
  onVoiceIdSave: (id: string) => void;
  onProfilesImport: (profiles: InfluencerProfile[]) => number;
}

const Settings: React.FC<SettingsProps> = ({ apiKey, onApiKeySave, onProfilesImport, elevenLabsVoiceId, onVoiceIdSave }) => {
  const [currentKey, setCurrentKey] = useState(apiKey);
  const [currentVoiceId, setCurrentVoiceId] = useState(elevenLabsVoiceId);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [isKeyVisible, setIsKeyVisible] = useState(false);
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [importMessage, setImportMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCurrentKey(apiKey);
    setCurrentVoiceId(elevenLabsVoiceId);
  }, [apiKey, elevenLabsVoiceId]);

  const handleSave = () => {
    const isKeyValid = currentKey.trim().length > 10;
    const isVoiceIdValid = currentVoiceId.trim().length > 10;

    if (!isKeyValid || !isVoiceIdValid) { 
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2000);
      return;
    }
    onApiKeySave(currentKey.trim());
    onVoiceIdSave(currentVoiceId.trim());
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };
  
  const getButtonText = () => {
    switch (saveStatus) {
        case 'saved': return 'Saved!';
        case 'error': return 'Invalid Input';
        default: return 'Save Credentials';
    }
  };

  const getButtonClass = () => {
    switch (saveStatus) {
        case 'saved': return 'bg-green-600 hover:bg-green-700';
        case 'error': return 'bg-red-600 hover:bg-red-700';
        default: return 'bg-brand-purple hover:bg-brand-purple/90';
    }
  };

  const handleExport = () => {
    const profiles = localStorage.getItem('ai-influencer-profiles');
    if (!profiles || profiles === '[]') {
        setImportStatus('error');
        setImportMessage("No influencer profiles to export.");
        setTimeout(() => setImportStatus('idle'), 3000);
        return;
    }
    const blob = new Blob([profiles], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ai-influencers-backup.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const text = e.target?.result as string;
            const importedProfiles = JSON.parse(text) as InfluencerProfile[];
            
            if (Array.isArray(importedProfiles) && importedProfiles.every(p => p.id && p.name && p.description && p.image && p.imageMimeType)) {
                const count = onProfilesImport(importedProfiles);
                setImportStatus('success');
                setImportMessage(`${count} new profile(s) imported successfully. ${importedProfiles.length - count} duplicate(s) were skipped.`);
            } else {
                throw new Error("Invalid file format. Ensure it's an array of influencer profiles from this app.");
            }
        } catch (error: any) {
            setImportStatus('error');
            setImportMessage(`Import failed: ${error.message || 'Please check the file content.'}`);
        } finally {
            if (event.target) event.target.value = ''; // Reset file input
            setTimeout(() => {
                setImportStatus('idle');
                setImportMessage('');
            }, 5000);
        }
    };
    reader.onerror = () => {
        setImportStatus('error');
        setImportMessage('Failed to read the file.');
    };
    reader.readAsText(file);
  };

  return (
    <div className="p-4 md:p-8 bg-dark-card rounded-lg shadow-lg h-full flex flex-col">
      <div className="flex items-center mb-4">
        <Cog6ToothIcon className="w-8 h-8 text-brand-purple" />
        <h2 className="text-2xl font-bold ml-3">Settings</h2>
      </div>
      <p className="text-medium-text mb-8">Manage API keys and your influencer data.</p>
      
      <div className="space-y-6 max-w-lg">
        <div>
          <h3 className="text-lg font-medium mb-2">ElevenLabs Credentials</h3>
          <p className="text-sm text-medium-text mb-3">Required for the Voice Chat feature. You can find your credentials on the <a href="https://elevenlabs.io/" target="_blank" rel="noopener noreferrer" className="text-brand-pink underline">ElevenLabs website</a>.</p>
          
          <div className="space-y-4">
              <div>
                  <label htmlFor="elevenlabs-key" className="block text-sm font-medium mb-1">API Key</label>
                  <div className="flex items-center gap-2">
                    <input 
                      id="elevenlabs-key"
                      type={isKeyVisible ? 'text' : 'password'}
                      value={currentKey} 
                      onChange={e => setCurrentKey(e.target.value)} 
                      placeholder="Enter your ElevenLabs API key" 
                      className="flex-grow w-full p-3 bg-gray-900 border border-dark-border rounded-md focus:ring-2 focus:ring-brand-pink focus:outline-none" 
                    />
                    <button onClick={() => setIsKeyVisible(!isKeyVisible)} className="p-3 bg-gray-700 rounded-md hover:bg-gray-600" aria-label={isKeyVisible ? 'Hide key' : 'Show key'}>
                        {isKeyVisible ? 'Hide' : 'Show'}
                    </button>
                  </div>
              </div>
              <div>
                  <label htmlFor="elevenlabs-voice-id" className="block text-sm font-medium mb-1">Voice ID</label>
                  <input
                    id="elevenlabs-voice-id"
                    type="text"
                    value={currentVoiceId}
                    onChange={e => setCurrentVoiceId(e.target.value)}
                    placeholder="Enter your ElevenLabs Voice ID"
                    className="w-full p-3 bg-gray-900 border border-dark-border rounded-md focus:ring-2 focus:ring-brand-pink focus:outline-none"
                  />
              </div>
          </div>
        </div>
        
        <button 
          onClick={handleSave} 
          className={`w-full font-bold py-3 px-6 rounded-md focus:outline-none transition-colors duration-200 ${getButtonClass()}`}
        >
            {getButtonText()}
        </button>
      </div>

      <div className="mt-8 pt-6 border-t border-dark-border max-w-lg">
          <h3 className="text-lg font-medium mb-2">Data Management</h3>
          <p className="text-sm text-medium-text mb-4">Backup or restore your influencer profiles. This is useful for moving data between browsers or devices.</p>
          <div className="flex gap-4">
              <button onClick={handleImportClick} className="flex items-center justify-center flex-1 bg-gray-600 text-white font-bold py-3 px-6 rounded-md hover:bg-gray-700 focus:outline-none">
                  <ArrowUpTrayIcon className="w-5 h-5 mr-2" />
                  Import Profiles
              </button>
              <input type="file" ref={fileInputRef} onChange={handleFileSelected} className="hidden" accept="application/json" />

              <button onClick={handleExport} className="flex items-center justify-center flex-1 bg-blue-600 text-white font-bold py-3 px-6 rounded-md hover:bg-blue-700 focus:outline-none">
                  <DownloadIcon className="w-5 h-5 mr-2" />
                  Export Profiles
              </button>
          </div>
          {importMessage && (
            <div className={`mt-4 text-sm p-3 rounded-md ${importStatus === 'success' ? 'bg-green-900 text-green-200' : 'bg-red-900 text-red-200'}`}>
                {importMessage}
            </div>
          )}
      </div>

    </div>
  );
};

export default Settings;