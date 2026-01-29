/**
 * ════════════════════════════════════════════════════════════════
 * CHAT BUBBLE
 * Message bubble with support for various content types
 * ════════════════════════════════════════════════════════════════
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  FiCheck, FiCheckCheck, FiClock, FiAlertCircle,
  FiImage, FiFile, FiMic, FiMapPin, FiPlay,
  FiDownload, FiExternalLink
} from 'react-icons/fi';
import { format } from 'date-fns';

// ═══════════════════════════════════════════════════════════════
// STATUS ICON
// ═══════════════════════════════════════════════════════════════

function StatusIcon({ status }) {
  switch (status) {
    case 'read':
      return <FiCheckCheck size={14} className="text-success" />;
    case 'delivered':
      return <FiCheckCheck size={14} className="text-gray-400" />;
    case 'sent':
      return <FiCheck size={14} className="text-gray-400" />;
    case 'sending':
      return <FiClock size={14} className="text-gray-500 animate-pulse" />;
    case 'failed':
      return <FiAlertCircle size={14} className="text-danger" />;
    default:
      return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// IMAGE MESSAGE
// ═══════════════════════════════════════════════════════════════

function ImageMessage({ url, caption, onClick }) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  
  return (
    <div className="space-y-2">
      <div 
        className="relative rounded-xl overflow-hidden cursor-pointer max-w-[280px]"
        onClick={onClick}
      >
        {isLoading && (
          <div className="absolute inset-0 bg-dark-300 animate-pulse flex items-center justify-center">
            <FiImage size={32} className="text-gray-500" />
          </div>
        )}
        {hasError ? (
          <div className="w-full h-40 bg-dark-300 flex items-center justify-center">
            <FiAlertCircle size={32} className="text-gray-500" />
          </div>
        ) : (
          <img
            src={url}
            alt="Image"
            className="w-full h-auto max-h-80 object-cover"
            onLoad={() => setIsLoading(false)}
            onError={() => { setIsLoading(false); setHasError(true); }}
          />
        )}
      </div>
      {caption && <p className="text-sm">{caption}</p>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DOCUMENT MESSAGE
// ═══════════════════════════════════════════════════════════════

function DocumentMessage({ url, filename, caption }) {
  return (
    <div className="space-y-2">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 p-3 bg-dark-300/50 rounded-xl hover:bg-dark-300 transition-colors"
      >
        <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
          <FiFile size={20} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{filename || 'Document'}</p>
          <p className="text-xs text-gray-400">Tap to open</p>
        </div>
        <FiDownload size={18} className="text-gray-400" />
      </a>
      {caption && <p className="text-sm">{caption}</p>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// AUDIO MESSAGE
// ═══════════════════════════════════════════════════════════════

function AudioMessage({ url }) {
  const [isPlaying, setIsPlaying] = useState(false);
  
  return (
    <div className="flex items-center gap-3 min-w-[200px]">
      <button
        onClick={() => setIsPlaying(!isPlaying)}
        className="w-10 h-10 bg-primary rounded-full flex items-center justify-center"
      >
        {isPlaying ? (
          <div className="flex gap-0.5">
            <div className="w-1 h-4 bg-black rounded animate-pulse" />
            <div className="w-1 h-4 bg-black rounded animate-pulse" style={{ animationDelay: '0.1s' }} />
          </div>
        ) : (
          <FiPlay size={18} className="text-black ml-0.5" />
        )}
      </button>
      <div className="flex-1">
        <div className="h-1 bg-dark-300 rounded-full overflow-hidden">
          <div className="h-full bg-primary w-0 transition-all" style={{ width: isPlaying ? '60%' : '0%' }} />
        </div>
        <p className="text-xs text-gray-400 mt-1">0:00 / 0:30</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// LOCATION MESSAGE
// ═══════════════════════════════════════════════════════════════

function LocationMessage({ latitude, longitude, name, address }) {
  const mapUrl = `https://maps.google.com/?q=${latitude},${longitude}`;
  const staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${latitude},${longitude}&zoom=15&size=300x150&markers=${latitude},${longitude}`;
  
  return (
    <a
      href={mapUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block"
    >
      <div className="bg-dark-300/50 rounded-xl overflow-hidden">
        <div className="w-full h-32 bg-dark-300 flex items-center justify-center">
          <FiMapPin size={32} className="text-primary" />
        </div>
        <div className="p-3">
          <p className="font-medium">{name || 'Location'}</p>
          {address && <p className="text-sm text-gray-400">{address}</p>}
          <p className="text-xs text-primary mt-1 flex items-center gap-1">
            <FiExternalLink size={12} /> Open in Maps
          </p>
        </div>
      </div>
    </a>
  );
}

// ═══════════════════════════════════════════════════════════════
// INTERACTIVE BUTTONS
// ═══════════════════════════════════════════════════════════════

function ButtonsMessage({ text, buttons }) {
  return (
    <div className="space-y-2">
      <p>{text}</p>
      <div className="flex flex-wrap gap-2 mt-2">
        {buttons?.map((btn, i) => (
          <span
            key={i}
            className="px-3 py-1.5 bg-dark-300/50 rounded-lg text-sm text-primary border border-dark-300"
          >
            {btn.title || btn.text}
          </span>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TEMPLATE MESSAGE
// ═══════════════════════════════════════════════════════════════

function TemplateMessage({ templateName, text }) {
  return (
    <div className="space-y-1">
      <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded">
        Template: {templateName}
      </span>
      <p className="text-sm text-gray-400 italic">{text || 'Template message sent'}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN CHAT BUBBLE
// ═══════════════════════════════════════════════════════════════

export default function ChatBubble({ message, showAvatar = false }) {
  const isOutgoing = message.direction === 'outgoing';
  const [showFullImage, setShowFullImage] = useState(false);
  
  // Format time
  const time = message.timestamp 
    ? format(new Date(message.timestamp), 'h:mm a')
    : '';
  
  // Render content based on type
  const renderContent = () => {
    switch (message.type) {
      case 'image':
        return (
          <ImageMessage
            url={message.mediaUrl}
            caption={message.mediaCaption || message.text}
            onClick={() => setShowFullImage(true)}
          />
        );
        
      case 'video':
        return (
          <div className="space-y-2">
            <div className="relative rounded-xl overflow-hidden bg-dark-300 w-64 h-40 flex items-center justify-center cursor-pointer">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur">
                <FiPlay size={24} className="text-white ml-1" />
              </div>
            </div>
            {message.mediaCaption && <p className="text-sm">{message.mediaCaption}</p>}
          </div>
        );
        
      case 'audio':
        return <AudioMessage url={message.mediaUrl} />;
        
      case 'document':
        return (
          <DocumentMessage
            url={message.mediaUrl}
            filename={message.filename}
            caption={message.mediaCaption}
          />
        );
        
      case 'location':
        return (
          <LocationMessage
            latitude={message.latitude}
            longitude={message.longitude}
            name={message.locationName}
            address={message.locationAddress}
          />
        );
        
      case 'interactive':
      case 'buttons':
        return <ButtonsMessage text={message.text} buttons={message.buttons} />;
        
      case 'template':
        return <TemplateMessage templateName={message.templateName} text={message.text} />;
        
      case 'text':
      default:
        // Parse URLs and make them clickable
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const parts = message.text?.split(urlRegex) || [];
        
        return (
          <p className="whitespace-pre-wrap break-words">
            {parts.map((part, i) => 
              urlRegex.test(part) ? (
                <a
                  key={i}
                  href={part}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  {part}
                </a>
              ) : (
                <span key={i}>{part}</span>
              )
            )}
          </p>
        );
    }
  };
  
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2 }}
        className={`flex mb-2 ${isOutgoing ? 'justify-end' : 'justify-start'}`}
      >
        <div
          className={`max-w-[85%] ${
            isOutgoing
              ? 'bubble-outgoing bg-primary/10 text-white'
              : 'bubble-incoming bg-dark-200 text-white'
          } px-4 py-2.5`}
        >
          {/* Auto reply badge */}
          {message.isAutoReply && (
            <span className="text-[10px] text-gray-400 block mb-1">🤖 Auto-reply</span>
          )}
          
          {/* Content */}
          <div className="text-[15px] leading-relaxed">
            {renderContent()}
          </div>
          
          {/* Time & Status */}
          <div className={`flex items-center gap-1 mt-1 ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
            <span className="text-[10px] text-gray-500">{time}</span>
            {isOutgoing && <StatusIcon status={message.status} />}
          </div>
        </div>
      </motion.div>
      
      {/* Full Image Modal */}
      {showFullImage && message.mediaUrl && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={() => setShowFullImage(false)}
        >
          <img
            src={message.mediaUrl}
            alt="Full size"
            className="max-w-full max-h-full object-contain"
          />
        </motion.div>
      )}
    </>
  );
}