import * as React from 'react';
import { cn } from '../utils';

interface AutoScrollProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  children?: React.ReactNode;
  behavior?: ScrollBehavior;
}

export interface AutoScrollHandle {
  scrollToBottom: (behavior?: ScrollBehavior) => void;
}

const AutoScroll = React.forwardRef<AutoScrollHandle, AutoScrollProps>(
  ({ className, children, behavior = 'smooth', ...props }, ref) => {
    const messagesEndRef = React.useRef<HTMLDivElement>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);

    const scrollToBottom = React.useCallback((scrollBehavior: ScrollBehavior = behavior) => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({
          behavior: scrollBehavior,
          block: 'end',
          inline: 'nearest',
        });
      }
    }, [behavior]);

    // Expose the scrollToBottom method to parent components
    React.useImperativeHandle(ref, () => ({
      scrollToBottom
    }));

    React.useEffect(() => {
      if (containerRef.current) {
        const { scrollHeight, scrollTop, clientHeight } = containerRef.current;
        const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
        const nearBottom = distanceFromBottom <= 300;
        if (nearBottom) {
          scrollToBottom();
        }
      } else {
        // Fallback if container is not available
        scrollToBottom();
      }
    }, [children, scrollToBottom]);

    return (
      <div
        ref={containerRef}
        className={cn(
          'relative overflow-auto',
          '[&::-webkit-scrollbar]{display:none}',
          '[&::-webkit-scrollbar-thumb]{display:none}',
          '[&::-webkit-scrollbar-track]{display:none}',
          'scrollbar-none',
          'scrollbar-width-none',
          '-ms-overflow-style:none',
          '[scrollbar-width:none]',
          className
        )}
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
        {...props}
      >
        {children}
        <div ref={messagesEndRef} style={{ height: '1px' }} />
      </div>
    );
  }
);

AutoScroll.displayName = 'AutoScroll';

export default AutoScroll;
