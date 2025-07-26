import React, { useEffect, useState, useRef } from 'react';
import { Send, Loader, ArrowRight, Edit3 } from 'lucide-react';
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

const MessageInput: React.FC<MessageInputProps> = ({
  input,
  setInput,
  isLoading,
  sendMessage,
  inputRef,
  suggestedAnswer,
  onUseSuggestion
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [fillStage, setFillStage] = useState<'idle' | 'expanding' | 'filling' | 'ready'>('idle');
  const [justUsedDemo, setJustUsedDemo] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && input.trim() && !isAnimating) {
        sendMessage();
        setJustUsedDemo(false); // Reset demo state after sending
      }
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (isAnimating) return; // Prevent input during animation
    
    const textarea = e.target;
    textarea.style.height = 'inherit';
    const computedHeight = Math.min(textarea.scrollHeight, 200);
    textarea.style.height = `${Math.max(56, computedHeight)}px`; // Increased min height for better alignment
    setInput(e.target.value);
    
    // Clear demo state when user manually types
    if (justUsedDemo && e.target.value !== suggestedAnswer) {
      setJustUsedDemo(false);
    }
  };

  // FIXED: Enhanced demo answer usage - fills text but doesn't auto-submit
  const handleUseSuggestion = async () => {
    if (!suggestedAnswer || isAnimating) return;
    
    setIsAnimating(true);
    setFillStage('expanding');
    
    // Stage 1: Expand the input to accommodate the demo text
    if (inputRef.current) {
      const requiredHeight = Math.min(
        Math.ceil(suggestedAnswer.length / 80) * 20 + 56, // Increased base height
        200
      );
      
      inputRef.current.style.height = `${requiredHeight}px`;
      setIsExpanded(true);
    }
    
    // Wait for expansion animation
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Stage 2: Fill the input with demo text
    setFillStage('filling');
    setInput(suggestedAnswer);
    onUseSuggestion();
    
    // Wait to show the filled text
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Stage 3: Ready for user review/editing
    setFillStage('ready');
    setJustUsedDemo(true);
    await new Promise(resolve => setTimeout(resolve, 400));
    
    // Reset animation state but keep demo state
    setIsAnimating(false);
    setFillStage('idle');
    
    // Focus the input for potential editing
    if (inputRef.current) {
      inputRef.current.focus();
      // Place cursor at end of text
      inputRef.current.setSelectionRange(suggestedAnswer.length, suggestedAnswer.length);
    }
  };

  // Reset height when input is cleared
  useEffect(() => {
    if (!input && inputRef.current && !isAnimating) {
      inputRef.current.style.height = '56px'; // Increased base height
      setIsExpanded(false);
      setJustUsedDemo(false);
    }
  }, [input, isAnimating]);

  // Focus management
  useEffect(() => {
    if (!isAnimating && !isLoading && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAnimating, isLoading]);

  return (
    <footer className="bg-white border-t border-neutral-gray">
      <div className="max-w-4xl mx-auto">
        {/* Enhanced Demo Answer Section */}
        <AnimatePresence>
          {suggestedAnswer && !isAnimating && !justUsedDemo && (
            <motion.div 
              initial={{ opacity: 0, height: 0, y: -20 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={{ opacity: 0, height: 0, y: -20 }}
              transition={{ 
                duration: 0.3, 
                ease: "easeOut",
                height: { duration: 0.4 }
              }}
              className="overflow-hidden"
            >
              <div className="p-4 pb-2">
                <motion.div 
                  className="bg-gradient-to-r from-desert-sand/20 to-champagne/20 border border-desert-sand/50 rounded-lg shadow-sm hover:shadow-md transition-all duration-200"
                  whileHover={{ scale: 1.005 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-shrink-0 p-1.5 bg-desert-sand/30 rounded-full">
                          <ArrowRight className="h-3 w-3 text-dark-gray" />
                        </div>
                        <h4 className="font-semibold text-dark-gray text-sm">
                          Demo Answer Available
                        </h4>
                        <span className="text-xs bg-goldenrod text-white px-2 py-0.5 rounded-full font-medium">
                          Try It!
                        </span>
                      </div>
                    </div>
                    
                    {/* Expandable preview text */}
                    <div className="mb-3">
                      <motion.div
                        className={`text-sm text-dark-gray/80 leading-relaxed ${
                          isExpanded ? '' : 'line-clamp-2'
                        }`}
                        layout
                      >
                        {suggestedAnswer}
                      </motion.div>
                      
                      {suggestedAnswer.length > 150 && (
                        <button
                          onClick={() => setIsExpanded(!isExpanded)}
                          className="text-xs text-goldenrod hover:text-champagne mt-1 font-medium"
                        >
                          {isExpanded ? 'Show less' : 'Show more'}
                        </button>
                      )}
                    </div>
                    
                    <motion.button
                      onClick={handleUseSuggestion}
                      disabled={isLoading || isAnimating}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-desert-sand hover:bg-champagne text-dark-gray font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed group"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <span>Use Demo Answer</span>
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </motion.button>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input Section with fixed alignment */}
        <div className="p-4" ref={containerRef}>
          <motion.div 
            className="flex items-end gap-3" // Increased gap and use items-end for bottom alignment
            animate={{ 
              scale: isAnimating ? 1.02 : 1,
            }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex-grow relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInput}
                onKeyPress={handleKeyPress}
                className={`w-full p-4 border-2 rounded-lg focus:outline-none resize-none min-h-[56px] max-h-[200px] transition-all duration-300 ${
                  isAnimating 
                    ? 'border-goldenrod ring-2 ring-goldenrod/20' 
                    : justUsedDemo
                    ? 'border-desert-sand ring-2 ring-desert-sand/20'
                    : 'border-neutral-gray focus:border-dark-gray focus:ring-2 focus:ring-dark-gray/20'
                } ${
                  fillStage === 'filling' ? 'text-opacity-60' : 'text-opacity-100'
                }`}
                placeholder={suggestedAnswer 
                  ? "Type your own answer or use the demo answer above..." 
                  : "Type your message..."
                }
                disabled={isLoading || isAnimating}
                rows={1}
                style={{
                  opacity: fillStage === 'filling' ? 0.6 : 1,
                  transition: 'opacity 0.3s ease'
                }}
              />
              
              {/* Enhanced loading indicator */}
              <AnimatePresence>
                {isAnimating && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-white/95 backdrop-blur-sm rounded-lg flex items-center justify-center pointer-events-none border-2 border-goldenrod"
                  >
                    <div className="flex flex-col items-center gap-2 text-goldenrod">
                      {fillStage === 'expanding' && (
                        <>
                          <div className="w-6 h-6 border-2 border-goldenrod border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-sm font-medium">Preparing demo answer...</span>
                        </>
                      )}
                      {fillStage === 'filling' && (
                        <>
                          <motion.div
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ duration: 0.8, repeat: Infinity }}
                            className="w-6 h-6 bg-goldenrod rounded-full"
                          ></motion.div>
                          <span className="text-sm font-medium">Filling demo answer...</span>
                        </>
                      )}
                      {fillStage === 'ready' && (
                        <>
                          <motion.div
                            animate={{ rotate: [0, 360] }}
                            transition={{ duration: 0.5 }}
                          >
                            <Edit3 className="w-6 h-6" />
                          </motion.div>
                          <span className="text-sm font-medium">Ready to edit or send!</span>
                        </>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            {/* FIXED: Submit button with consistent height */}
            <motion.button
              onClick={sendMessage}
              disabled={isLoading || !input.trim() || isAnimating}
              className="bg-black text-white p-4 rounded-lg hover:bg-dark-gray transition-colors duration-200 disabled:bg-neutral-gray disabled:cursor-not-allowed h-[56px] w-[56px] flex items-center justify-center group flex-shrink-0" // Added flex-shrink-0 and consistent height
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {isLoading ? (
                <Loader className="animate-spin h-5 w-5" />
              ) : (
                <Send className="h-5 w-5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              )}
            </motion.button>
          </motion.div>
          
          {/* FIXED: Enhanced guidance text with better demo messaging */}
          <AnimatePresence mode="wait">
            {suggestedAnswer && !isAnimating && !justUsedDemo && (
              <motion.p 
                key="demo-available"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-xs text-neutral-gray mt-2 text-center"
              >
                💡 <span className="font-medium">New to brand development?</span> Try the demo answer for realistic results!
              </motion.p>
            )}
            
            {justUsedDemo && !isAnimating && (
              <motion.p
                key="demo-used"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-xs text-desert-sand mt-2 text-center font-medium"
              >
                ✨ Demo answer loaded! You can edit it or press Enter/Send to continue
              </motion.p>
            )}
            
            {isAnimating && (
              <motion.div
                key="demo-processing"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center justify-center mt-2 text-xs text-goldenrod"
              >
                <motion.div 
                  className="flex items-center gap-1"
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <div className="w-1 h-1 bg-goldenrod rounded-full"></div>
                  <span>
                    {fillStage === 'expanding' && 'Preparing input field...'}
                    {fillStage === 'filling' && 'Loading demo answer for you to review...'}
                    {fillStage === 'ready' && 'Demo answer ready! Edit if needed, then send'}
                  </span>
                  <div className="w-1 h-1 bg-goldenrod rounded-full"></div>
                </motion.div>
              </motion.div>
            )}
            
            {!suggestedAnswer && !justUsedDemo && !isAnimating && input.trim() && (
              <motion.p
                key="ready-to-send"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-xs text-neutral-gray mt-2 text-center"
              >
                Press Enter or click Send to continue
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </footer>
  );
};

export default MessageInput;