import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface DemoContextType {
  isDemoMode: boolean;
  enableDemo: () => void;
  disableDemo: () => void;
}

const DemoContext = createContext<DemoContextType>({
  isDemoMode: false,
  enableDemo: () => {},
  disableDemo: () => {},
});

export const useDemoMode = () => useContext(DemoContext);

export const DemoProvider = ({ children }: { children: ReactNode }) => {
  const [isDemoMode, setIsDemoMode] = useState(false);

  const enableDemo = useCallback(() => setIsDemoMode(true), []);
  const disableDemo = useCallback(() => setIsDemoMode(false), []);

  return (
    <DemoContext.Provider value={{ isDemoMode, enableDemo, disableDemo }}>
      {children}
    </DemoContext.Provider>
  );
};
