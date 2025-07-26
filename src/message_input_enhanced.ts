import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Send, Loader, Sparkles, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface MessageInputProps {
  input: string;
  setInput: (value: string) => void;
  isLoading: boolean;
  sendMessage: () => void;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  suggestedAnswer: string | null;
  onUseSuggestion: () => void;
}

// Debounce hook for performance
const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

const MessageInput: React.FC<MessageInputProps> = ({
  input,
  setInput,
  isLoading,
  sendMessage,
  inputRef,
  suggestedAnswer,
  onUseSuggestion
}) => {
  const [isUsingDemo, setIsUsingDemo] = useState(false);
  const [lastSubmitTime, setLastSubmitTime] = useState(0);
  const [inputError, setInputError] = useState<string | null>(null);
  const debouncedInput = useDebounce(input, 300);

  // Rate limiting and validation
  const isValidInput = useMemo(() => {
    const trimmed = input.trim();
    return trimmed.length >= 3 && trimmed.length <= 5000;
  }, [input]);

  const canSubmit = useMemo(() => {
    return !isLoading && 
           !isUsingDemo && 
           isValidInput && 
           Date.now() - lastSubmitTime > 1000; // 1 second rate limit
  }, [isLoading, isUsingDemo, isValidInput, lastSubmitTime]);

  // Enhanced input validation with real-time feedback
  useEffect(() => {
    const trimmed = debouncedInput.trim();
    if (trimmed.length > 0) {
      if (trimmed.length < 3) {
        setInputError('Response too brief (minimum 3 characters)');
      } else if (trimmed.length > 5000) {
        setInputError('Response too long (maximum 5000 characters)');
      } else {
        setInputError(null);
      }
    } else {
      setInputError(null);
    }
  }, [debouncedInput]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSubmit) {
        handleSendMessage();
      }
    }
  }, [canSubmit]);

  const handleSendMessage = useCallback(() => {
    if (!canSubmit) return;
    
    setLastSubmitTime(Date.now());
    sendMessage();
  }, [canSubmit, sendMessage]);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    
    // Prevent extremely long input during typing
    if (value.length > 6000) return;
    
    const textarea = e.target;
    textarea.style.height = 'inherit';
    const computedHeight = Math.min(textarea.scrollHeight, 200);
    textarea.style.height = `${Math.max(56, computedHeight)}px`;
    setInput(value);
  }, [setInput]);

  // Enhanced demo answer usage with better UX
  const handleUseSuggestion = useCallback(async () => {
    if (!suggestedAnswer || isUsingDemo || isLoading) return;
    
    setIsUsingDemo(true);
    
    try {
      // Expand textarea if needed
      if (inputRef.current) {
        const requiredHeight = Math.min(
          Math.ceil(suggestedAnswer.length / 80) * 20 + 56,
          200
        );
        inputRef.current.style.height = `${requiredHeight}px`;
      }
      
      // Small delay for better UX
      await new Promise(resolve => setTimeout(resolve, 300));
      
      setInput(suggestedAnswer);
      onUseSuggestion();
      
      // Focus and position cursor
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(suggestedAnswer.length, suggestedAnswer.length);
      }
      
    } catch (error) {
      console.error('Error using demo answer:', error);
    } finally {
      setTimeout(() => setIsUsingDemo(false), 500);
    }
  }, [suggestedAnswer, isUsingDemo, isLoading, inputRef, setInput, onUseSuggestion]);

  // Auto-resize on input clear
  useEffect(() => {
    if (!input && inputRef.current && !isUsingDemo) {
      inputRef.current.style.height = '56px';
    }
  }, [input, isUsingDemo]);

  // Focus management
  useEffect(() => {
    if (!isUsingDemo && !isLoading && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isUsingDemo, isLoading]);

  const getInputBorderColor = () => {
    if (inputError) return 'border-red-300 focus:border-red-500 focus:ring-red-200';
    if (isUsingDemo) return 'border-goldenrod ring-2 ring-goldenrod/20';
    if (input.trim() && isValidInput) return 'border-green-300 focus:border-green-500 focus:ring-green-200';
    return 'border-neutral-gray/30 focus:border-goldenrod focus:ring-goldenrod/20';
  };

  return (
    <footer className="bg-white border-t border-neutral-gray">
      <div className="max-w-4xl mx-auto">
        {/* Streamlined Demo Answer Section */}
        <AnimatePresence>
          {suggestedAnswer && !isUsingDemo && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="border-b border-neutral-gray/20"
            >
              <div className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-goldenrod" />
                    <span className="text-sm font-medium text-dark-gray">
                      Demo Answer Available
                    </span>
                    <span className="text-xs bg-goldenrod text-white px-2 py-0.5 rounded-full">
                      Try It!
                    </span>
                  </div>
                  
                  <motion.button
                    onClick={handleUseSuggestion}
                    disabled={isLoading || isUsingDemo}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-desert-sand to-champagne hover:from-champagne hover:to-goldenrod text-dark-gray font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {isUsingDemo ? (
                      <>
                        <Loader className="h-3 w-3 animate-spin" />
                        <span>Loading...</span>
                      </>
                    ) : (
                      <>
                        <Check className="h-3 w-3" />
                        <span>Use Demo Answer</span>
                      </>
                    )}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Enhanced Input Section */}
        <div className="p-4">
          <motion.div 
            className="flex items-end gap-3"
            animate={{ scale: isUsingDemo ? 1.01 : 1 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex-grow relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInput}
                onKeyPress={handleKeyPress}
                className={`w-full p-4 border-2 rounded-lg focus:outline-none resize-none min-h-[56px] max-h-[200px] transition-all duration-200 ${getInputBorderColor()}`}
                placeholder={suggestedAnswer 
                  ? "Type your own answer or use the demo answer above..." 
                  : "Type your message..."
                }
                disabled={isLoading || isUsingDemo}
                rows={1}
                maxLength={6000}
              />
              
              {/* Character count for long responses */}
              {input.length > 100 && (
                <div className="absolute bottom-2 right-2 text-xs text-neutral-gray bg-white/80 px-1 rounded">
                  {input.length}/5000
                </div>
              )}
            </div>
            
            {/* Enhanced Submit Button */}
            <motion.button
              onClick={handleSendMessage}
              disabled={!canSubmit}
              className={`h-[56px] w-[56px] flex items-center justify-center rounded-lg transition-all duration-200 flex-shrink-0 ${
                canSubmit 
                  ? 'bg-black text-white hover:bg-dark-gray' 
                  : 'bg-neutral-gray text-white cursor-not-allowed'
              }`}
              whileHover={canSubmit ? { scale: 1.05 } : {}}
              whileTap={canSubmit ? { scale: 0.95 } : {}}
            >
              {isLoading || isUsingDemo ? (
                <Loader className="animate-spin h-5 w-5" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </motion.button>
          </motion.div>
          
          {/* Enhanced Status Messages */}
          <AnimatePresence mode="wait">
            {inputError && (
              <motion.p 
                key="error"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-xs text-red-500 mt-2 flex items-center gap-1"
              >
                ⚠️ {inputError}
              </motion.p>
            )}
            
            {!inputError && isUsingDemo && (
              <motion.p
                key="demo-loading"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-xs text-goldenrod mt-2 font-medium"
              >
                ✨ Loading demo answer...
              </motion.p>
            )}
            
            {!inputError && !isUsingDemo && input.trim() && isValidInput && (
              <motion.p
                key="ready"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-xs text-neutral-gray mt-2"
              >
                Press Enter or click Send to continue
              </motion.p>
            )}
            
            {!inputError && suggestedAnswer && !isUsingDemo && !input.trim() && (
              <motion.p 
                key="demo-hint"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-xs text-neutral-gray mt-2"
              >
                💡 New to brand development? Try the demo answer for realistic results!
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </footer>
  );
};

export default React.memo(MessageInput);