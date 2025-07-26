import React from 'react';
import { motion } from 'framer-motion';
import { Message } from './types/interview';
import { marked } from 'marked';

// Create a custom renderer
const renderer = new marked.Renderer();

// Override the line break behavior
renderer.br = () => '<br/><br/>';

// Apply the custom renderer to marked
marked.use({
  renderer,
  breaks: true, // Interpret single newlines as breaks
  gfm: true,    // Enable GitHub Flavored Markdown
});

interface MessageBubbleProps {
  message: Message;
  isLast: boolean;
  brandName: string;
  reportContent: string | null;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isAssistant = message.role === 'assistant';
  
  // Check if this message contains download components
  const hasDownloadComponent = message.content.includes('onclick="window.downloadReport');
  
  // Split content into paragraphs and render each separately
  const paragraphs = message.content.split('\n\n').filter(p => p.trim());
  
  // If this is a download component message, render it specially
  if (hasDownloadComponent) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={`mb-4 ${isAssistant ? 'text-left' : 'text-right'}`}
      >
        <div
          className={`inline-block max-w-[85%] rounded-lg ${
            isAssistant ? 'bg-transparent' : 'bg-dark-gray text-bone p-4'
          }`}
        >
          {/* Custom styling for download components */}
          <style>{`
            .download-container {
              background: linear-gradient(135deg, rgb(227, 205, 189, 0.1) 0%, rgb(227, 217, 197, 0.1) 100%);
              border: 1px solid rgb(227, 205, 189, 0.3);
              border-radius: 12px;
              margin: 16px 0;
              padding: 16px;
              max-width: 100%;
            }
            
            .download-header {
              display: flex;
              align-items: center;
              gap: 12px;
              margin-bottom: 12px;
            }
            
            .download-icon {
              flex-shrink: 0;
              padding: 8px;
              background: rgb(227, 205, 189, 0.2);
              border-radius: 50%;
            }
            
            .download-title {
              font-weight: 600;
              color: rgb(42, 43, 42);
              font-size: 14px;
              margin: 0;
            }
            
            .download-subtitle {
              font-size: 12px;
              color: rgb(133, 136, 140);
              margin: 0;
            }
            
            .download-button {
              display: inline-flex;
              align-items: center;
              gap: 8px;
              padding: 12px 16px;
              background: linear-gradient(135deg, rgb(227, 205, 189) 0%, rgb(227, 217, 197) 100%);
              color: rgb(42, 43, 42);
              font-weight: 500;
              border-radius: 8px;
              border: none;
              cursor: pointer;
              transition: all 0.2s ease;
              text-decoration: none;
              font-size: 14px;
              line-height: 1;
              box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            }
            
            .download-button:hover {
              background: linear-gradient(135deg, rgb(227, 217, 197) 0%, rgb(210, 146, 48) 100%);
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
              transform: translateY(-1px);
            }
            
            .download-button svg {
              width: 16px;
              height: 16px;
              transition: transform 0.2s ease;
            }
            
            .download-button:hover svg {
              transform: translateY(2px);
            }
            
            .download-tip {
              font-size: 12px;
              color: rgb(133, 136, 140);
              margin-top: 8px;
              margin-bottom: 0;
            }
          `}</style>
          
          <div
            dangerouslySetInnerHTML={{ __html: marked.parse(message.content) }}
          />
        </div>
      </motion.div>
    );
  }

  // Regular message rendering
  return (
    <>
      {paragraphs.map((paragraph, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className={`mb-4 ${isAssistant ? 'text-left' : 'text-right'}`}
        >
          <div
            className={`inline-block max-w-[80%] p-4 rounded-lg ${
              isAssistant ? 'bg-bone text-dark-gray' : 'bg-dark-gray text-bone'
            }`}
            dangerouslySetInnerHTML={{ __html: marked.parse(paragraph) }}
          />
        </motion.div>
      ))}
    </>
  );
};

export default MessageBubble;