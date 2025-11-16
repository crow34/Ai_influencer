
import React, { useState, useCallback, useEffect } from 'react';
import { ActiveTab, InfluencerProfile } from './types';
import CharacterCreator from './components/CharacterCreator';
import ImageStudio from './components/ImageStudio';
import VideoStudio from './components/VideoStudio';
import AdGenerator from './components/AdGenerator';
import Chatbot from './components/Chatbot';
import ContentStrategist from './components/ContentStrategist';
import VoiceLab from './components/VoiceLab';
import VoiceChat from './components/VoiceChat';
import LiveChat from './components/LiveChat';
import Settings from './components/Settings';
import { SparklesIcon, PhotoIcon, VideoCameraIcon, ChatBubbleLeftRightIcon, LightBulbIcon, SpeakerWaveIcon, UserGroupIcon, TrashIcon, MenuIcon, XIcon, MicrophoneIcon, Cog6ToothIcon, SignalIcon, MegaphoneIcon } from './components/common/Icons';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>(ActiveTab.CREATE);
  const [profiles, setProfiles] = useState<InfluencerProfile[]>([]);
  const [activeProfile, setActiveProfile] = useState<InfluencerProfile | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [elevenLabsApiKey, setElevenLabsApiKey] = useState<string>('');
  const [elevenLabsVoiceId, setElevenLabsVoiceId] = useState<string>('');

  useEffect(() => {
    try {
      const savedProfiles = localStorage.getItem('ai-influencer-profiles');
      if (savedProfiles) {
        const parsedProfiles = JSON.parse(savedProfiles) as InfluencerProfile[];
        if (parsedProfiles.length > 0) {
          setProfiles(parsedProfiles);
          setActiveProfile(parsedProfiles[0]);
        }
      }
      const savedApiKey = localStorage.getItem('elevenlabs-api-key');
        if (savedApiKey) {
            setElevenLabsApiKey(savedApiKey);
        }
      const savedVoiceId = localStorage.getItem('elevenlabs-voice-id');
        if (savedVoiceId) {
            setElevenLabsVoiceId(savedVoiceId);
        }
    } catch (error) {
      console.error("Failed to load data from localStorage", error);
    }
  }, []);
  
  const handleApiKeySave = (key: string) => {
    setElevenLabsApiKey(key);
    localStorage.setItem('elevenlabs-api-key', key);
  };

  const handleVoiceIdSave = (id: string) => {
    setElevenLabsVoiceId(id);
    localStorage.setItem('elevenlabs-voice-id', id);
  };

  const saveProfiles = (updatedProfiles: InfluencerProfile[]) => {
    setProfiles(updatedProfiles);
    localStorage.setItem('ai-influencer-profiles', JSON.stringify(updatedProfiles));
  };

  const handleProfileCreated = (newProfile: InfluencerProfile) => {
    const updatedProfiles = [...profiles, newProfile];
    saveProfiles(updatedProfiles);
    setActiveProfile(newProfile);
    setActiveTab(ActiveTab.IMAGE);
  };

  const handleProfileUpdate = useCallback((updatedProfile: InfluencerProfile) => {
    const updatedProfiles = profiles.map(p => p.id === updatedProfile.id ? updatedProfile : p);
    saveProfiles(updatedProfiles);
    setActiveProfile(updatedProfile);
  }, [profiles]);
  
  const handleProfileSelect = (profile: InfluencerProfile) => {
    setActiveProfile(profile);
    if (activeTab === ActiveTab.CREATE) {
      setActiveTab(ActiveTab.IMAGE);
    }
    setIsMenuOpen(false);
  };

  const handleProfileDelete = (e: React.MouseEvent, profileId: string) => {
    e.stopPropagation();
    const updatedProfiles = profiles.filter(p => p.id !== profileId);
    saveProfiles(updatedProfiles);

    if (activeProfile?.id === profileId) {
      if (updatedProfiles.length > 0) {
        setActiveProfile(updatedProfiles[0]);
      } else {
        setActiveProfile(null);
        setActiveTab(ActiveTab.CREATE);
      }
    }
  };

  const handleImportProfiles = (importedProfiles: InfluencerProfile[]): number => {
    const existingProfileIds = new Set(profiles.map(p => p.id));
    const newProfiles = importedProfiles.filter(p => p.id && !existingProfileIds.has(p.id));
    
    if (newProfiles.length > 0) {
        const updatedProfiles = [...profiles, ...newProfiles];
        saveProfiles(updatedProfiles);
        
        if (!activeProfile && newProfiles.length > 0) {
            setActiveProfile(newProfiles[0]);
            if (activeTab === ActiveTab.CREATE) {
              setActiveTab(ActiveTab.IMAGE);
            }
        }
    }
    return newProfiles.length;
  };

  const renderContent = () => {
    if (activeTab === ActiveTab.CREATE) {
      return <CharacterCreator onProfileCreated={handleProfileCreated} />;
    }
    
    if (activeTab === ActiveTab.SETTINGS) {
        return <Settings apiKey={elevenLabsApiKey} onApiKeySave={handleApiKeySave} onProfilesImport={handleImportProfiles} elevenLabsVoiceId={elevenLabsVoiceId} onVoiceIdSave={handleVoiceIdSave} />;
    }

    if (!activeProfile) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8">
          <UserGroupIcon className="w-24 h-24 text-brand-purple mb-4" />
          <h2 className="text-3xl font-bold mb-2">Create an Influencer to Continue</h2>
          <p className="text-lg text-medium-text mb-6">
            You need to create or select an influencer profile to use this feature.
          </p>
          <button
            onClick={() => setActiveTab(ActiveTab.CREATE)}
            className="bg-brand-purple text-white font-bold py-3 px-6 rounded-md hover:bg-brand-purple/90"
          >
            Go to Creator
          </button>
        </div>
      );
    }

    const componentKey = activeProfile.id;

    switch (activeTab) {
      case ActiveTab.IMAGE:
        return <ImageStudio key={componentKey} profile={activeProfile} onProfileUpdate={handleProfileUpdate} />;
      case ActiveTab.VIDEO:
        return <VideoStudio key={componentKey} profile={activeProfile} />;
      case ActiveTab.AD_GENERATOR:
        return <AdGenerator key={componentKey} profile={activeProfile} />;
      case ActiveTab.CHAT:
        return <Chatbot key={componentKey} profile={activeProfile} />;
      case ActiveTab.STRATEGY:
        return <ContentStrategist key={componentKey} profile={activeProfile} />;
      case ActiveTab.VOICE:
        return <VoiceLab />;
      case ActiveTab.VOICE_CHAT:
        return <VoiceChat key={componentKey} profile={activeProfile} elevenlabsApiKey={elevenLabsApiKey} elevenlabsVoiceId={elevenLabsVoiceId} onNavigateToSettings={() => setActiveTab(ActiveTab.SETTINGS)} />;
      case ActiveTab.LIVE_CHAT:
        return <LiveChat key={componentKey} profile={activeProfile} />;
      default:
        return <ImageStudio key={componentKey} profile={activeProfile} onProfileUpdate={handleProfileUpdate} />;
    }
  };

  const TabButton = ({ tab, icon, label }: { tab: ActiveTab, icon: React.ReactNode, label: string }) => {
    const isActive = activeTab === tab;

    let isDisabled = false;
    const needsProfile = ![ActiveTab.CREATE, ActiveTab.VOICE, ActiveTab.SETTINGS].includes(tab);

    if (needsProfile) {
        isDisabled = !activeProfile;
    }
    if (tab === ActiveTab.VOICE_CHAT) {
        isDisabled = !activeProfile || !elevenLabsApiKey || !elevenLabsVoiceId;
    }


    return (
      <button
        onClick={() => {
          setActiveTab(tab);
          setIsMenuOpen(false);
        }}
        className={`flex items-center w-full text-left p-3 my-1 rounded-lg transition-colors duration-200 ${isActive ? 'bg-brand-purple text-white' : 'hover:bg-dark-card text-light-text'} ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        disabled={isDisabled}
      >
        {icon}
        <span className="ml-4 font-semibold">{label}</span>
      </button>
    );
  };

  const SidebarContent = () => (
    <>
      <div className="flex justify-between items-center md:hidden mb-6">
        <h2 className="text-xl font-bold text-light-text">Menu</h2>
        <button onClick={() => setIsMenuOpen(false)} className="text-medium-text hover:text-light-text">
          <XIcon className="w-6 h-6"/>
        </button>
      </div>
      <nav className="p-4 bg-dark-card rounded-lg">
        <TabButton tab={ActiveTab.CREATE} icon={<SparklesIcon className="w-6 h-6" />} label="Creator" />
        <TabButton tab={ActiveTab.IMAGE} icon={<PhotoIcon className="w-6 h-6" />} label="Image Studio" />
        <TabButton tab={ActiveTab.VIDEO} icon={<VideoCameraIcon className="w-6 h-6" />} label="Video Studio" />
        <TabButton tab={ActiveTab.AD_GENERATOR} icon={<MegaphoneIcon className="w-6 h-6" />} label="Ad Generator" />
        <TabButton tab={ActiveTab.CHAT} icon={<ChatBubbleLeftRightIcon className="w-6 h-6" />} label="Chatbot" />
        <TabButton tab={ActiveTab.VOICE_CHAT} icon={<MicrophoneIcon className="w-6 h-6" />} label="Voice Chat" />
        <TabButton tab={ActiveTab.LIVE_CHAT} icon={<SignalIcon className="w-6 h-6" />} label="Live Chat" />
        <TabButton tab={ActiveTab.STRATEGY} icon={<LightBulbIcon className="w-6 h-6" />} label="Strategist" />
        <TabButton tab={ActiveTab.VOICE} icon={<SpeakerWaveIcon className="w-6 h-6" />} label="Voice Lab" />
        <TabButton tab={ActiveTab.SETTINGS} icon={<Cog6ToothIcon className="w-6 h-6" />} label="Settings" />
      </nav>
      {profiles.length > 0 && (
        <div className="mt-6 p-4 bg-dark-card rounded-lg">
          <h3 className="text-lg font-bold mb-3 text-medium-text">My Influencers</h3>
          <ul className="space-y-2">
            {profiles.map(profile => (
              <li key={profile.id}>
                <div
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleProfileSelect(profile);
                    }
                  }}
                  onClick={() => handleProfileSelect(profile)}
                  className={`w-full flex items-center p-2 rounded-lg transition-colors duration-200 cursor-pointer ${activeProfile?.id === profile.id ? 'bg-brand-purple/30 ring-2 ring-brand-purple' : 'hover:bg-dark-border'}`}
                >
                  <img src={`data:${profile.imageMimeType};base64,${profile.image}`} alt={profile.name} className="w-10 h-10 rounded-full object-cover" />
                  <span className="ml-3 font-semibold text-sm flex-grow text-left">{profile.name}</span>
                  <button
                    onClick={(e) => handleProfileDelete(e, profile.id)}
                    className="p-1 rounded-full hover:bg-red-500/20 text-medium-text hover:text-red-400 z-10"
                    aria-label={`Delete ${profile.name}`}
                  >
                     <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )

  return (
    <div className="bg-dark-bg text-light-text min-h-screen font-sans">
      <div className="container mx-auto p-4">
        <header className="flex justify-between items-center md:text-center md:block mb-8">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">AI Influencer Factory</h1>
            <p className="hidden md:block text-xl text-medium-text mt-2">Create, customize, and bring your digital personality to life.</p>
          </div>
          <button className="md:hidden p-2 -mr-2" onClick={() => setIsMenuOpen(true)}>
            <MenuIcon className="w-8 h-8"/>
          </button>
        </header>
        <div className="flex flex-col md:flex-row gap-8">
          <div
            className={`fixed inset-0 bg-black/60 z-20 md:hidden transition-opacity ${isMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            onClick={() => setIsMenuOpen(false)}
          />
          <aside className={`fixed top-0 left-0 h-full w-72 bg-dark-bg p-4 z-30 transform transition-transform duration-300 ease-in-out md:relative md:w-1/4 lg:w-1/5 md:transform-none md:p-0 md:bg-transparent ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <SidebarContent />
          </aside>
          <main className="flex-1">
            <div className="bg-dark-card rounded-lg min-h-[75vh]">
              {renderContent()}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default App;