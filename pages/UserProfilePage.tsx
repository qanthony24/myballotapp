import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { UserProfileData } from '../types';
import { POLITICAL_KEY_ISSUES_LIST, CIVIC_INFO_SOURCES_LIST } from '../constants';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { PencilSquareIcon, ArrowLeftOnRectangleIcon, IdentificationIcon, FlagIcon, ChartBarIcon, EnvelopeIcon, KeyIcon, TrashIcon } from '@heroicons/react/24/outline';
import Modal from '../components/ui/Modal';

type EditableSection = null | 'displayName' | 'contact' | 'demographics' | 'political' | 'civic';

const UserProfilePage: React.FC = () => {
  const { currentUser, updateUserProfile, logout, isLoading: authLoading, error: authError, changePassword, deleteUserAccount } = useAuth(); // Added changePassword and deleteUserAccount
  const navigate = useNavigate();

  const [editingSection, setEditingSection] = useState<EditableSection>(null);
  const [formData, setFormData] = useState<UserProfileData | null>(null);
  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [email, setEmail] = useState(currentUser?.email || ''); 
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentPassword, setCurrentPassword] = useState(''); // Added
  const [newPassword, setNewPassword] = useState(''); // Added
  const [showPasswordModal, setShowPasswordModal] = useState(false); // Added
  const [showDeleteModal, setShowDeleteModal] = useState(false); // Added
  const [actionError, setActionError] = useState<string | null>(null); // Added for modal errors

  useEffect(() => {
    if (currentUser) {
      setFormData(JSON.parse(JSON.stringify(currentUser.profileData))); 
      setDisplayName(currentUser.displayName || '');
      setEmail(currentUser.email || '');
    }
  }, [currentUser]);

  if (authLoading || !currentUser || !formData) {
    return <div className="profile-container text-center py-10"><LoadingSpinner /></div>;
  }
  
  const handleInputChange = (section: keyof UserProfileData, field: string, value: any) => {
    if (!formData) return;
    setFormData(prev => {
      if (!prev) return null;
      const sectionKey = section as keyof UserProfileData; 
      const currentSectionData = prev[sectionKey] as any; 
      
      return {
        ...prev,
        [sectionKey]: {
          ...currentSectionData,
          [field]: value,
        },
      };
    });
  };
  
  const handleMultiSelectChange = (section: 'politicalProfile' | 'civicEngagement', field: 'keyIssues' | 'infoSources', value: string) => {
     if (!formData) return;
     setFormData(prev => {
        if (!prev) return null;
        // Correctly type the section being accessed
        let currentValues: string[] = [];
        if (section === 'politicalProfile') {
            currentValues = (prev.politicalProfile?.[field as 'keyIssues'] as string[] | undefined) || [];
        } else if (section === 'civicEngagement') {
            currentValues = (prev.civicEngagement?.[field as 'infoSources'] as string[] | undefined) || [];
        }

        const newValues = currentValues.includes(value)
            ? currentValues.filter(item => item !== value)
            : [...currentValues, value];
        return {
            ...prev,
            [section]: {
                ...(prev[section] as object), 
                [field]: newValues,
            },
        };
     });
  };

  const handleSubmit = async (sectionToSave: EditableSection) => {
    if (!formData || !currentUser) return;
    setIsSubmitting(true);
    
    let updatePayload: Partial<UserProfileData> = {};
    // let coreUserUpdate: Partial<Pick<User, 'displayName' | 'email'>> = {}; // Not directly used with updateUserProfile

    switch(sectionToSave) {
        case 'displayName':
            // coreUserUpdate.displayName = displayName; // This was for a simulated update
            console.log("Simulating display name update:", displayName);
             if (currentUser) {
                // This is a simulation. In a real app, useAuth would have a method to update displayName.
                const updatedUser = { ...currentUser, displayName: displayName };
                // Simulate saving to auth context or backend
                // For example: await updateAuthUser({ displayName }); 
                // Then update local state if not handled by a listener
                localStorage.setItem('myBallotAppUser', JSON.stringify(updatedUser)); 
             }
            break;
        case 'contact':
             if (currentUser.authProvider === 'email' && email !== currentUser.email) {
                 console.log("Simulating email change request to:", email);
                 alert("Email change simulation. In a real app, this would require verification.");
             }
            break;
        case 'demographics':
            updatePayload.demographics = formData.demographics;
            break;
        case 'political':
            updatePayload.politicalProfile = formData.politicalProfile;
            break;
        case 'civic':
            updatePayload.civicEngagement = formData.civicEngagement;
            break;
    }

    try {
      if (Object.keys(updatePayload).length > 0) {
        await updateUserProfile(updatePayload);
      }
    } catch (error) {
      console.error("Error updating profile:", error);
    } finally {
      setIsSubmitting(false);
      setEditingSection(null);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/auth'); // Explicitly navigate after logout as per useAuth behavior
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      setActionError("Both current and new passwords are required.");
      return;
    }
    setActionError(null);
    setIsSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      setShowPasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
      alert("Password changed successfully!");
    } catch (err: any) {
      setActionError(err.message || "Failed to change password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!currentPassword) {
      setActionError("Current password is required to delete your account.");
      return;
    }
    setActionError(null);
    setIsSubmitting(true);
    try {
      await deleteUserAccount(currentPassword);
      // No need to navigate, useAuth's onAuthStateChanged will handle it after user is deleted.
      // setShowDeleteModal(false); // Component will unmount
      // setCurrentPassword('');
      alert("Account deleted successfully."); 
    } catch (err: any) {
      setActionError(err.message || "Failed to delete account.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderSection = (title: string, sectionKey: EditableSection, icon: React.ReactNode, children: React.ReactNode) => {
    return (
      <div className="profile-section bg-white shadow-md rounded-lg p-6 mb-6 border border-slate-100/30"> 
        <div className="flex justify-between items-center mb-4"> 
          <h2 className="text-xl font-semibold text-midnight-navy flex items-center">
            {icon} <span className="ml-2">{title}</span>
          </h2>
          {editingSection !== sectionKey && (
            <button onClick={() => setEditingSection(sectionKey)} className="text-sm text-civic-blue hover:underline flex items-center">
              <PencilSquareIcon className="h-4 w-4 mr-1" /> Edit
            </button>
          )}
        </div>
        {children}
      </div>
    );
  };


  return (
    <div className="profile-container max-w-3xl mx-auto py-8 px-4"> 
      <div className="profile-header flex items-center space-x-6 p-6 bg-white shadow-md rounded-lg mb-8 border border-slate-100/30"> 
        <img 
            src={currentUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.displayName || currentUser.email || 'U')}&background=2155FF&color=fff&size=128`} 
            alt="User avatar" 
            className="profile-avatar h-24 w-24 rounded-full ring-2 ring-offset-2 ring-civic-blue" 
        />
        <div>
            {editingSection === 'displayName' ? (
                <form onSubmit={(e) => {e.preventDefault(); handleSubmit('displayName');}} className="flex items-center">
                    <input 
                        type="text" 
                        value={displayName} 
                        onChange={(e) => setDisplayName(e.target.value)} 
                        className="form-input mr-2 text-2xl border-slate-100/50 focus:ring-civic-blue focus:border-civic-blue" 
                    />
                    <button type="submit" className="btn-primary bg-civic-blue hover:bg-civic-blue/80 px-4 py-2 text-sm" disabled={isSubmitting}>Save</button>
                    <button type="button" onClick={() => {setEditingSection(null); setDisplayName(currentUser.displayName || '');}} className="ml-2 text-xs text-midnight-navy/70 hover:text-midnight-navy">Cancel</button>
                </form>
            ) : (
                 <h1 className="profile-display-name text-3xl font-bold text-midnight-navy">{currentUser.displayName || 'User Profile'}</h1>
            )}
            <p className="profile-email text-midnight-navy/70">{currentUser.email || currentUser.phoneNumber || `Logged in via ${currentUser.authProvider}`}</p>
             {editingSection !== 'displayName' && (
                <button onClick={() => setEditingSection('displayName')} className="text-xs text-civic-blue hover:underline flex items-center mt-1">
                    <PencilSquareIcon className="h-3 w-3 mr-1" /> Edit Display Name
                </button>
            )}
        </div>
      </div>

      {authError && <p className="text-sm text-red-500 bg-red-100 p-3 rounded-md mb-6">{authError}</p>} 
      
      {/* Contact Info Section */}
      {renderSection("Contact Information", 'contact', <EnvelopeIcon className="h-6 w-6 text-civic-blue" />, 
        editingSection === 'contact' ? (
          <form onSubmit={(e) => { e.preventDefault(); handleSubmit('contact'); }} className="profile-edit-form space-y-4"> 
            {currentUser.authProvider === 'email' && (
                 <div className="form-group">
                    <label htmlFor="email" className="form-label text-midnight-navy">Email Address</label>
                    <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} className="form-input border-slate-100/50 focus:ring-civic-blue focus:border-civic-blue" /> 
                </div>
            )}
            <div className="flex justify-end space-x-3">
              <button type="button" onClick={() => setEditingSection(null)} className="btn-outline border-slate-100/50 text-midnight-navy hover:bg-slate-100/50 px-4 py-2 text-sm">Cancel</button> 
              <button type="submit" className="btn-primary bg-civic-blue hover:bg-civic-blue/80 px-4 py-2 text-sm" disabled={isSubmitting}>Save Contact</button>
            </div>
          </form>
        ) : (
          <div className="profile-data-grid grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-midnight-navy/80"> 
            <div className="profile-field"><strong>Email:</strong> <span>{currentUser.email || 'N/A'}</span></div>
            {currentUser.phoneNumber && <div className="profile-field"><strong>Phone:</strong> <span>{currentUser.phoneNumber}</span></div>}
            <div className="profile-field"><strong>Auth Provider:</strong> <span className="capitalize">{currentUser.authProvider}</span></div>
          </div>
        )
      )}


      {/* Demographics Section */}
      {renderSection("Demographics", 'demographics', <IdentificationIcon className="h-6 w-6 text-civic-blue" />, 
        editingSection === 'demographics' ? (
          <form onSubmit={(e) => { e.preventDefault(); handleSubmit('demographics'); }} className="profile-edit-form space-y-4"> 
            <div className="form-group">
              <label htmlFor="zipCode" className="form-label text-midnight-navy">ZIP Code</label>
              <input type="text" id="zipCode" value={formData.demographics.zipCode || ''} onChange={(e) => handleInputChange('demographics', 'zipCode', e.target.value)} className="form-input border-slate-100/50 focus:ring-civic-blue focus:border-civic-blue" /> 
            </div>
            <div className="form-group">
              <label htmlFor="ageRange" className="form-label text-midnight-navy">Age Range</label>
              <select id="ageRange" value={formData.demographics.ageRange || ''} onChange={(e) => handleInputChange('demographics', 'ageRange', e.target.value)} className="form-select border-slate-100/50 focus:ring-civic-blue focus:border-civic-blue"> 
                <option value="">Prefer not to say</option>
                <option value="18-24">18-24</option><option value="25-34">25-34</option><option value="35-44">35-44</option>
                <option value="45-54">45-54</option><option value="55-64">55-64</option><option value="65+">65+</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="genderIdentity" className="form-label text-midnight-navy">Gender Identity</label>
              <select id="genderIdentity" value={formData.demographics.genderIdentity || ''} onChange={(e) => handleInputChange('demographics', 'genderIdentity', e.target.value)} className="form-select border-slate-100/50 focus:ring-civic-blue focus:border-civic-blue"> 
                 <option value="">Prefer not to say</option><option value="female">Female</option><option value="male">Male</option>
                 <option value="non-binary">Non-binary</option><option value="self-describe">Prefer to self-describe</option>
              </select>
            </div>
            {formData.demographics.genderIdentity === 'self-describe' && (
              <div className="form-group">
                <label htmlFor="genderSelfDescribe" className="form-label text-midnight-navy">Self-Described Gender</label>
                <input type="text" id="genderSelfDescribe" value={formData.demographics.genderSelfDescribe || ''} onChange={(e) => handleInputChange('demographics', 'genderSelfDescribe', e.target.value)} className="form-input border-slate-100/50 focus:ring-civic-blue focus:border-civic-blue" /> 
              </div>
            )}
            <div className="form-group">
                <label htmlFor="educationLevel" className="form-label text-midnight-navy">Highest Education Level</label>
                <select id="educationLevel" value={formData.demographics.educationLevel || ''} onChange={(e) => handleInputChange('demographics', 'educationLevel', e.target.value)} className="form-select border-slate-100/50 focus:ring-civic-blue focus:border-civic-blue"> 
                    <option value="">Prefer not to say</option><option value="high-school">High School/GED</option><option value="some-college">Some College</option>
                    <option value="associates">Associate's</option><option value="bachelors">Bachelor's</option><option value="masters">Master's</option><option value="doctorate">Doctorate</option>
                </select>
            </div>
            {/* Added Race/Ethnicity Field */}
            <div className="form-group">
              <label htmlFor="raceEthnicity" className="form-label text-midnight-navy">Race/Ethnicity</label>
              <select 
                id="raceEthnicity" 
                value={formData.demographics.raceEthnicity || ''} 
                onChange={(e) => handleInputChange('demographics', 'raceEthnicity', e.target.value)} 
                className="form-select border-slate-100/50 focus:ring-civic-blue focus:border-civic-blue"
              >
                <option value="">Prefer not to say</option>
                <option value="american-indian-alaska-native">American Indian or Alaska Native</option>
                <option value="asian">Asian</option>
                <option value="black-african-american">Black or African American</option>
                <option value="hispanic-latino">Hispanic or Latino</option>
                <option value="native-hawaiian-pacific-islander">Native Hawaiian or Other Pacific Islander</option>
                <option value="white">White</option>
                <option value="two-or-more-races">Two or More Races</option>
                <option value="self-describe-race">Prefer to self-describe</option>
              </select>
            </div>
            {/* Added Religion Field */}
            <div className="form-group">
              <label htmlFor="religion" className="form-label text-midnight-navy">Religion/Spiritual Affiliation</label>
              <select 
                id="religion" 
                value={formData.demographics.religion || ''} 
                onChange={(e) => handleInputChange('demographics', 'religion', e.target.value)} 
                className="form-select border-slate-100/50 focus:ring-civic-blue focus:border-civic-blue"
              >
                <option value="">Prefer not to say</option>
                <option value="agnostic">Agnostic</option>
                <option value="atheist">Atheist</option>
                <option value="buddhist">Buddhist</option>
                <option value="christian">Christian</option>
                <option value="hindu">Hindu</option>
                <option value="jewish">Jewish</option>
                <option value="muslim">Muslim</option>
                <option value="spiritual-not-religious">Spiritual but not religious</option>
                <option value="other-religion">Other</option>
                <option value="self-describe-religion">Prefer to self-describe</option>
              </select>
            </div>
            {/* Added Income Range Field */}
            <div className="form-group">
              <label htmlFor="incomeRange" className="form-label text-midnight-navy">Annual Household Income</label>
              <select id="incomeRange" value={formData.demographics.incomeRange || ''} onChange={(e) => handleInputChange('demographics', 'incomeRange', e.target.value)} className="form-select border-slate-100/50 focus:ring-civic-blue focus:border-civic-blue">
                <option value="">Prefer not to say</option>
                <option value="<$25k">Less than $25,000</option>
                <option value="$25k-$50k">$25,000 to $49,999</option>
                <option value="$50k-$75k">$50,000 to $74,999</option>
                <option value="$75k-$100k">$75,000 to $99,999</option>
                <option value="$100k-$150k">$100,000 to $149,999</option>
                <option value="$150k-$200k">$150,000 to $199,999</option>
                <option value=">$200k">More than $200,000</option>
              </select>
            </div>

            <div className="flex justify-end space-x-3">
              <button type="button" onClick={() => {setEditingSection(null); setFormData(JSON.parse(JSON.stringify(currentUser.profileData)));}} className="btn-outline border-slate-100/50 text-midnight-navy hover:bg-slate-100/50 px-4 py-2 text-sm">Cancel</button> 
              <button type="submit" className="btn-primary bg-civic-blue hover:bg-civic-blue/80 px-4 py-2 text-sm" disabled={isSubmitting}>Save Demographics</button>
            </div>
          </form>
        ) : (
          <div className="profile-data-grid grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-midnight-navy/80"> 
            <div className="profile-field"><strong>ZIP Code:</strong> <span>{currentUser.profileData.demographics.zipCode || <em className="text-slate-100/50">Not specified</em>}</span></div>
            <div className="profile-field"><strong>Age Range:</strong> <span className="capitalize">{currentUser.profileData.demographics.ageRange?.replace('-', ' to ') || <em className="text-slate-100/50">Not specified</em>}</span></div>
            <div className="profile-field"><strong>Gender:</strong> <span className="capitalize">{currentUser.profileData.demographics.genderIdentity === 'self-describe' ? currentUser.profileData.demographics.genderSelfDescribe : currentUser.profileData.demographics.genderIdentity?.replace('-', ' ') || <em className="text-slate-100/50">Not specified</em>}</span></div>
            <div className="profile-field"><strong>Education:</strong> <span className="capitalize">{currentUser.profileData.demographics.educationLevel?.replace('-', ' ') || <em className="text-slate-100/50">Not specified</em>}</span></div>
            <div className="profile-field"><strong>Race/Ethnicity:</strong> <span className="capitalize">{currentUser.profileData.demographics.raceEthnicity?.replace(/-/g, ' ') || <em className="text-slate-100/50">Not specified</em>}</span></div>
            <div className="profile-field"><strong>Religion:</strong> <span className="capitalize">{currentUser.profileData.demographics.religion?.replace(/-/g, ' ') || <em className="text-slate-100/50">Not specified</em>}</span></div>
            <div className="profile-field"><strong>Income Range:</strong> <span>{currentUser.profileData.demographics.incomeRange?.replace('-', ' to ') || <em className="text-slate-100/50">Not specified</em>}</span></div>
          </div>
        )
      )}
      
      {/* Political Profile Section */}
      {renderSection("Political Views", 'political', <FlagIcon className="h-6 w-6 text-civic-blue" />, 
        editingSection === 'political' ? (
            <form onSubmit={(e) => {e.preventDefault(); handleSubmit('political');}} className="profile-edit-form space-y-4"> 
                <div className="form-group">
                    <label htmlFor="partyAffiliation" className="form-label text-midnight-navy">Party Affiliation</label>
                    <select id="partyAffiliation" value={formData.politicalProfile.partyAffiliation || ''} onChange={(e) => handleInputChange('politicalProfile', 'partyAffiliation', e.target.value)} className="form-select border-slate-100/50 focus:ring-civic-blue focus:border-civic-blue"> 
                        <option value="">Prefer not to say</option><option value="democrat">Democratic</option><option value="republican">Republican</option>
                        <option value="independent">Independent</option><option value="libertarian">Libertarian</option><option value="green">Green</option><option value="other">Other</option>
                    </select>
                </div>
                {formData.politicalProfile.partyAffiliation === 'other' && (
                    <div className="form-group">
                        <label htmlFor="partyOther" className="form-label text-midnight-navy">Other Party</label>
                        <input type="text" id="partyOther" value={formData.politicalProfile.partyOther || ''} onChange={(e) => handleInputChange('politicalProfile', 'partyOther', e.target.value)} className="form-input border-slate-100/50 focus:ring-civic-blue focus:border-civic-blue" /> 
                    </div>
                )}
                <div className="form-group">
                    <label htmlFor="politicalSpectrum" className="form-label text-midnight-navy">Political Leaning</label>
                    <select id="politicalSpectrum" value={formData.politicalProfile.politicalSpectrum || ''} onChange={(e) => handleInputChange('politicalProfile', 'politicalSpectrum', e.target.value)} className="form-select border-slate-100/50 focus:ring-civic-blue focus:border-civic-blue"> 
                        <option value="">Prefer not to say</option><option value="very-liberal">Very Liberal</option><option value="liberal">Liberal</option>
                        <option value="moderate">Moderate</option><option value="conservative">Conservative</option><option value="very-conservative">Very Conservative</option>
                    </select>
                </div>
                <div className="form-group">
                    <label className="form-label text-midnight-navy">Key Issues (Max 3)</label>
                    <div className="onboarding-checkbox-group grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {POLITICAL_KEY_ISSUES_LIST.map(issue => (
                            <label key={issue.id} htmlFor={`edit-issue-${issue.id}`} className="text-midnight-navy hover:bg-slate-100/50 border-slate-100/50 p-3 rounded-md border cursor-pointer flex items-center space-x-2"> 
                            <input type="checkbox" id={`edit-issue-${issue.id}`} value={issue.id}
                                checked={(formData.politicalProfile.keyIssues || []).includes(issue.id)}
                                onChange={() => handleMultiSelectChange('politicalProfile', 'keyIssues', issue.id)} 
                                disabled={(formData.politicalProfile.keyIssues || []).length >= 3 && !(formData.politicalProfile.keyIssues || []).includes(issue.id)}
                                className="accent-civic-blue h-4 w-4"
                                />
                            <span>{issue.label}</span>
                            </label>
                        ))}
                    </div>
                </div>
                <div className="flex justify-end space-x-3">
                    <button type="button" onClick={() => {setEditingSection(null); setFormData(JSON.parse(JSON.stringify(currentUser.profileData)));}} className="btn-outline border-slate-100/50 text-midnight-navy hover:bg-slate-100/50 px-4 py-2 text-sm">Cancel</button> 
                    <button type="submit" className="btn-primary bg-civic-blue hover:bg-civic-blue/80 px-4 py-2 text-sm" disabled={isSubmitting}>Save Political Views</button>
                </div>
            </form>
        ) : (
            <div className="profile-data-grid grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-midnight-navy/80"> 
                <div className="profile-field"><strong>Party:</strong> <span className="capitalize">{currentUser.profileData.politicalProfile.partyAffiliation === 'other' ? currentUser.profileData.politicalProfile.partyOther : currentUser.profileData.politicalProfile.partyAffiliation || <em className="text-slate-100/50">Not specified</em>}</span></div>
                <div className="profile-field"><strong>Leaning:</strong> <span className="capitalize">{currentUser.profileData.politicalProfile.politicalSpectrum?.replace('-', ' ') || <em className="text-slate-100/50">Not specified</em>}</span></div>
                <div className="profile-field sm:col-span-2"><strong>Key Issues:</strong> 
                    <span>{(currentUser.profileData.politicalProfile.keyIssues && currentUser.profileData.politicalProfile.keyIssues.length > 0)
                        ? currentUser.profileData.politicalProfile.keyIssues.map(id => POLITICAL_KEY_ISSUES_LIST.find(iss => iss.id === id)?.label).filter(Boolean).join(', ')
                        : <em className="text-slate-100/50">Not specified</em>}
                    </span>
                </div>
            </div>
        )
      )}

      {/* Civic Engagement Section */}
        {renderSection("Civic Engagement", 'civic', <ChartBarIcon className="h-6 w-6 text-civic-blue" />, 
            editingSection === 'civic' ? (
                <form onSubmit={(e) => { e.preventDefault(); handleSubmit('civic'); }} className="profile-edit-form space-y-4"> 
                    <div className="form-group">
                        <label htmlFor="votingFrequency" className="form-label text-midnight-navy">Voting Frequency</label>
                        <select id="votingFrequency" value={formData.civicEngagement.votingFrequency || ''} onChange={(e) => handleInputChange('civicEngagement', 'votingFrequency', e.target.value)} className="form-select border-slate-100/50 focus:ring-civic-blue focus:border-civic-blue"> 
                           <option value="">Prefer not to say</option><option value="every">Every election</option><option value="most">Most elections</option>
                           <option value="some">Some elections</option><option value="rarely">Rarely</option><option value="first-time">First-time voter</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label text-midnight-navy">Information Sources</label>
                         <div className="onboarding-checkbox-group grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {CIVIC_INFO_SOURCES_LIST.map(source => (
                                <label key={source.id} htmlFor={`edit-source-${source.id}`} className="text-midnight-navy hover:bg-slate-100/50 border-slate-100/50 p-3 rounded-md border cursor-pointer flex items-center space-x-2"> 
                                <input type="checkbox" id={`edit-source-${source.id}`} value={source.id}
                                    checked={(formData.civicEngagement.infoSources || []).includes(source.id)}
                                    onChange={() => handleMultiSelectChange('civicEngagement', 'infoSources', source.id)} 
                                    className="accent-civic-blue h-4 w-4"
                                    />
                                <span>{source.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    <div className="flex justify-end space-x-3">
                        <button type="button" onClick={() => {setEditingSection(null); setFormData(JSON.parse(JSON.stringify(currentUser.profileData)));}} className="btn-outline border-slate-100/50 text-midnight-navy hover:bg-slate-100/50 px-4 py-2 text-sm">Cancel</button> 
                        <button type="submit" className="btn-primary bg-civic-blue hover:bg-civic-blue/80 px-4 py-2 text-sm" disabled={isSubmitting}>Save Civic Info</button>
                    </div>
                </form>
            ) : (
                <div className="profile-data-grid grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-midnight-navy/80"> 
                    <div className="profile-field"><strong>Voting Frequency:</strong> <span className="capitalize">{currentUser.profileData.civicEngagement.votingFrequency?.replace('-', ' ') || <em className="text-slate-100/50">Not specified</em>}</span></div>
                    <div className="profile-field sm:col-span-2"><strong>Info Sources:</strong> 
                        <span>{(currentUser.profileData.civicEngagement.infoSources && currentUser.profileData.civicEngagement.infoSources.length > 0)
                            ? currentUser.profileData.civicEngagement.infoSources.map(id => CIVIC_INFO_SOURCES_LIST.find(src => src.id === id)?.label).filter(Boolean).join(', ')
                            : <em className="text-slate-100/50">Not specified</em>}
                        </span>
                    </div>
                </div>
            )
        )}

      {/* Account Actions */}
      <div className="mt-10 pt-6 border-t border-slate-100/30 space-y-4"> 
         <h2 className="text-xl font-semibold text-midnight-navy flex items-center">
            <KeyIcon className="h-6 w-6 text-civic-blue" /> <span className="ml-2">Account Actions</span> 
          </h2>
        <button 
          onClick={handleLogout} 
          className="btn-secondary w-full flex items-center justify-center bg-sunlight-gold hover:bg-sunlight-gold/80 text-midnight-navy font-semibold py-2 px-4 rounded-md transition duration-150 ease-in-out" 
        >
          <ArrowLeftOnRectangleIcon className="h-5 w-5 mr-2" /> Logout
        </button>
        {currentUser?.authProvider === 'email' && (
          <button 
            onClick={() => { setShowPasswordModal(true); setActionError(null); }} 
            className="btn-outline w-full border-civic-blue text-civic-blue hover:bg-civic-blue/10 font-semibold py-2 px-4 rounded-md transition duration-150 ease-in-out" 
          >
            Change Password
          </button>
        )}
        <button 
          onClick={() => { setShowDeleteModal(true); setActionError(null); }}
          className="w-full flex items-center justify-center bg-transparent hover:bg-red-500/10 text-red-500 font-semibold py-2 px-4 border border-red-500 hover:border-red-600 rounded-md transition duration-150 ease-in-out"
        >
         <TrashIcon className="h-5 w-5 mr-2" /> Delete Account
        </button>
      </div>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <Modal isOpen={showPasswordModal} onClose={() => {setShowPasswordModal(false); setActionError(null); setCurrentPassword(''); setNewPassword('');}} title="Change Password">
          <div className="space-y-4">
            {actionError && <p className="text-sm text-red-500 bg-red-100 p-3 rounded-md">{actionError}</p>}
            <div>
              <label htmlFor="currentPasswordModal" className="form-label text-midnight-navy">Current Password</label>
              <input 
                type="password" 
                id="currentPasswordModal" 
                value={currentPassword} 
                onChange={(e) => setCurrentPassword(e.target.value)} 
                className="form-input w-full border-slate-100/50 focus:ring-civic-blue focus:border-civic-blue"
              />
            </div>
            <div>
              <label htmlFor="newPasswordModal" className="form-label text-midnight-navy">New Password</label>
              <input 
                type="password" 
                id="newPasswordModal" 
                value={newPassword} 
                onChange={(e) => setNewPassword(e.target.value)} 
                className="form-input w-full border-slate-100/50 focus:ring-civic-blue focus:border-civic-blue"
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button type="button" onClick={() => {setShowPasswordModal(false); setActionError(null); setCurrentPassword(''); setNewPassword('');}} className="btn-outline border-slate-100/50 text-midnight-navy hover:bg-slate-100/50 px-4 py-2 text-sm">Cancel</button>
              <button type="button" onClick={handleChangePassword} className="btn-primary bg-civic-blue hover:bg-civic-blue/80 px-4 py-2 text-sm" disabled={isSubmitting || !currentPassword || !newPassword}>
                {isSubmitting ? <LoadingSpinner size="sm" /> : 'Confirm Change'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <Modal isOpen={showDeleteModal} onClose={() => {setShowDeleteModal(false); setActionError(null); setCurrentPassword('');}} title="Delete Account">
          <div className="space-y-4">
            <p className="text-sm text-red-700 bg-red-100 p-3 rounded-md">
              <strong>Warning:</strong> This action is irreversible and all your data will be permanently lost. 
              Please enter your current password to confirm.
            </p>
            {actionError && <p className="text-sm text-red-500 bg-red-100 p-3 rounded-md mt-2">{actionError}</p>}
            {currentUser?.authProvider === 'email' && (
                 <div>
                    <label htmlFor="currentPasswordDeleteModal" className="form-label text-midnight-navy">Current Password</label>
                    <input 
                        type="password" 
                        id="currentPasswordDeleteModal" 
                        value={currentPassword} 
                        onChange={(e) => setCurrentPassword(e.target.value)} 
                        className="form-input w-full border-slate-100/50 focus:ring-civic-blue focus:border-civic-blue"
                    />
                </div>
            )}
            {currentUser?.authProvider !== 'email' && (
                <p className="text-sm text-midnight-navy/80">For accounts created via Google or Twitter, re-authentication may be required by the provider. Proceeding will attempt to delete your account data from MyBallot.</p>
            )}
            <div className="flex justify-end space-x-3">
              <button type="button" onClick={() => {setShowDeleteModal(false); setActionError(null); setCurrentPassword('');}} className="btn-outline border-slate-100/50 text-midnight-navy hover:bg-slate-100/50 px-4 py-2 text-sm">Cancel</button>
              <button 
                type="button" 
                onClick={handleDeleteAccount} 
                className="btn-danger bg-red-600 hover:bg-red-700 text-white px-4 py-2 text-sm" 
                disabled={isSubmitting || (currentUser?.authProvider === 'email' && !currentPassword)}
              >
                {isSubmitting ? <LoadingSpinner size="sm" /> : 'Confirm Deletion'}
              </button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
};

export default UserProfilePage;