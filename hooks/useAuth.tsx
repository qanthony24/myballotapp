import React, { createContext, useContext, useState, useEffect, useCallback, PropsWithChildren } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, UserProfileData, AuthProviderType } from '../types'; // Added AuthProviderType
import { auth, db } from '../firebase'; // Import Firebase auth and db instances
import {
  doc,
  setDoc,
  getDoc,
} from 'firebase/firestore'; // Firestore functions
import { 
  GoogleAuthProvider, 
  OAuthProvider, // For Twitter/X
  FacebookAuthProvider, // Added for Facebook
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  EmailAuthProvider, // Added for re-authentication
  reauthenticateWithCredential, // Added for re-authentication
  updatePassword, // Added for password change
  deleteUser, // Added for account deletion
  User as FirebaseUser
} from 'firebase/auth';

interface AuthContextType {
  currentUser: User | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, pass: string) => Promise<void>;
  signup: (email: string, pass: string, displayName?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>; 
  signInWithTwitter: () => Promise<void>;
  signInWithFacebook: () => Promise<void>; // Added for Facebook
  logout: () => Promise<void>; 
  updateUserProfile: (updatedProfileData: Partial<UserProfileData>) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>; // Added
  deleteUserAccount: (currentPassword: string) => Promise<void>; // Added
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// USER_STORAGE_KEY is no longer needed for profile data
// const USER_STORAGE_KEY = 'myBallotAppUser';

const initialProfileData: UserProfileData = {
  demographics: {
    ageRange: '',
    genderIdentity: '',
    genderSelfDescribe: '',
    zipCode: '',
    educationLevel: '',
    raceEthnicity: '', // Added
    religion: '', // Added
    incomeRange: '' // Added
  },
  politicalProfile: { keyIssues: [] },
  civicEngagement: { infoSources: [] },
  onboardingCompleted: false,
};

export const AuthProvider: React.FC<PropsWithChildren<{}>> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    setIsLoading(true);
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        let authProvider: AuthProviderType = 'email'; // Default
        if (firebaseUser.providerData && firebaseUser.providerData.length > 0) {
          const providerId = firebaseUser.providerData[0].providerId;
          if (providerId === GoogleAuthProvider.PROVIDER_ID) {
            authProvider = 'google';
          } else if (providerId === 'twitter.com') {
            authProvider = 'twitter';
          } else if (providerId === FacebookAuthProvider.PROVIDER_ID) { // Added for Facebook
            authProvider = 'facebook';
          } else if (providerId === 'password') { // Firebase provider ID for email/password
            authProvider = 'email';
          }
          // TODO: Add 'facebook.com' when Facebook login is implemented
        } else if (firebaseUser.email) {
          // If providerData is empty but email exists, it's likely email/password
          authProvider = 'email';
        }

        const userDocRef = doc(db, "users", firebaseUser.uid);
        let userProfileData: UserProfileData;

        try {
          const docSnap = await getDoc(userDocRef);
          if (docSnap.exists()) {
            // Ensure all keys from initialProfileData are present, merging with Firestore data
            userProfileData = { ...initialProfileData, ...(docSnap.data() as UserProfileData) };
          } else {
            console.log(`No profile found in Firestore for user ${firebaseUser.uid}. Creating initial profile.`);
            userProfileData = { ...initialProfileData };
            await setDoc(userDocRef, userProfileData); // Create initial profile in Firestore
          }

          const appUser: User = {
            id: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
            photoURL: firebaseUser.photoURL || undefined,
            authProvider: authProvider,
            profileData: userProfileData,
          };
          setCurrentUser(appUser);
          setError(null); // Clear any previous errors on successful load/creation

        } catch (profileError: any) {
          console.error("Error fetching/creating user profile from Firestore:", profileError);
          setError(profileError.message || "Failed to load user profile. Please try again.");
          // Fallback: create a local user object with initial profile data but indicate an error
          const appUserOnError: User = {
            id: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
            photoURL: firebaseUser.photoURL || undefined,
            authProvider: authProvider,
            profileData: { ...initialProfileData }, // Use default, data not saved/loaded from DB
          };
          setCurrentUser(appUserOnError);
        }
      } else {
        // User is signed out
        setCurrentUser(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe(); 
  }, []); // Empty dependency array, runs once on mount

  // updateUserInStorage function is no longer needed as profile data is in Firestore.
  // const updateUserInStorage = (user: User | null) => { ... };

  const login = useCallback(async (email: string, pass: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      // onAuthStateChanged will handle user state update and navigation
      console.log("Email/Password login successful. Waiting for onAuthStateChanged.");
    } catch (e: any) {
      console.error("Error during email/password login:", e);
      let errorMessage = 'Failed to log in.';
      if (e.code) {
        switch (e.code) {
          case 'auth/user-not-found':
          case 'auth/invalid-credential': // Covers wrong password and user not found in newer SDK versions
            errorMessage = 'Invalid email or password. Please try again.';
            break;
          case 'auth/wrong-password': // Older SDK might still use this
            errorMessage = 'Incorrect password. Please try again.';
            break;
          case 'auth/invalid-email':
            errorMessage = 'The email address is not valid.';
            break;
          case 'auth/user-disabled':
            errorMessage = 'This user account has been disabled.';
            break;
          case 'auth/network-request-failed':
            errorMessage = 'A network error occurred. Please check your connection.';
            break;
          default:
            errorMessage = e.message || 'An unknown error occurred during login.';
        }
      } else if (e.message) {
        errorMessage = e.message;
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []); // Removed navigate dependency

  const signup = useCallback(async (email: string, pass: string, displayName?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      if (userCredential.user) {
        await updateProfile(userCredential.user, {
          displayName: displayName || email.split('@')[0] || 'User'
        });
        // onAuthStateChanged will handle creating the appUser in localStorage,
        // setting currentUser, and navigating.
        // The displayName from updateProfile will be available on firebaseUser.displayName in onAuthStateChanged.
        console.log("Email/Password signup successful. Waiting for onAuthStateChanged.");
      }
    } catch (e: any) {
      console.error("Error during email/password signup:", e);
      let errorMessage = 'Failed to sign up.';
      if (e.code) {
        switch (e.code) {
          case 'auth/email-already-in-use':
            errorMessage = 'This email address is already in use.';
            break;
          case 'auth/invalid-email':
            errorMessage = 'The email address is not valid.';
            break;
          case 'auth/weak-password':
            errorMessage = 'The password is too weak. Please choose a stronger password.';
            break;
          case 'auth/operation-not-allowed':
            errorMessage = 'Email/password sign-up is not enabled. Contact support.';
            break;
          case 'auth/network-request-failed':
            errorMessage = 'A network error occurred. Please check your connection.';
            break;
          default:
            errorMessage = e.message || 'An unknown error occurred during sign up.';
        }
      } else if (e.message) {
        errorMessage = e.message;
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []); // Removed navigate dependency

  const signInWithGoogle = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      // onAuthStateChanged will now handle creating/updating the user in localStorage,
      // setting currentUser, and triggering navigation via useEffect in AuthPage or App.
      console.log("Google Sign-In popup initiated successfully. Waiting for onAuthStateChanged to update user state.");
    } catch (e: any) {
      console.error("Error during Google sign-in popup:", e);
      let errorMessage = 'Failed to sign in with Google.';
      if (e.code) {
        switch (e.code) {
          case 'auth/popup-closed-by-user':
            errorMessage = 'Sign-in popup was closed by the user. Please try again if this was unintentional.';
            break;
          case 'auth/cancelled-popup-request':
            errorMessage = 'Sign-in request cancelled. Please try again.';
            break;
          case 'auth/popup-blocked':
            errorMessage = 'Sign-in popup was blocked by the browser. Please allow popups for this site and try again.';
            break;
          case 'auth/operation-not-allowed':
            errorMessage = 'Google Sign-In is not enabled for this Firebase project. Please check your Firebase console settings.';
            break;
          case 'auth/network-request-failed':
            errorMessage = 'A network error occurred. Please check your internet connection and try again.';
            break;
          default:
            errorMessage = e.message || 'An unknown error occurred during Google Sign-In.';
        }
      } else if (e.message) {
        errorMessage = e.message;
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [navigate]); // navigate was kept here before, re-evaluating if needed. If only for error navigation, maybe not.

  const signInWithTwitter = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const provider = new OAuthProvider('twitter.com'); // Provider ID for Twitter/X
    try {
      await signInWithPopup(auth, provider);
      // onAuthStateChanged will handle user state updates and navigation
      console.log("Twitter/X Sign-In popup initiated. Waiting for onAuthStateChanged.");
    } catch (e: any) {
      console.error("Error during Twitter/X sign-in popup:", e);
      let errorMessage = 'Failed to sign in with Twitter/X.';
      if (e.code) {
        switch (e.code) {
          case 'auth/popup-closed-by-user':
            errorMessage = 'Sign-in popup was closed. Please try again.';
            break;
          case 'auth/cancelled-popup-request':
            errorMessage = 'Sign-in request cancelled. Please try again.';
            break;
          case 'auth/popup-blocked':
            errorMessage = 'Sign-in popup blocked by browser. Please allow popups.';
            break;
          case 'auth/account-exists-with-different-credential':
            errorMessage = 'An account already exists with the same email address but different sign-in credentials. Sign in using a provider associated with this email address.';
            break;
          case 'auth/operation-not-allowed':
            errorMessage = 'Twitter/X Sign-In is not enabled for this Firebase project. Check Firebase console.';
            break;
          case 'auth/network-request-failed':
            errorMessage = 'Network error. Check internet connection and try again.';
            break;
          default:
            errorMessage = e.message || 'Unknown error during Twitter/X Sign-In.';
        }
      } else if (e.message) {
        errorMessage = e.message;
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signInWithFacebook = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const provider = new FacebookAuthProvider();
    // You can add scopes here if needed, e.g.:
    // provider.addScope('email');
    // provider.addScope('public_profile');
    try {
      await signInWithPopup(auth, provider);
      // onAuthStateChanged will handle user state updates and navigation
      console.log("Facebook Sign-In popup initiated. Waiting for onAuthStateChanged.");
    } catch (e: any) {
      console.error("Error during Facebook sign-in popup:", e);
      let errorMessage = 'Failed to sign in with Facebook.';
      if (e.code) {
        switch (e.code) {
          case 'auth/popup-closed-by-user':
            errorMessage = 'Sign-in popup was closed. Please try again.';
            break;
          case 'auth/cancelled-popup-request':
            errorMessage = 'Sign-in request cancelled. Please try again.';
            break;
          case 'auth/popup-blocked':
            errorMessage = 'Sign-in popup blocked by browser. Please allow popups.';
            break;
          case 'auth/account-exists-with-different-credential':
            errorMessage = 'An account already exists with the same email address but different sign-in credentials. Sign in using a provider associated with this email address.';
            break;
          case 'auth/operation-not-allowed':
            errorMessage = 'Facebook Sign-In is not enabled for this Firebase project. Check Firebase console.';
            break;
          case 'auth/network-request-failed':
            errorMessage = 'Network error. Check internet connection and try again.';
            break;
          default:
            errorMessage = e.message || 'Unknown error during Facebook Sign-In.';
        }
      } else if (e.message) {
        errorMessage = e.message;
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    setIsLoading(true);
    setError(null);
    if (!auth.currentUser) {
      setError("No user is currently signed in.");
      setIsLoading(false);
      return;
    }
    if (auth.currentUser.providerData.some(p => p.providerId !== 'password')) {
        setError("Password change is only available for email/password accounts.");
        setIsLoading(false);
        return;
    }

    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email!, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPassword);
      // Potentially logout user here for security or let them continue
      alert("Password updated successfully. You may need to log in again with your new password if issues arise."); 
    } catch (e: any) {
      console.error("Error changing password:", e);
      let errorMessage = "Failed to change password.";
      if (e.code) {
        switch (e.code) {
          case 'auth/wrong-password':
            errorMessage = "Incorrect current password.";
            break;
          case 'auth/weak-password':
            errorMessage = "The new password is too weak.";
            break;
          case 'auth/requires-recent-login':
            errorMessage = "This operation is sensitive and requires recent authentication. Please log out and log back in before trying again.";
            break;
          default:
            errorMessage = e.message || "An unknown error occurred.";
        }
      }
      setError(errorMessage);
      throw e; // Re-throw to allow UI to handle it
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteUserAccount = useCallback(async (currentPassword: string) => {
    setIsLoading(true);
    setError(null);
    if (!auth.currentUser) {
      setError("No user is currently signed in.");
      setIsLoading(false);
      return;
    }
     const userForDeletion = auth.currentUser; // Capture user before potential re-auth changes context

    try {
      // For email/password accounts, re-authentication is required for deletion.
      // For OAuth providers, this step might not be strictly necessary or might behave differently,
      // but it's good practice for sensitive operations if the user has an email/password link.
      if (userForDeletion.providerData.some(p => p.providerId === 'password')) {
        if (!userForDeletion.email) {
             setError("Cannot re-authenticate user without an email address.");
             setIsLoading(false);
             return;
        }
        const credential = EmailAuthProvider.credential(userForDeletion.email, currentPassword);
        await reauthenticateWithCredential(userForDeletion, credential);
      }
      
      // Delete user's Firestore document
      const userDocRef = doc(db, "users", userForDeletion.uid);
      await setDoc(userDocRef, {deletedAt: new Date()}, {merge: true}); // Soft delete or mark as deleted
      // Or for hard delete: await deleteDoc(userDocRef);

      // Delete the user from Firebase Authentication
      await deleteUser(userForDeletion);
      
      // onAuthStateChanged will handle clearing currentUser and navigating to /auth
      console.log("User account deleted successfully.");
      // No need to call setCurrentUser(null) or navigate here, onAuthStateChanged handles it.
    } catch (e: any) {
      console.error("Error deleting user account:", e);
      let errorMessage = "Failed to delete account.";
      if (e.code) {
        switch (e.code) {
          case 'auth/wrong-password':
            errorMessage = "Incorrect current password.";
            break;
          case 'auth/requires-recent-login':
            errorMessage = "This operation is sensitive and requires recent authentication. Please log out and log back in before trying again.";
            break;
          default:
            errorMessage = e.message || "An unknown error occurred during account deletion.";
        }
      }
      setError(errorMessage);
      throw e; // Re-throw to allow UI to handle it
    } finally {
      setIsLoading(false);
    }
  }, []);


  const logout = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signOut(auth); // Firebase sign out
      // onAuthStateChanged will handle clearing currentUser and localStorage
      console.log("Logout successful.");
      navigate('/auth');
    } catch (e: any) {
      console.error("Error during logout:", e);
      setError(e.message || 'Failed to logout.');
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  const updateUserProfile = useCallback(async (updatedProfileDataFragment: Partial<UserProfileData>) => {
    if (!currentUser) {
      setError("No user logged in to update profile.");
      return;
    }
    setIsLoading(true);
    setError(null);

    // Deep merge the fragment into the existing profile data
    const newProfileData: UserProfileData = {
        ...currentUser.profileData,
        ...updatedProfileDataFragment,
        demographics: {
            ...(currentUser.profileData.demographics || {}), // Ensure demographics object exists
            ...(updatedProfileDataFragment.demographics || {}),
        },
        politicalProfile: {
            ...(currentUser.profileData.politicalProfile || { keyIssues: [] }), // Ensure politicalProfile object exists
            ...(updatedProfileDataFragment.politicalProfile || {}),
            keyIssues: updatedProfileDataFragment.politicalProfile?.keyIssues !== undefined
                       ? updatedProfileDataFragment.politicalProfile.keyIssues
                       : (currentUser.profileData.politicalProfile?.keyIssues || []),
        },
        civicEngagement: {
            ...(currentUser.profileData.civicEngagement || { infoSources: [] }), // Ensure civicEngagement object exists
            ...(updatedProfileDataFragment.civicEngagement || {}),
            infoSources: updatedProfileDataFragment.civicEngagement?.infoSources !== undefined
                         ? updatedProfileDataFragment.civicEngagement.infoSources
                         : (currentUser.profileData.civicEngagement?.infoSources || []),
        }
    };
    if (typeof updatedProfileDataFragment.onboardingCompleted === 'boolean') {
        newProfileData.onboardingCompleted = updatedProfileDataFragment.onboardingCompleted;
    }

    try {
        const userDocRef = doc(db, "users", currentUser.id);
        await setDoc(userDocRef, newProfileData); // Save the complete profileData object to Firestore
        
        const updatedUser: User = {
            ...currentUser,
            profileData: newProfileData,
        };
        setCurrentUser(updatedUser); // Update local state
        console.log("User profile updated in Firestore and locally.");
    } catch (e: any) {
        console.error("Error updating user profile in Firestore:", e);
        setError(e.message || "Failed to update profile.");
    } finally {
        setIsLoading(false);
    }
  }, [currentUser, setCurrentUser, setIsLoading, setError]); // Dependencies for useCallback

  const completeOnboarding = useCallback(async () => {
    if (!currentUser) return;
    // The updateUserProfile now handles the merging correctly.
    await updateUserProfile({ onboardingCompleted: true });
  }, [currentUser, updateUserProfile]);

  const value = { 
    currentUser, 
    isLoading, 
    error, 
    login, 
    signup, 
    signInWithGoogle, 
    signInWithTwitter, 
    signInWithFacebook, // Added
    logout, 
    updateUserProfile, 
    completeOnboarding,
    changePassword, // Added
    deleteUserAccount // Added
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};