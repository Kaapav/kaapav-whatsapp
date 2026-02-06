/**
 * ════════════════════════════════════════════════════════════════
 * MEDIA PICKER
 * Media selection panel for sending images/files
 * ════════════════════════════════════════════════════════════════
 */

import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  FiX, FiImage, FiCamera, FiFile, FiUpload,
  FiTrash2, FiSend
} from 'react-icons/fi';
import toast from 'react-hot-toast';

// ═══════════════════════════════════════════════════════════════
// MEDIA TYPE OPTIONS
// ═══════════════════════════════════════════════════════════════

const MEDIA_OPTIONS = [
  { id: 'gallery', icon: FiImage, label: 'Gallery', accept: 'image/*' },
  { id: 'camera', icon: FiCamera, label: 'Camera', accept: 'image/*', capture: 'environment' },
  { id: 'document', icon: FiFile, label: 'Document', accept: '.pdf,.doc,.docx,.xls,.xlsx' },
];

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function MediaPicker({ onSelect, onClose }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  
  // Handle file selection
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file size (max 16MB for WhatsApp)
    if (file.size > 16 * 1024 * 1024) {
      toast.error('File size must be less than 16MB');
      return;
    }
    
    setSelectedFile(file);
    
    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  };
  
  // Trigger file input
  const triggerFileInput = (accept, capture) => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = accept;
      if (capture) {
        fileInputRef.current.capture = capture;
      } else {
        fileInputRef.current.removeAttribute('capture');
      }
      fileInputRef.current.click();
    }
  };
  
  // Handle send
  const handleSend = async () => {
    if (!selectedFile) return;
    
    setIsUploading(true);
    
    try {
      // In a real app, you'd upload to your server/R2 first
      // For now, we'll just pass the file info
      onSelect({
        file: selectedFile,
        type: selectedFile.type.startsWith('image/') ? 'image' : 'document',
        caption,
        preview,
      });
    } catch (error) {
      toast.error('Failed to send media');
    } finally {
      setIsUploading(false);
    }
  };
  
  // Clear selection
  const clearSelection = () => {
    setSelectedFile(null);
    setPreview(null);
    setCaption('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/90"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-0 left-0 right-0 bg-dark-100 rounded-t-3xl overflow-hidden"
      >
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          className="hidden"
        />
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-200">
          <h2 className="text-lg font-semibold text-white">Send Media</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-dark-200 rounded-full transition-colors"
          >
            <FiX size={20} />
          </button>
        </div>
        
        {/* Content */}
        {selectedFile ? (
          <div className="p-4">
            {/* Preview */}
            <div className="relative mb-4">
              {preview ? (
                <div className="relative rounded-2xl overflow-hidden bg-dark-200">
                  <img
                    src={preview}
                    alt="Preview"
                    className="w-full max-h-64 object-contain"
                  />
                  <button
                    onClick={clearSelection}
                    className="absolute top-2 right-2 p-2 bg-dark/80 rounded-full hover:bg-dark"
                  >
                    <FiTrash2 size={18} className="text-danger" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-4 p-4 bg-dark-200 rounded-2xl">
                  <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center">
                    <FiFile size={24} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white truncate">{selectedFile.name}</p>
                    <p className="text-sm text-gray-400">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <button
                    onClick={clearSelection}
                    className="p-2 hover:bg-dark-300 rounded-full"
                  >
                    <FiTrash2 size={18} className="text-danger" />
                  </button>
                </div>
              )}
            </div>
            
            {/* Caption Input */}
            <div className="mb-4">
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Add a caption..."
                className="input"
              />
            </div>
            
            {/* Send Button */}
            <button
              onClick={handleSend}
              disabled={isUploading}
              className="btn-primary w-full py-3"
            >
              {isUploading ? (
                <span className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Sending...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <FiSend size={18} /> Send
                </span>
              )}
            </button>
          </div>
        ) : (
          <div className="p-6">
            {/* Media Options */}
            <div className="grid grid-cols-3 gap-4">
              {MEDIA_OPTIONS.map(option => (
                <motion.button
                  key={option.id}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => triggerFileInput(option.accept, option.capture)}
                  className="flex flex-col items-center gap-3 p-6 bg-dark-200 rounded-2xl hover:bg-dark-300 transition-colors"
                >
                  <div className="w-14 h-14 bg-primary/20 rounded-full flex items-center justify-center">
                    <option.icon size={28} className="text-primary" />
                  </div>
                  <span className="text-sm text-gray-300">{option.label}</span>
                </motion.button>
              ))}
            </div>
            
            {/* Drag & Drop Area */}
            <div className="mt-6 p-8 border-2 border-dashed border-dark-300 rounded-2xl text-center">
              <FiUpload size={32} className="mx-auto mb-3 text-gray-500" />
              <p className="text-gray-400">Drag and drop files here</p>
              <p className="text-sm text-gray-500 mt-1">Max file size: 16MB</p>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}