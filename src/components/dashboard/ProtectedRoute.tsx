import React from 'react';

// This component is no longer needed since admin check is done in App.tsx
// Keeping for backwards compatibility
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

export default ProtectedRoute;
