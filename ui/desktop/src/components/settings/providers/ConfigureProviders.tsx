import React from 'react';
import { ScrollArea } from '../../ui/scroll-area';
import BackButton from '../../ui/BackButton';
import { ProviderGrid } from './ProviderGrid';

export default function ConfigureProviders() {
  return (
    <div className="h-screen w-full pt-[36px]">
      <div className="h-full w-full bg-white dark:bg-gray-800 overflow-hidden p-2 pt-0">
        <ScrollArea className="h-full w-full">
          <div className="flex min-h-full">
            {/* Left Navigation */}
            <div className="w-48 border-r border-gray-100 dark:border-gray-700 px-2 pt-2">
              <div className="sticky top-8">
                <BackButton className="mb-4" />
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 px-16 py-8 pt-[20px]">
              <div className="max-w-6xl space-y-6">
                <h1 className="text-2xl font-semibold tracking-tight">Choose a Provider</h1>
                <ProviderGrid />
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
