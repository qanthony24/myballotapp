import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { UserDemographics, UserPoliticalProfile, UserCivicEngagement } from '../types';
import { POLITICAL_KEY_ISSUES_LIST, CIVIC_INFO_SOURCES_LIST } from '../constants';
import LoadingSpinner from '../components/ui/LoadingSpinner';

type OnboardingStep = 'welcome' | 'location' | 'demographics' | 'political' | 'civic' | 'completion';

const TOTAL_MAIN_STEPS = 4; // Location, Demographics, Political, Civic

const OnboardingPage: React.FC = () => {
  const { currentUser, updateUserProfile, completeOnboarding, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome');
  const [formData, setFormData] = useState< {
    demographics: UserDemographics;
    politicalProfile: UserPoliticalProfile;
    civicEngagement: UserCivicEngagement;
  }>(() => {
    // Initialize with current user's profile data if available, or defaults
    const existingData = currentUser?.profileData;
    return {
      demographics: existingData?.demographics || { zipCode: '', ageRange: '', genderIdentity: '', educationLevel: '' },
      politicalProfile: existingData?.politicalProfile || { partyAffiliation: '', politicalSpectrum: '', keyIssues: [] },
      civicEngagement: existingData?.civicEngagement || { votingFrequency: '', infoSources: [] },
    };
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // If user somehow lands here but is not logged in, or onboarding is complete, redirect.
    if (!currentUser) {
      navigate('/auth', { replace: true });
    } else if (currentUser.profileData.onboardingCompleted) {
      navigate('/', { replace: true });
    } else {
      // Sync formData with currentUser.profileData if it exists (e.g., if user reloads during onboarding)
       setFormData({
        demographics: currentUser.profileData.demographics || { zipCode: '', ageRange: '', genderIdentity: '', educationLevel: '' },
        politicalProfile: currentUser.profileData.politicalProfile || { partyAffiliation: '', politicalSpectrum: '', keyIssues: [] },
        civicEngagement: currentUser.profileData.civicEngagement || { votingFrequency: '', infoSources: [] },
      });
    }
  }, [currentUser, navigate]);

  const handleInputChange = (formSection: keyof typeof formData, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [formSection]: {
        ...prev[formSection],
        [field]: value,
      },
    }));
  };
  
  const handleMultiSelectChange = (formSection: 'politicalProfile' | 'civicEngagement', field: 'keyIssues' | 'infoSources', value: string) => {
    setFormData(prev => {
      const sectionData = prev[formSection];
      let currentSelection: string[] = [];

      if (formSection === 'politicalProfile' && field === 'keyIssues') {
        currentSelection = (sectionData as UserPoliticalProfile).keyIssues || [];
      } else if (formSection === 'civicEngagement' && field === 'infoSources') {
        currentSelection = (sectionData as UserCivicEngagement).infoSources || [];
      }

      const newSelection = currentSelection.includes(value)
        ? currentSelection.filter(item => item !== value)
        : [...currentSelection, value];
      
      return {
        ...prev,
        [formSection]: {
          ...prev[formSection],
          [field]: newSelection,
        },
      };
    });
  };


  const saveCurrentStepData = async (nextStep?: OnboardingStep) => {
    if (!currentUser) return;
    setIsSubmitting(true);
    try {
      await updateUserProfile(formData); // Save the entire formData object
      if (nextStep) {
        setCurrentStep(nextStep);
      } else { // This means we are finishing
        await completeOnboarding();
        setCurrentStep('completion');
      }
    } catch (error) {
      console.error("Failed to save onboarding data:", error);
      // Handle error display to user
    } finally {
      setIsSubmitting(false);
    }
  };

  const next = () => {
    switch (currentStep) {
      case 'welcome': setCurrentStep('location'); break;
      case 'location': saveCurrentStepData('demographics'); break;
      case 'demographics': saveCurrentStepData('political'); break;
      case 'political': saveCurrentStepData('civic'); break;
      case 'civic': saveCurrentStepData(); break; // Will call saveCurrentStepData without nextStep, leading to completion
      default: break;
    }
  };

  const back = () => {
    switch (currentStep) {
      case 'location': setCurrentStep('welcome'); break;
      case 'demographics': setCurrentStep('location'); break;
      case 'political': setCurrentStep('demographics'); break;
      case 'civic': setCurrentStep('political'); break;
      default: break;
    }
  };

  const skipAll = async () => {
    await completeOnboarding();
    navigate('/');
  };
  
  const getProgress = () => {
    switch (currentStep) {
      case 'welcome': return 0;
      case 'location': return (1 / TOTAL_MAIN_STEPS) * 100;
      case 'demographics': return (2 / TOTAL_MAIN_STEPS) * 100;
      case 'political': return (3 / TOTAL_MAIN_STEPS) * 100;
      case 'civic': return (4 / TOTAL_MAIN_STEPS) * 100;
      case 'completion': return 100;
      default: return 0;
    }
  };

  if (authLoading || !currentUser) {
    return <div className="onboarding-container py-8 md:py-12"><LoadingSpinner /></div>; // Added padding
  }
  if (currentUser.profileData.onboardingCompleted) {
     // This should be caught by useEffect, but as a safeguard
    return null;
  }

  return (
    <div className="onboarding-container py-8 md:py-12"> {/* Added padding */}
      {currentStep !== 'welcome' && currentStep !== 'completion' && (
        <div className="onboarding-progress-bar bg-slate-100"> 
          <div className="onboarding-progress-bar-inner bg-civic-blue" style={{ width: `${getProgress()}%` }}></div> 
        </div>
      )}

      {isSubmitting && <div className="absolute inset-0 bg-white bg-opacity-50 flex justify-center items-center z-50"><LoadingSpinner /></div>}

      {currentStep === 'welcome' && (
        <div className="onboarding-step text-center">
          <h1 className="text-3xl font-display font-bold mb-4 text-midnight-navy">Welcome to MyBallot, {currentUser.displayName || 'Voter'}!</h1>
          <p className="text-lg text-midnight-navy/80 mb-6">
            Let's personalize your experience. The next few steps are optional, but providing some information
            can help us tailor content for you and contribute to anonymous, aggregated community insights.
          </p>
          <p className="text-sm text-midnight-navy/70 mb-8">
            Your privacy is important. You can always manage this information in your profile.
          </p>
          <div className="space-y-4">
            <button onClick={next} className="btn-primary w-full bg-civic-blue hover:bg-civic-blue/80">Get Started</button>
            <button onClick={skipAll} className="btn-outline w-full border-civic-blue text-civic-blue hover:bg-civic-blue/10">Skip & Go to App</button>
          </div>
        </div>
      )}

      {currentStep === 'location' && (
        <form onSubmit={(e) => { e.preventDefault(); next(); }} className="onboarding-step">
          <h2 className="text-2xl font-display font-semibold mb-6 text-midnight-navy">Your Location</h2>
          <p className="text-midnight-navy/80 mb-4">Providing your ZIP code helps us show relevant local election information. This is highly recommended.</p>
          <div className="form-group">
            <label htmlFor="zipCode" className="form-label text-midnight-navy">ZIP Code</label>
            <input
              id="zipCode"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{5}"
              title="Enter a 5-digit ZIP code"
              value={formData.demographics.zipCode || ''}
              onChange={(e) => handleInputChange('demographics', 'zipCode', e.target.value)}
              className="form-input border-slate-100/50 focus:ring-civic-blue focus:border-civic-blue" // Updated border and focus colors
              placeholder="e.g., 70802"
            />
          </div>
          <div className="onboarding-navigation">
            <button type="button" onClick={back} className="btn-link text-civic-blue hover:text-civic-blue/80">Back</button>
            <button type="submit" className="btn-primary px-8 bg-civic-blue hover:bg-civic-blue/80" disabled={isSubmitting}>Next</button>
          </div>
        </form>
      )}
      
      {currentStep === 'demographics' && (
        <form onSubmit={(e) => { e.preventDefault(); next(); }} className="onboarding-step">
          <h2 className="text-2xl font-display font-semibold mb-6 text-midnight-navy">About You (Optional)</h2>
           <p className="text-midnight-navy/80 mb-4">This information helps us understand our users better. It will be kept private.</p>
          
          <div className="form-group">
            <label htmlFor="ageRange" className="form-label text-midnight-navy">Age Range</label>
            <select id="ageRange" value={formData.demographics.ageRange || ''} onChange={(e) => handleInputChange('demographics', 'ageRange', e.target.value)} className="form-select border-slate-100/50 focus:ring-civic-blue focus:border-civic-blue"> {/* Updated border and focus colors */}
              <option value="">Prefer not to say</option>
              <option value="18-24">18-24</option>
              <option value="25-34">25-34</option>
              <option value="35-44">35-44</option>
              <option value="45-54">45-54</option>
              <option value="55-64">55-64</option>
              <option value="65+">65+</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="genderIdentity" className="form-label text-midnight-navy">Gender Identity</label>
            <select id="genderIdentity" value={formData.demographics.genderIdentity || ''} onChange={(e) => handleInputChange('demographics', 'genderIdentity', e.target.value)} className="form-select border-slate-100/50 focus:ring-civic-blue focus:border-civic-blue"> {/* Updated border and focus colors */}
              <option value="">Prefer not to say</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="non-binary">Non-binary</option>
              <option value="self-describe">Prefer to self-describe</option>
            </select>
          </div>
          {formData.demographics.genderIdentity === 'self-describe' && (
            <div className="form-group">
              <label htmlFor="genderSelfDescribe" className="form-label text-midnight-navy">Self-Described Gender</label>
              <input id="genderSelfDescribe" type="text" value={formData.demographics.genderSelfDescribe || ''} onChange={(e) => handleInputChange('demographics', 'genderSelfDescribe', e.target.value)} className="form-input border-slate-100/50 focus:ring-civic-blue focus:border-civic-blue" /> {/* Updated border and focus colors */}
            </div>
          )}
          <div className="form-group">
            <label htmlFor="educationLevel" className="form-label text-midnight-navy">Highest Education Level</label>
            <select id="educationLevel" value={formData.demographics.educationLevel || ''} onChange={(e) => handleInputChange('demographics', 'educationLevel', e.target.value)} className="form-select border-slate-100/50 focus:ring-civic-blue focus:border-civic-blue"> {/* Updated border and focus colors */}
                <option value="">Prefer not to say</option>
                <option value="high-school">High School Diploma or GED</option>
                <option value="some-college">Some College, no degree</option>
                <option value="associates">Associate's Degree</option>
                <option value="bachelors">Bachelor's Degree</option>
                <option value="masters">Master's Degree</option>
                <option value="doctorate">Doctorate or Professional Degree</option>
            </select>
          </div>
          <div className="onboarding-navigation">
            <button type="button" onClick={back} className="btn-link text-civic-blue hover:text-civic-blue/80">Back</button>
            <button type="button" onClick={() => next()} className="btn-link text-civic-blue hover:text-civic-blue/80">Skip this step</button>
            <button type="submit" className="btn-primary px-8 bg-civic-blue hover:bg-civic-blue/80" disabled={isSubmitting}>Next</button>
          </div>
        </form>
      )}

      {currentStep === 'political' && (
        <form onSubmit={(e) => { e.preventDefault(); next(); }} className="onboarding-step">
          <h2 className="text-2xl font-display font-semibold mb-6 text-midnight-navy">Political Views (Optional)</h2>
           <p className="text-midnight-navy/80 mb-4">Understanding your general political perspectives can help us (in the future) highlight relevant information.</p>
          
          <div className="form-group">
            <label htmlFor="partyAffiliation" className="form-label text-midnight-navy">Party Affiliation</label>
            <select id="partyAffiliation" value={formData.politicalProfile.partyAffiliation || ''} onChange={(e) => handleInputChange('politicalProfile', 'partyAffiliation', e.target.value)} className="form-select border-slate-100/50 focus:ring-civic-blue focus:border-civic-blue"> {/* Updated border and focus colors */}
              <option value="">Prefer not to say</option>
              <option value="democrat">Democratic</option>
              <option value="republican">Republican</option>
              <option value="independent">Independent / No Party Affiliation</option>
              <option value="libertarian">Libertarian</option>
              <option value="green">Green</option>
              <option value="other">Other</option>
            </select>
          </div>
          {formData.politicalProfile.partyAffiliation === 'other' && (
            <div className="form-group">
              <label htmlFor="partyOther" className="form-label text-midnight-navy">Other Party Affiliation</label>
              <input id="partyOther" type="text" value={formData.politicalProfile.partyOther || ''} onChange={(e) => handleInputChange('politicalProfile', 'partyOther', e.target.value)} className="form-input border-slate-100/50 focus:ring-civic-blue focus:border-civic-blue" /> {/* Updated border and focus colors */}
            </div>
          )}
          <div className="form-group">
            <label htmlFor="politicalSpectrum" className="form-label text-midnight-navy">Political Leaning</label>
            <select id="politicalSpectrum" value={formData.politicalProfile.politicalSpectrum || ''} onChange={(e) => handleInputChange('politicalProfile', 'politicalSpectrum', e.target.value)} className="form-select border-slate-100/50 focus:ring-civic-blue focus:border-civic-blue"> {/* Updated border and focus colors */}
              <option value="">Prefer not to say</option>
              <option value="very-liberal">Very Liberal</option>
              <option value="liberal">Liberal</option>
              <option value="moderate">Moderate</option>
              <option value="conservative">Conservative</option>
              <option value="very-conservative">Very Conservative</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label text-midnight-navy">Key Issues (Select up to 3)</label>
            <div className="onboarding-checkbox-group grid grid-cols-1 sm:grid-cols-2 gap-2">
              {POLITICAL_KEY_ISSUES_LIST.map(issue => (
                <label key={issue.id} htmlFor={`issue-${issue.id}`} className="text-midnight-navy hover:bg-slate-100/50 border-slate-100/50 p-3 rounded-md border cursor-pointer flex items-center space-x-2"> {/* Updated styles */}
                  <input type="checkbox" id={`issue-${issue.id}`} value={issue.id}
                    checked={(formData.politicalProfile.keyIssues || []).includes(issue.id)}
                    onChange={() => handleMultiSelectChange('politicalProfile', 'keyIssues', issue.id)} 
                    disabled={(formData.politicalProfile.keyIssues || []).length >= 3 && !(formData.politicalProfile.keyIssues || []).includes(issue.id)}
                    className="accent-civic-blue h-4 w-4"/>
                  <span>{issue.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="onboarding-navigation">
            <button type="button" onClick={back} className="btn-link text-civic-blue hover:text-civic-blue/80">Back</button>
             <button type="button" onClick={() => next()} className="btn-link text-civic-blue hover:text-civic-blue/80">Skip this step</button>
            <button type="submit" className="btn-primary px-8 bg-civic-blue hover:bg-civic-blue/80" disabled={isSubmitting}>Next</button>
          </div>
        </form>
      )}

    {currentStep === 'civic' && (
        <form onSubmit={(e) => { e.preventDefault(); next(); }} className="onboarding-step">
          <h2 className="text-2xl font-display font-semibold mb-6 text-midnight-navy">Civic Engagement (Optional)</h2>
          <p className="text-midnight-navy/80 mb-4">Tell us a bit about your voting habits and how you get information.</p>

          <div className="form-group">
            <label htmlFor="votingFrequency" className="form-label text-midnight-navy">How often do you vote?</label>
            <select id="votingFrequency" value={formData.civicEngagement.votingFrequency || ''} onChange={(e) => handleInputChange('civicEngagement', 'votingFrequency', e.target.value)} className="form-select border-slate-100/50 focus:ring-civic-blue focus:border-civic-blue"> {/* Updated border and focus colors */}
              <option value="">Prefer not to say</option>
              <option value="every">Every election</option>
              <option value="most">Most elections</option>
              <option value="some">Some elections</option>
              <option value="rarely">Rarely</option>
              <option value="first-time">I'm a first-time voter or will be soon</option>
            </select>
          </div>
          
          <div className="form-group">
            <label className="form-label text-midnight-navy">Where do you typically get election information? (Select all that apply)</label>
            <div className="onboarding-checkbox-group grid grid-cols-1 sm:grid-cols-2 gap-2">
              {CIVIC_INFO_SOURCES_LIST.map(source => (
                <label key={source.id} htmlFor={`source-${source.id}`} className="text-midnight-navy hover:bg-slate-100/50 border-slate-100/50 p-3 rounded-md border cursor-pointer flex items-center space-x-2"> {/* Updated styles */}
                  <input type="checkbox" id={`source-${source.id}`} value={source.id}
                    checked={(formData.civicEngagement.infoSources || []).includes(source.id)}
                    onChange={() => handleMultiSelectChange('civicEngagement', 'infoSources', source.id)} 
                    className="accent-civic-blue h-4 w-4"/>
                  <span>{source.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="onboarding-navigation">
            <button type="button" onClick={back} className="btn-link text-civic-blue hover:text-civic-blue/80">Back</button>
            <button type="button" onClick={() => next()} className="btn-link text-civic-blue hover:text-civic-blue/80">Skip this step</button>
            <button type="submit" className="btn-primary px-8 bg-civic-blue hover:bg-civic-blue/80" disabled={isSubmitting}>Finish Setup</button>
          </div>
        </form>
      )}

      {currentStep === 'completion' && (
        <div className="onboarding-step text-center">
          <h1 className="text-3xl font-display font-bold mb-4 text-civic-blue">All Set!</h1> {/* Changed from green to civic-blue for consistency */}
          <p className="text-lg text-midnight-navy/80 mb-8">
            Thank you for setting up your profile. You can update this information anytime.
          </p>
          <button onClick={() => navigate('/')} className="btn-primary w-full bg-civic-blue hover:bg-civic-blue/80">Start Exploring MyBallot</button>
        </div>
      )}
    </div>
  );
};

export default OnboardingPage;