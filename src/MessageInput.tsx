import React, { useEffect } from 'react';
import { Send, Loader, Sparkles, ArrowRight } from 'lucide-react';

interface MessageInputProps {
  input: string;
  setInput: (value: string) => void;
  isLoading: boolean;
  sendMessage: () => void;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  suggestedAnswer: string | null;
  onUseSuggestion: () => void;
}

const MessageInput: React.FC<MessageInputProps> = ({
  input,
  setInput,
  isLoading,
  sendMessage,
  inputRef,
  suggestedAnswer,
  onUseSuggestion
}) => {
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && input.trim()) {
        sendMessage();
      }
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target;
    textarea.style.height = 'inherit';
    const computedHeight = Math.min(textarea.scrollHeight, 200); // Maximum height
    textarea.style.height = `${Math.max(48, computedHeight)}px`; // Minimum height of 48px
    setInput(e.target.value);
  };

  const handleUseSuggestion = () => {
    if (suggestedAnswer) {
      setInput(suggestedAnswer);
      onUseSuggestion();
      // Auto-submit after a brief delay to allow user to see the text being filled
      setTimeout(() => {
        if (!isLoading) {
          sendMessage();
        }
      }, 500);
    }
  };

  // Add a useEffect to reset height when input is cleared
  useEffect(() => {
    if (!input && inputRef.current) {
      inputRef.current.style.height = '48px';
    }
  }, [input]);

  return (
    <footer className="bg-white border-t border-neutral-gray">
      <div className="max-w-4xl mx-auto">
        {/* Enhanced Suggested Answer Section */}
        {suggestedAnswer && (
          <div className="p-4 pb-2">
            <div className="bg-gradient-to-r from-desert-sand/20 to-champagne/20 border border-desert-sand rounded-lg p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 p-2 bg-desert-sand rounded-full">
                  <Sparkles className="h-4 w-4 text-dark-gray" />
                </div>
                <div className="flex-grow min-w-0">
                  <h4 className="font-semibold text-dark-gray mb-2 flex items-center gap-2">
                    Demo Answer Available
                    <span className="text-xs bg-goldenrod text-white px-2 py-1 rounded-full">
                      Try It!
                    </span>
                  </h4>
                  <p className="text-sm text-dark-gray/80 mb-3 line-clamp-3">
                    {suggestedAnswer.length > 150 
                      ? `${suggestedAnswer.substring(0, 150)}...` 
                      : suggestedAnswer
                    }
                  </p>
                  <button
                    onClick={handleUseSuggestion}
                    disabled={isLoading}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-desert-sand hover:bg-champagne text-dark-gray font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
                  >
                    <span>Use Demo Answer</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Input Section */}
        <div className="p-4">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInput}
              onKeyPress={handleKeyPress}
              className="flex-grow p-3 border border-neutral-gray rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-gray resize-none min-h-[48px] max-h-[200px] transition-all duration-200"
              placeholder={suggestedAnswer 
                ? "Type your own answer or use the demo answer above..." 
                : "Type your message..."
              }
              disabled={isLoading}
              rows={1}
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              className="bg-black text-white p-3 rounded-lg hover:bg-dark-gray transition-colors duration-200 disabled:bg-neutral-gray disabled:cursor-not-allowed h-[48px] w-[48px] flex items-center justify-center"
            >
              {isLoading ? (
                <Loader className="animate-spin h-5 w-5" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </button>
          </div>
          
          {/* Demo guidance text */}
          {/* {suggestedAnswer && (
            <p className="text-xs text-neutral-gray mt-2 text-center">
              💡 New to brand development? Try the demo answer for realistic results!
            </p>
          )} */}
        </div>
      </div>
    </footer>
  );
};

export default MessageInput;