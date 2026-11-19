'use client';

import React from 'react';

interface Props {
  children: React.ReactNode;
}

export const ScreenSecurityGuard: React.FC<Props> = ({ children }) => {
  return (
    <div className="relative min-h-screen">
      {children}
    </div>
  );
};
