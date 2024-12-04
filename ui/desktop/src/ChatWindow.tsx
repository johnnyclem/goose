import React, {useEffect, useRef, useState} from 'react';
import {Message,useChat} from './ai-sdk-fork/useChat';
import {Navigate, Route, Routes} from 'react-router-dom';
import {getApiUrl} from './config';
import {Card} from './components/ui/card';
import {ScrollArea} from './components/ui/scroll-area';
import Splash from './components/Splash';
import GooseMessage from './components/GooseMessage';
import UserMessage from './components/UserMessage';
import Input from './components/Input';
import MoreMenu from './components/MoreMenu';
import {Bird} from './components/ui/icons';
import LoadingGoose from './components/LoadingGoose';
import {ApiKeyWarning} from './components/ApiKeyWarning';

import { askAi, getPromptTemplates } from './utils/askAI';
import WingToWing, { Working } from './components/WingToWing';


function ChatContent({
  initialQuery,
  setProgressMessage,
  setWorking,
}: {
  initialQuery: string | null;
  setProgressMessage: React.Dispatch<React.SetStateAction<string>>;
  setWorking: React.Dispatch<React.SetStateAction<Working>>;
}) {
  const [messageMetadata, setMessageMetadata] = useState<Record<string, string[]>>({});
  const [initialMessages, setInitialMessages] = useState<Message[]>([]); // Replace `any` with actual message type.


  useEffect(() => {
    async function fetchSession() {
      const sessionId = window.appConfig.get("GOOSE_SESSION_ID");
      if (sessionId) {
        window.electron.logInfo('We have a session ID: ' + sessionId);
        try {
          const session = await getSession(sessionId);
          window.electron.logInfo('Session: ' + session);

          // Populate initialMessages based on session data
          const sessionMessages = session ? session.messages || [] : [];
          window.electron.logInfo("we have session: " + JSON.stringify(sessionMessages, null, 2));
          setInitialMessages(sessionMessages);
        } catch (error) {
          window.electron.logError('Error fetching session: ' + error);
        }
      }
    }

    fetchSession();
  }, []);

  const {
    messages,
    append,
    stop,
    isLoading,
    error,
    setMessages,
  } = useChat({
    api: getApiUrl('/reply'),
    initialMessages,
    onToolCall: ({ toolCall }) => {
      setWorking(Working.Working);
      setProgressMessage(`Executing tool: ${toolCall.toolName}`);
    },
    onResponse: (response) => {
      if (!response.ok) {
        setProgressMessage('An error occurred while receiving the response.');
        setWorking(Working.Idle);
      } else {
        setProgressMessage('thinking...');
        setWorking(Working.Working);
      }
    },
    onFinish: async (message, options) => {
      setProgressMessage('Task finished. Click here to expand.');
      setWorking(Working.Idle);

      const promptTemplates = getPromptTemplates(message.content);
      const fetchResponses = await askAi(promptTemplates);
      setMessageMetadata((prev) => ({ ...prev, [message.id]: fetchResponses }));
    },
  });

  // Update chat messages when they change
  useEffect(() => {    
      const sessionToSave = {
        messages: messages,
        directory: window.appConfig.get("GOOSE_WORKING_DIR")
      };
      saveSession(sessionToSave);
  
  }, [messages]);

  // Function to save a session
  const saveSession = (session) => {
    if(session.messages === undefined || session.messages.length === 0) return
    window.electron.saveSession(session);
  };


  const initialQueryAppended = useRef(false);
  useEffect(() => {
    if (initialQuery && !initialQueryAppended.current) {
      append({ role: 'user', content: initialQuery });
      initialQueryAppended.current = true;
    }
  }, [initialQuery]);

  const handleSubmit = (e: React.FormEvent) => {
    const customEvent = e as CustomEvent;
    const content = customEvent.detail?.value || '';
    if (content.trim()) {
      append({
        role: 'user',
        content: content,
      });
    }
  };

  if (error) {
    console.log('Error:', error);
  }

  const onStopGoose = () => {
    stop();

    const lastMessage: Message = messages[messages.length - 1];
    if (lastMessage.role === 'user' && lastMessage.toolInvocations === undefined) {
      // TODO: Using setInput seems to change the ongoing request message and prevents stop from stopping.
      // It would be nice to find a way to populate the input field with the last message when interrupted.
      // setInput("stop");

      // Remove the last user message.
      if (messages.length > 1) {
        setMessages(messages.slice(0, -1));
      } else {
        setMessages([]);
      }
    } else if (lastMessage.role === 'assistant' && lastMessage.toolInvocations !== undefined) {
      // Add messaging about interrupted ongoing tool invocations.
      const newLastMessage: Message = {
          ...lastMessage,
          toolInvocations: lastMessage.toolInvocations.map((invocation) => {
            if (invocation.state !== 'result') {
              return {
                ...invocation,
                result: [
                  {
                    "audience": [
                      "user"
                    ],
                    "text": "Interrupted.\n",
                    "type": "text"
                  },
                  {
                    "audience": [
                      "assistant"
                    ],
                    "text": "Interrupted by the user to make a correction.\n",
                    "type": "text"
                  }
                ],
                state: 'result',
              };
          } else {
            return invocation;
          }
        }),
      };

      const updatedMessages = [...messages.slice(0, -1), newLastMessage];
      setMessages(updatedMessages);
    }

  };

  return (
    <div className="chat-content flex flex-col w-screen h-screen bg-window-gradient items-center justify-center p-[10px]">
      <div className="relative block h-[20px] w-screen">
        <div className="text-center text-splash-pills-text">
          {window.appConfig.get("GOOSE_WORKING_DIR")}
        </div>
        <MoreMenu />
      </div>
      <Card className="flex flex-col flex-1 h-[calc(100vh-95px)] w-full bg-card-gradient mt-0 border-none shadow-xl rounded-2xl relative">
        {messages.length === 0 ? (
          <Splash append={append} />
        ) : (
          <ScrollArea className="flex-1 px-[10px]" id="chat-scroll-area">
            <div className="block h-10" />
            <div ref={(el) => {
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'end' });
              }
            }}>
              {messages.map((message) => (
                <div key={message.id}>
                  {message.role === 'user' ? (
                    <UserMessage message={message} />
                  ) : (
                    <GooseMessage
                      message={message}
                      messages={messages}
                      metadata={messageMetadata[message.id]}
                      append={append}
                    />
                  )}
                </div>
              ))}
            </div>
            {isLoading && (
              <div className="flex items-center justify-center p-4">
                <LoadingGoose />
              </div>
            )}
            {error && (
              <div className="flex items-center justify-center p-4">
                <div className="text-red-500 bg-red-100 p-3 rounded-lg">
                  {error.message || 'An error occurred while processing your request'}
                </div>
              </div>
            )}
            <div className="block h-10" />
          </ScrollArea>
        )}

        <Input
          handleSubmit={handleSubmit}
          disabled={isLoading}
          isLoading={isLoading}
          onStop={onStopGoose}
        />
      </Card>
    </div>
  );
}

