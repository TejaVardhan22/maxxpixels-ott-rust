'use client';

import React, { useEffect, useState } from 'react';

interface Props {
  userText?: string;
}

export const SecurityWatermark: React.FC<Props> = ({ userText }) => {
  const [position, setPosition] = useState({ top: 15, left: 15 });
  const [displayText, setDisplayText] = useState('');

  useEffect(() => {
    // Generate fallback user identifier if userText not provided
    const identifier = userText || `ID: ${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    const timestamp = new Date().toLocaleTimeString();
    setDisplayText(`${identifier} • ${timestamp}`);

    // Slowly shift watermark position every 10 seconds to avoid burn-in and deter cropping
    const interval = setInterval(() => {
      const randomTop = Math.floor(Math.random() * 70) + 10; // 10% to 80%
      const randomLeft = Math.floor(Math.random() * 70) + 10; // 10% to 80%
      setPosition({ top: randomTop, left: randomLeft });
    }, 10000);

    return () => clearInterval(interval);
  }, [userText]);

  return (
    <div
      className="pointer-events-none absolute z-30 select-none font-mono text-xs font-semibold text-white/20 tracking-wider transition-all duration-1000 ease-in-out drop-shadow-md"
      style={{
        top: `${position.top}%`,
        left: `${position.left}%`,
      }}
    >
      {displayText}
    </div>
  );
};
