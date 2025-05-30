import React, { useState, useEffect } from 'react'; // Removed ReactNode
import Modal from '../ui/Modal';
import { Cycle, ReminderType, NotificationMethod, ReminderSettings, EarlyVotingLocation } from '../../types';
import { getEarlyVotingLocations } from '../../services/dataService';
import { CalendarDaysIcon, DevicePhoneMobileIcon, EnvelopeIcon, InformationCircleIcon, TrashIcon, PencilIcon } from '@heroicons/react/24/outline'; // Removed ClockIcon, MapPinIcon

interface ReminderSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  electionCycle: Cycle;
  electionDisplayName: string;
  initialReminderSettings: ReminderSettings | null;
  onSaveReminder: (settings: ReminderSettings | null) => void;
}

type ReminderStep = 'viewDetails' | 'periodChoice' | 'dateTime' | 'locationChoice' | 'notifications' | 'confirmation' | 'calendarDetails';

// Regular expression for validating phone numbers: matches 10 to 15 digits.
const phoneRegex = /^\d{10,15}$/;

export const ReminderSetupModal: React.FC<ReminderSetupModalProps> = ({ 
  isOpen, 
  onClose, 
  electionCycle,
  electionDisplayName,
  initialReminderSettings,
  onSaveReminder
}) => {
  const [currentStep, setCurrentStep] = useState<ReminderStep>(initialReminderSettings ? 'viewDetails' : 'periodChoice');
  const [reminderType, setReminderType] = useState<ReminderType | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(''); // YYYY-MM-DD
  const [selectedTime, setSelectedTime] = useState<string>('09:00'); // HH:MM
  
  const [earlyVotingLocations, setEarlyVotingLocations] = useState<EarlyVotingLocation[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');

  const [notifyByText, setNotifyByText] = useState<boolean>(false);
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [notifyByEmail, setNotifyByEmail] = useState<boolean>(false);
  const [emailAddress, setEmailAddress] = useState<string>('');

  const [showCalendarDetails, setShowCalendarDetails] = useState<boolean>(false);
  const isEditingFlow = !!initialReminderSettings; // True if initial settings were provided, meaning we started with view/edit

  useEffect(() => {
    if (isOpen) {
      const locations = getEarlyVotingLocations();
      setEarlyVotingLocations(locations);

      if (initialReminderSettings) {
        setCurrentStep('viewDetails'); // Start at viewDetails if editing
        setReminderType(initialReminderSettings.reminderType);
        const dateTime = new Date(initialReminderSettings.reminderDateTime);
        setSelectedDate(dateTime.toISOString().split('T')[0]);
        setSelectedTime(dateTime.toTimeString().split(' ')[0].substring(0, 5));
        
        if (initialReminderSettings.reminderType === 'earlyVote' && initialReminderSettings.earlyVotingLocationName) {
          const foundLocation = locations.find(loc => loc.name === initialReminderSettings.earlyVotingLocationName);
          setSelectedLocationId(foundLocation ? foundLocation.id : '');
        } else {
          setSelectedLocationId('');
        }

        setNotifyByText(initialReminderSettings.notificationMethods.includes('text'));
        setPhoneNumber(initialReminderSettings.phoneNumber || '');
        setNotifyByEmail(initialReminderSettings.notificationMethods.includes('email'));
        setEmailAddress(initialReminderSettings.emailAddress || '');
      } else {
        // Reset for new reminder
        setCurrentStep('periodChoice');
        setReminderType(null);
        setSelectedDate('');
        setSelectedTime('09:00');
        setSelectedLocationId('');
        setNotifyByText(false);
        setPhoneNumber('');
        setNotifyByEmail(false);
        setEmailAddress('');
      }
      setShowCalendarDetails(false);
    }
  }, [isOpen, initialReminderSettings]);

  const handlePeriodChoice = (type: ReminderType) => {
    setReminderType(type);
    if (type === 'electionDay') {
      setSelectedDate(electionCycle.electionDate);
    } else {
      // If editing and already selected an early voting date, keep it, otherwise default to start.
      if (isEditingFlow && initialReminderSettings?.reminderType === 'earlyVote' && initialReminderSettings.reminderDateTime.startsWith(electionCycle.evStart.substring(0,4))) {
          const initialDate = new Date(initialReminderSettings.reminderDateTime).toISOString().split('T')[0];
          if (initialDate >= electionCycle.evStart && initialDate <= electionCycle.evEnd) {
             setSelectedDate(initialDate);
          } else {
            setSelectedDate(electionCycle.evStart || '');
          }
      } else {
        setSelectedDate(electionCycle.evStart || '');
      }
    }
    setCurrentStep('dateTime');
  };

  const handleSubmitDateTime = () => {
    if (!selectedDate || !selectedTime) {
      alert("Please select a date and time.");
      return;
    }
    if (reminderType === 'earlyVote') {
        setCurrentStep('locationChoice');
    } else {
        setCurrentStep('notifications');
    }
  };

  const handleSubmitLocation = () => {
    if (reminderType === 'earlyVote' && !selectedLocationId) {
      alert("Please select an early voting location.");
      return;
    }
    setCurrentStep('notifications');
  };


  const finalizeAndSaveReminder = () => {
    if (notifyByText && !phoneRegex.test(phoneNumber)) { 
      alert("Please enter a valid phone number (10-15 digits).");
      return;
    }
    if (notifyByEmail && !emailAddress.includes('@')) { 
      alert("Please enter a valid email address.");
      return;
    }

    const methods: NotificationMethod[] = [];
    if (notifyByText) methods.push('text');
    if (notifyByEmail) methods.push('email');

    const reminderDateTimeISO = new Date(`${selectedDate}T${selectedTime}:00`).toISOString();
    
    let locationName: string | undefined = undefined;
    let locationAddress: string | undefined = undefined;
    if (reminderType === 'earlyVote' && selectedLocationId) {
        const loc = earlyVotingLocations.find(l => l.id === selectedLocationId);
        if (loc) {
            locationName = loc.name;
            locationAddress = loc.address;
        }
    }

    const newSettings: ReminderSettings = {
      electionDate: electionCycle.electionDate,
      reminderType: reminderType!, 
      reminderDateTime: reminderDateTimeISO,
      notificationMethods: methods,
      phoneNumber: notifyByText ? phoneNumber : undefined,
      emailAddress: notifyByEmail ? emailAddress : undefined,
      earlyVotingLocationName: locationName,
      earlyVotingLocationAddress: locationAddress,
    };
    onSaveReminder(newSettings);
    setCurrentStep('confirmation'); 
  };
  
  const handleDeleteReminder = () => {
    if (window.confirm("Are you sure you want to delete this reminder?")) {
      onSaveReminder(null); 
      onClose(); 
    }
  };
  
  const handleGetCalendarDetails = () => {
    setShowCalendarDetails(true);
  };
  
  const resetAndClose = () => {
    onClose();
  };

  const getBackButtonDestination = (): ReminderStep => {
    if (isEditingFlow) {
      switch (currentStep) {
        case 'periodChoice': return 'viewDetails';
        case 'dateTime': return 'periodChoice';
        case 'locationChoice': return 'dateTime';
        case 'notifications': return reminderType === 'earlyVote' ? 'locationChoice' : 'dateTime';
        default: return 'viewDetails';
      }
    } else { // Creation flow
      switch (currentStep) {
        case 'dateTime': return 'periodChoice';
        case 'locationChoice': return 'dateTime';
        case 'notifications': return reminderType === 'earlyVote' ? 'locationChoice' : 'dateTime';
        default: return 'periodChoice';
      }
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'viewDetails':
        if (!initialReminderSettings) return <p>Error: No reminder details to display.</p>;
        const reminderDT = new Date(initialReminderSettings.reminderDateTime);
        const reminderLoc = initialReminderSettings.earlyVotingLocationName 
                            ? `${initialReminderSettings.earlyVotingLocationName} (${initialReminderSettings.earlyVotingLocationAddress})`
                            : 'N/A';
        let reminderNotifs = [];
        if(initialReminderSettings.notificationMethods.includes('text') && initialReminderSettings.phoneNumber) reminderNotifs.push(`Text to ${initialReminderSettings.phoneNumber}`);
        if(initialReminderSettings.notificationMethods.includes('email') && initialReminderSettings.emailAddress) reminderNotifs.push(`Email to ${initialReminderSettings.emailAddress}`);
        if(reminderNotifs.length === 0) reminderNotifs.push("App notification (conceptual)");

        return (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-midnight-navy mb-3">Your Current Reminder</h3> {/* Updated text color */}
            <div className="p-4 bg-slate-100 rounded-md border border-midnight-navy/20 space-y-2 text-sm"> {/* Updated background and border colors */}
              <p><strong>Election:</strong> {electionDisplayName}</p>
              <p><strong>Voting Plan:</strong> {initialReminderSettings.reminderType === 'earlyVote' ? 'Early Voting' : 'Election Day'}</p>
              <p><strong>Reminder Date:</strong> {reminderDT.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
              <p><strong>Reminder Time:</strong> {reminderDT.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</p>
              {initialReminderSettings.reminderType === 'earlyVote' && <p><strong>Location:</strong> {reminderLoc}</p>}
              <p><strong>Notify via:</strong> {reminderNotifs.join(', ')}</p>
            </div>
            <div className="flex flex-col sm:flex-row justify-between items-center space-y-3 sm:space-y-0 sm:space-x-3 mt-6">
              <button onClick={handleDeleteReminder} className="w-full sm:w-auto flex items-center justify-center text-sunlight-gold hover:text-sunlight-gold/80 py-2 px-4 rounded-md border border-sunlight-gold hover:bg-sunlight-gold/10 transition-colors">
                <TrashIcon className="h-5 w-5 mr-2" /> Delete Reminder
              </button>
              <button onClick={() => setCurrentStep('periodChoice')} className="w-full sm:w-auto flex items-center justify-center bg-midnight-navy text-white py-2 px-4 rounded-md hover:bg-midnight-navy/80 transition-colors"> {/* Updated background and hover colors */}
                <PencilIcon className="h-5 w-5 mr-2" /> Edit Reminder
              </button>
              <button onClick={resetAndClose} className="w-full sm:w-auto bg-civic-blue text-white py-2 px-4 rounded-md hover:bg-civic-blue/80 transition-colors"> {/* Updated background and hover colors */}
                Done
              </button>
            </div>
          </div>
        );

      case 'periodChoice':
        return (
          <div className="space-y-4">
            <p className="text-lg text-midnight-navy">When do you plan to vote for the {electionDisplayName}?</p> {/* Updated text color */}
            <button
              onClick={() => handlePeriodChoice('earlyVote')}
              className="w-full bg-midnight-navy text-white py-3 px-4 rounded-md hover:bg-midnight-navy/80 transition-colors text-lg" // Updated background and hover colors
            >
              During Early Voting
            </button>
            <button
              onClick={() => handlePeriodChoice('electionDay')}
              className="w-full bg-civic-blue text-white py-3 px-4 rounded-md hover:bg-civic-blue/80 transition-colors text-lg" // Updated background and hover colors
            >
              On Election Day
            </button>
            <p className="text-xs text-midnight-navy/70 mt-2"> {/* Updated text color */}
              Early Voting: {new Date(electionCycle.evStart + 'T00:00:00').toLocaleDateString()} - {new Date(electionCycle.evEnd + 'T00:00:00').toLocaleDateString()}<br/>
              Election Day: {new Date(electionCycle.electionDate + 'T00:00:00').toLocaleDateString()}
            </p>
             {isEditingFlow && (
                <div className="flex justify-start mt-6">
                    <button onClick={() => setCurrentStep(getBackButtonDestination())} className="text-midnight-navy/70 hover:text-midnight-navy">Back to Details</button> {/* Updated text colors */}
                </div>
            )}
          </div>
        );

      case 'dateTime':
        const isEarlyVoting = reminderType === 'earlyVote';
        return (
          <div className="space-y-4">
            <p className="text-lg text-midnight-navy">Set your reminder date and time:</p> {/* Updated text color */}
            <div>
              <label htmlFor="reminder-date" className="block text-sm font-medium text-midnight-navy mb-1">Date:</label> {/* Updated text color */}
              {isEarlyVoting ? (
                <input
                  type="date"
                  id="reminder-date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  min={electionCycle.evStart}
                  max={electionCycle.evEnd}
                  className="w-full p-2 border border-midnight-navy/30 rounded-md focus:ring-sunlight-gold focus:border-sunlight-gold text-midnight-navy bg-white" // Updated border, focus, text, bg colors
                  required
                />
              ) : (
                <p className="p-2 bg-slate-100 rounded-md border border-midnight-navy/20 text-midnight-navy"> {/* Updated background, border, text colors */}
                  {new Date(electionCycle.electionDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} (Election Day)
                </p>
              )}
            </div>
            <div>
              <label htmlFor="reminder-time" className="block text-sm font-medium text-midnight-navy mb-1">Time:</label> {/* Updated text color */}
              <input
                type="time"
                id="reminder-time"
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                className="w-full p-2 border border-midnight-navy/30 rounded-md focus:ring-sunlight-gold focus:border-sunlight-gold text-midnight-navy bg-white" // Updated border, focus, text, bg colors
                required
              />
            </div>
            <div className="flex justify-between items-center mt-6">
              <button onClick={() => setCurrentStep(getBackButtonDestination())} className="text-midnight-navy/70 hover:text-midnight-navy">Back</button> {/* Updated text colors */}
              <button onClick={handleSubmitDateTime} className="bg-civic-blue text-white py-2 px-4 rounded-md hover:bg-civic-blue/80">Next</button> {/* Updated background and hover colors */}
            </div>
          </div>
        );

      case 'locationChoice':
        const selectedLocationDetails = earlyVotingLocations.find(loc => loc.id === selectedLocationId);
        return (
          <div className="space-y-4">
            <p className="text-lg text-midnight-navy">Choose an Early Voting Location:</p> {/* Updated text color */}
            <div>
              <label htmlFor="ev-location" className="block text-sm font-medium text-midnight-navy mb-1">Location:</label> {/* Updated text color */}
              <select
                id="ev-location"
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(e.target.value)}
                className="w-full p-2 border border-midnight-navy/30 bg-white rounded-md focus:outline-none focus:ring-sunlight-gold focus:border-sunlight-gold text-midnight-navy" // Updated border, focus, text, bg colors
                required
              >
                <option value="">-- Select a Location --</option>
                {earlyVotingLocations.map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>
            {selectedLocationDetails && (
              <div className="p-3 bg-slate-100 rounded-md border border-midnight-navy/20 text-sm"> {/* Updated background and border colors */}
                <p className="font-semibold text-midnight-navy">{selectedLocationDetails.name}</p> {/* Updated text color */}
                <p className="text-midnight-navy/70">{selectedLocationDetails.address}</p> {/* Updated text color */}
              </div>
            )}
            <div className="flex justify-between items-center mt-6">
              <button onClick={() => setCurrentStep(getBackButtonDestination())} className="text-midnight-navy/70 hover:text-midnight-navy">Back</button> {/* Updated text colors */}
              <button onClick={handleSubmitLocation} className="bg-civic-blue text-white py-2 px-4 rounded-md hover:bg-civic-blue/80">Next</button> {/* Updated background and hover colors */}
            </div>
          </div>
        );
      
      case 'notifications':
        return (
          <div className="space-y-6">
            <p className="text-lg text-midnight-navy">How would you like to be reminded?</p> {/* Updated text color */}
            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  id="notify-text"
                  type="checkbox"
                  checked={notifyByText}
                  onChange={(e) => setNotifyByText(e.target.checked)}
                  className="h-5 w-5 text-civic-blue border-midnight-navy/30 rounded focus:ring-civic-blue" // Updated accent, border, focus colors
                />
                <label htmlFor="notify-text" className="ml-3 text-sm text-midnight-navy flex items-center"> {/* Updated text color */}
                  <DevicePhoneMobileIcon className="h-5 w-5 mr-2 text-midnight-navy/70" /> Text Message {/* Updated icon color */}
                </label>
              </div>
              {notifyByText && (
                <input
                  type="tel"
                  placeholder="Your phone number (e.g. 1234567890)"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full p-2 border border-midnight-navy/30 rounded-md focus:ring-sunlight-gold focus:border-sunlight-gold text-midnight-navy bg-white" // Updated border, focus, text, bg colors
                />
              )}
              <div className="flex items-center">
                <input
                  id="notify-email"
                  type="checkbox"
                  checked={notifyByEmail}
                  onChange={(e) => setNotifyByEmail(e.target.checked)}
                  className="h-5 w-5 text-civic-blue border-midnight-navy/30 rounded focus:ring-civic-blue" // Updated accent, border, focus colors
                />
                <label htmlFor="notify-email" className="ml-3 text-sm text-midnight-navy flex items-center"> {/* Updated text color */}
                  <EnvelopeIcon className="h-5 w-5 mr-2 text-midnight-navy/70" /> Email {/* Updated icon color */}
                </label>
              </div>
              {notifyByEmail && (
                <input
                  type="email"
                  placeholder="Your email address"
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
                  className="w-full p-2 border border-midnight-navy/30 rounded-md focus:ring-sunlight-gold focus:border-sunlight-gold text-midnight-navy bg-white" // Updated border, focus, text, bg colors
                />
              )}
            </div>
            <div className="mt-4 p-3 bg-slate-100 rounded-md border border-midnight-navy/20"> {/* Updated background and border colors */}
                 <button
                    onClick={handleGetCalendarDetails}
                    className="w-full flex items-center justify-center text-midnight-navy hover:text-civic-blue font-medium py-2 px-3 rounded-md border border-midnight-navy/50 hover:border-civic-blue transition-colors bg-white" // Updated text, hover, border colors
                >
                    <CalendarDaysIcon className="h-5 w-5 mr-2" /> Get Calendar Details
                </button>
                {showCalendarDetails && selectedDate && selectedTime && (
                    <div className="mt-3 p-3 bg-white border border-midnight-navy/20 rounded-md text-sm"> {/* Updated background and border colors */}
                        <h4 className="font-semibold text-midnight-navy mb-1">Add to your calendar:</h4> {/* Updated text color */}
                        <p className="text-midnight-navy"><strong>Event:</strong> Vote in {electionDisplayName}</p> {/* Updated text color */}
                        <p className="text-midnight-navy"><strong>Date:</strong> {new Date(selectedDate + 'T' + selectedTime).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p> {/* Updated text color */}
                        <p className="text-midnight-navy"><strong>Time:</strong> {new Date(selectedDate + 'T' + selectedTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</p> {/* Updated text color */}
                        {reminderType === 'earlyVote' && selectedLocationId && earlyVotingLocations.find(l => l.id === selectedLocationId) && (
                          <p className="text-midnight-navy"><strong>Location:</strong> {earlyVotingLocations.find(l => l.id === selectedLocationId)?.name}, {earlyVotingLocations.find(l => l.id === selectedLocationId)?.address}</p> /* Updated text color */
                        )}
                        <p className="mt-1 text-xs italic text-midnight-navy/70">Please manually add these details to your preferred calendar application.</p> {/* Updated text color */}
                    </div>
                )}
            </div>
             <p className="text-xs text-midnight-navy/70 mt-2"> {/* Updated text color */}
                <InformationCircleIcon className="h-4 w-4 inline mr-1 align-text-bottom" />
                Standard message/data rates may apply for texts. We will not share your contact information. This is a conceptual reminder.
             </p>
            <div className="flex justify-between items-center mt-8">
              <button onClick={() => setCurrentStep(getBackButtonDestination())} className="text-midnight-navy/70 hover:text-midnight-navy">Back</button> {/* Updated text colors */}
              {isEditingFlow && ( // Show delete only if we started with an existing reminder
                <button 
                  onClick={handleDeleteReminder} 
                  className="text-sunlight-gold hover:text-sunlight-gold/80 flex items-center text-sm"
                  title="Delete Reminder"
                >
                  <TrashIcon className="h-5 w-5 mr-1" /> Delete
                </button>
              )}
              <button onClick={finalizeAndSaveReminder} className="bg-civic-blue text-white py-2 px-4 rounded-md hover:bg-civic-blue/80">
                {isEditingFlow ? 'Update Reminder' : 'Set Reminder'}
              </button>
            </div>
          </div>
        );
        
      case 'confirmation':
        const reminderDateTime = new Date(selectedDate + 'T' + selectedTime);
        let methods: string[] = [];
        if (notifyByText && phoneNumber) methods.push(`Text to ${phoneNumber}`);
        if (notifyByEmail && emailAddress) methods.push(`Email to ${emailAddress}`);
        if (methods.length === 0 && !notifyByText && !notifyByEmail) methods.push("App notification (conceptual)");
        const finalLocation = earlyVotingLocations.find(l => l.id === selectedLocationId);

        return (
          <div className="space-y-4 text-center">
            <h3 className="text-2xl font-semibold text-green-600">Reminder {isEditingFlow ? 'Updated' : 'Set'}!</h3> {/* Kept green for confirmation */}
            <p className="text-midnight-navy">
              You'll get a reminder to vote in the <strong>{electionDisplayName}</strong> on:
            </p>
            <p className="text-xl font-medium text-civic-blue"> {/* Updated text color */}
              {reminderDateTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              <br/>at {reminderDateTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
            </p>
            {reminderType === 'earlyVote' && finalLocation && (
                <p className="text-midnight-navy/70">
                    At: <strong>{finalLocation.name}</strong> ({finalLocation.address})
                </p>
            )}
            <p className="text-midnight-navy/70">Via: {methods.join(', ') || 'No notification method selected.'}.</p>
            {showCalendarDetails && <p className="text-sm text-midnight-navy/70">Don't forget to add it to your calendar if you haven't already!</p>}
            <button onClick={resetAndClose} className="mt-6 w-full bg-midnight-navy text-white py-3 px-4 rounded-md hover:bg-midnight-navy/80">Done</button> {/* Updated background and hover colors */}
          </div>
        );
      default:
        return <p>Something went wrong.</p>;
    }
  };

  const getModalTitle = () => {
    if (currentStep === 'viewDetails') return `Reminder for ${electionDisplayName}`;
    if (isEditingFlow) {
        if (currentStep === 'confirmation') return 'Reminder Updated';
        return `Edit Reminder: ${electionDisplayName}`;
    }
    // Create mode titles
    switch(currentStep) {
      case 'periodChoice': return `Set Voting Reminder: ${electionDisplayName}`;
      case 'dateTime': return `Reminder for ${reminderType === 'earlyVote' ? 'Early Voting' : 'Election Day'}`;
      case 'locationChoice': return 'Choose Early Voting Location';
      case 'notifications': return 'Notification Preferences';
      case 'confirmation': return 'Reminder Confirmed';
      default: return 'Set Reminder';
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={resetAndClose} title={getModalTitle()} size="md">
      {renderStepContent()}
    </Modal>
  );
};