export default function ChatWindow() {

  // Add keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Command+N (Mac) or Control+N (Windows/Linux)
      if ((event.metaKey || event.ctrlKey) && event.key === 'n') {
        event.preventDefault(); // Prevent default browser behavior
        window.electron.createChatWindow();
      }
    };

    // Add event listener
    window.addEventListener('keydown', handleKeyDown);

    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Check if API key is missing from the window arguments
  const apiCredsMissing = window.electron.getConfig().apiCredsMissing;

  // Get initial query and history from URL parameters
  const searchParams = new URLSearchParams(window.location.search);
  const initialQuery = searchParams.get('initialQuery');
  const historyParam = searchParams.get('history');
  const initialHistory = historyParam ? JSON.parse(decodeURIComponent(historyParam)) : [];

  const [selectedChatId, setSelectedChatId] = useState(1);
  const [mode, setMode] = useState<'expanded' | 'compact'>(
    initialQuery ? 'compact' : 'expanded'
  );
  const [working, setWorking] = useState<Working>(Working.Idle);
  const [progressMessage, setProgressMessage] = useState<string>('');

  const toggleMode = () => {
    const newMode = mode === 'expanded' ? 'compact' : 'expanded';
    console.log(`Toggle to ${newMode}`);
    setMode(newMode);
  };

  window.electron.logInfo('ChatWindow loaded');

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-transparent flex flex-col">
      <div className="titlebar-drag-region" />
      {apiCredsMissing ? (
        <div className="w-full h-full">
          <ApiKeyWarning className="w-full h-full" />
        </div>
      ) : (
        <>
          <div style={{ display: mode === 'expanded' ? 'block' : 'none' }}>
            <Routes>
              <Route
                path="/chat/:id"
                element={
                  <ChatContent
                    initialQuery={initialQuery}
                    setProgressMessage={setProgressMessage}
                    setWorking={setWorking}
                  />
                }
              />
              <Route path="*" element={<Navigate to="/chat/1" replace />} />
            </Routes>
          </div>

          <WingToWing onExpand={toggleMode} progressMessage={progressMessage} working={working} />

        </>
      )}
    </div>
  );
}


const getSession =  async (sessionId) => {
  try {
    const session = await window.electron.getSession(sessionId);
    window.electron.logInfo('GUI Session loading '); // + JSON.stringify(session, null,2));
    console.log('XSession loaded:', session);
    return  session
  } catch (error) {
    console.error('Failed to load session:', error);
  }
};

