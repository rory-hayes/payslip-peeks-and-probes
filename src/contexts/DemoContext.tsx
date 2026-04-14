import { createContext, useContext, useState, ReactNode } from 'react';

interface DemoContextType {
  isDemo: boolean;
  enableDemo: () => void;
  disableDemo: () => void;
}

const DemoContext = createContext<DemoContextType>({ isDemo: false, enableDemo: () => {}, disableDemo: () => {} });

export const useDemo = () => useContext(DemoContext);

export const DemoProvider = ({ children }: { children: ReactNode }) => {
  const [isDemo, setIsDemo] = useState(false);
  return (
    <DemoContext.Provider value={{ isDemo, enableDemo: () => setIsDemo(true), disableDemo: () => setIsDemo(false) }}>
      {children}
    </DemoContext.Provider>
  );
};
