import React from 'react';
import { ProviderGrid } from './ProviderGrid';
import { ScrollArea } from '../ui/scroll-area';

// Extending React CSSProperties to include custom webkit property
declare module 'react' {
  interface CSSProperties {
    WebkitAppRegion?: string; // Now TypeScript knows about WebkitAppRegion
  }
}

interface WelcomeScreenProps {
  onSubmit?: () => void;
}

export function WelcomeScreen({ onSubmit }: WelcomeScreenProps) {
  return (
    <div className="h-screen w-full select-none bg-bgSubtle">
      {/* Draggable title bar region */}
      <div className="h-[36px] w-full bg-surface/50" style={{ WebkitAppRegion: 'drag' }} />

      {/* Content area - explicitly set as non-draggable */}
      <div
        className="h-[calc(100vh-36px)] w-full bg-surface dark:bg-surface-dark overflow-hidden p-4"
        style={{ WebkitAppRegion: 'no-drag' }}
      >
        <ScrollArea className="h-full w-full">
          <div className="flex min-h-full">
            {/* Content Area */}
            <div className="flex-1 px-16 py-8 pt-[20px]">
              <div className="max-w-3xl space-y-12">
                {/* Header Section */}
                <div className="flex items-center gap-4 mb-8">
                  <h1 className="text-2xl font-semibold text-textStandard tracking-tight">
                    Choose a Provider
                  </h1>
                </div>
                {/* ProviderGrid */}
                <ProviderGrid onSubmit={onSubmit} />
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
