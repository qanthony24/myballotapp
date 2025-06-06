import React, { createContext, useContext, useEffect, useState } from 'react';

export type UiDensity = 'normal' | 'compact';

interface SettingsContextType {
  uiDensity: UiDensity;
  setUiDensity: (density: UiDensity) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const UI_DENSITY_STORAGE_KEY = 'uiDensity';

export const SettingsProvider: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  const [uiDensity, setUiDensityState] = useState<UiDensity>('normal');

  useEffect(() => {
    try {
      const stored = localStorage.getItem(UI_DENSITY_STORAGE_KEY) as UiDensity | null;
      if (stored === 'compact' || stored === 'normal') {
        setUiDensityState(stored);
      }
    } catch (err) {
      console.error('Error reading uiDensity from localStorage', err);
    }
  }, []);

  const setUiDensity = (density: UiDensity) => {
    setUiDensityState(density);
    try {
      localStorage.setItem(UI_DENSITY_STORAGE_KEY, density);
    } catch (err) {
      console.error('Error saving uiDensity to localStorage', err);
    }
  };

  return (
    <SettingsContext.Provider value={{ uiDensity, setUiDensity }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
