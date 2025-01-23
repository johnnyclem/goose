import React from 'react';
import { Check, Plus } from 'lucide-react';
import { Button } from '../../ui/button';
import { supported_providers, required_keys, provider_aliases } from '../models/hardcoded_stuff';
import { useActiveKeys } from '../api_keys/ActiveKeysContext';
import { getProviderDescription } from './Provider';
import { ProviderSetupModal } from '../ProviderSetupModal';
import { useModel } from '../models/ModelContext';
import { useRecentModels } from '../models/RecentModels';
import { createSelectedModel } from '../models/utils';
import { getDefaultModel } from '../models/hardcoded_stuff';
import { initializeSystem } from '../../../utils/providerUtils';
import { getApiUrl, getSecretKey } from '../../../config';
import { toast } from 'react-toastify';
import { getActiveProviders } from '../api_keys/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../ui/Tooltip';

interface ProviderCardProps {
  name: string;
  description: string;
  isConfigured: boolean;
  onConfigure: () => void;
  onAddKeys: () => void;
  isSelected: boolean;
  onSelect: () => void;
}

function ProviderCard({
  name,
  description,
  isConfigured,
  onConfigure,
  onAddKeys,
  isSelected,
  onSelect,
}: ProviderCardProps) {
  return (
    <div
      onClick={() => isConfigured && onSelect()}
      className={`relative bg-white dark:bg-gray-800 rounded-lg border 
        ${
          isSelected
            ? 'border-blue-500 dark:border-blue-400 shadow-[0_0_0_1px] shadow-blue-500/50'
            : 'border-gray-200 dark:border-gray-700'
        } 
        p-3 transition-all duration-200 h-[140px] overflow-hidden
        ${isConfigured ? 'cursor-pointer hover:border-blue-400 dark:hover:border-blue-300' : ''}
      `}
    >
      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate mr-2">
            {name}
          </h3>
          {isConfigured && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center justify-center w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 shrink-0">
                    <Check className="h-3 w-3 text-green-600 dark:text-green-500" />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>You have a {name} API Key set in your environment</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-1.5 mb-3 leading-relaxed overflow-y-auto max-h-[48px] pr-1">
        {description}
      </p>

      <div className="absolute bottom-2 right-3">
        {!isConfigured && (
          <Button
            variant="default"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onAddKeys();
            }}
            className="rounded-full h-7 px-3 min-w-[90px] bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 text-xs"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Keys
          </Button>
        )}
      </div>
    </div>
  );
}

export function ProviderGrid() {
  const { activeKeys, setActiveKeys } = useActiveKeys();
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [showSetupModal, setShowSetupModal] = React.useState(false);
  const { switchModel } = useModel();
  const { addRecentModel } = useRecentModels();

  const providers = React.useMemo(() => {
    return supported_providers.map((providerName) => {
      const alias =
        provider_aliases.find((p) => p.provider === providerName)?.alias ||
        providerName.toLowerCase();
      const isConfigured = activeKeys.includes(providerName);

      return {
        id: alias,
        name: providerName,
        isConfigured,
        description: getProviderDescription(providerName),
      };
    });
  }, [activeKeys]);

  const handleConfigure = async (provider) => {
    const providerId = provider.id.toLowerCase();
    await initializeSystem(providerId, null);

    const modelName = getDefaultModel(providerId);
    const model = createSelectedModel(providerId, modelName);

    switchModel(model);
    addRecentModel(model);
    localStorage.setItem('GOOSE_PROVIDER', providerId);

    toast.success(`Switched to ${provider.name} provider`);
  };

  const handleAddKeys = (provider) => {
    setSelectedId(provider.id);
    setShowSetupModal(true);
  };

  const handleModalSubmit = async (apiKey: string) => {
    if (!selectedId) return;

    const provider = providers.find((p) => p.id === selectedId)?.name;
    const keyName = required_keys[provider]?.[0];

    if (!keyName) {
      console.error(`No key found for provider ${provider}`);
      return;
    }

    try {
      if (selectedId && providers.find((p) => p.id === selectedId)?.isConfigured) {
        const deleteResponse = await fetch(getApiUrl('/secrets/delete'), {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'X-Secret-Key': getSecretKey(),
          },
          body: JSON.stringify({ key: keyName }),
        });

        if (!deleteResponse.ok) {
          const errorText = await deleteResponse.text();
          console.error('Delete response error:', errorText);
          throw new Error('Failed to delete old key');
        }
      }

      const storeResponse = await fetch(getApiUrl('/secrets/store'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Secret-Key': getSecretKey(),
        },
        body: JSON.stringify({
          key: keyName,
          value: apiKey.trim(),
        }),
      });

      if (!storeResponse.ok) {
        const errorText = await storeResponse.text();
        console.error('Store response error:', errorText);
        throw new Error('Failed to store new key');
      }

      const isUpdate = selectedId && providers.find((p) => p.id === selectedId)?.isConfigured;
      toast.success(
        isUpdate
          ? `Successfully updated API key for ${provider}`
          : `Successfully added API key for ${provider}`
      );

      const updatedKeys = await getActiveProviders();
      setActiveKeys(updatedKeys);

      setShowSetupModal(false);
      setSelectedId(null);
    } catch (error) {
      console.error('Error handling modal submit:', error);
      toast.error(
        `Failed to ${selectedId && providers.find((p) => p.id === selectedId)?.isConfigured ? 'update' : 'add'} API key for ${provider}`
      );
    }
  };

  const handleSelect = (providerId: string) => {
    setSelectedId(selectedId === providerId ? null : providerId);
  };

  // Add useEffect for Esc key handling
  React.useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, []);

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto">
      <div className="h-[52px]">
        {selectedId && (
          <div className="flex justify-end">
            <Button
              variant="default"
              size="default"
              onClick={() => {
                const provider = providers.find((p) => p.id === selectedId);
                if (provider) handleConfigure(provider);
              }}
              className="rounded-full px-6 py-2 min-w-[160px] bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white dark:text-white text-sm font-medium shadow-md hover:shadow-lg transition-all"
            >
              Select {providers.find((p) => p.id === selectedId)?.name}
            </Button>
          </div>
        )}
      </div>

      <div className="text-sm text-gray-500 dark:text-gray-400">
        Configure your AI model providers by adding their API keys. Your keys are stored securely
        and encrypted locally. You can change your provider and select specific models in the
        settings.
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3 auto-rows-fr max-w-full">
        {providers.map((provider) => (
          <ProviderCard
            key={provider.id}
            name={provider.name}
            description={provider.description}
            isConfigured={provider.isConfigured}
            isSelected={selectedId === provider.id}
            onSelect={() => handleSelect(provider.id)}
            onConfigure={() => handleConfigure(provider)}
            onAddKeys={() => handleAddKeys(provider)}
          />
        ))}
      </div>

      {showSetupModal && selectedId && (
        <ProviderSetupModal
          provider={providers.find((p) => p.id === selectedId)?.name}
          model="Example Model"
          endpoint="Example Endpoint"
          onSubmit={handleModalSubmit}
          onCancel={() => {
            setShowSetupModal(false);
            setSelectedId(null);
          }}
        />
      )}
    </div>
  );
}
