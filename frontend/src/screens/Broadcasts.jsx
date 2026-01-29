/**
 * ════════════════════════════════════════════════════════════════
 * BROADCASTS SCREEN
 * Campaign management
 * ════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiSend, FiPlus, FiPlay, FiPause, FiUsers,
  FiCheck, FiX, FiClock, FiMessageCircle
} from 'react-icons/fi';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import api from '../api';
import PullToRefresh from '../components/PullToRefresh';

// ═══════════════════════════════════════════════════════════════
// BROADCAST CARD
// ═══════════════════════════════════════════════════════════════

function BroadcastCard({ broadcast, onAction }) {
  const statusConfig = {
    draft: { color: 'bg-gray-500/20 text-gray-400', icon: FiClock, label: 'Draft' },
    scheduled: { color: 'bg-blue-500/20 text-blue-400', icon: FiClock, label: 'Scheduled' },
    sending: { color: 'bg-yellow-500/20 text-yellow-400', icon: FiPlay, label: 'Sending' },
    paused: { color: 'bg-orange-500/20 text-orange-400', icon: FiPause, label: 'Paused' },
    completed: { color: 'bg-green-500/20 text-green-400', icon: FiCheck, label: 'Completed' },
    failed: { color: 'bg-red-500/20 text-red-400', icon: FiX, label: 'Failed' },
  };
  
  const status = statusConfig[broadcast.status] || statusConfig.draft;
  const StatusIcon = status.icon;
  
  const deliveryRate = broadcast.sentCount > 0 
    ? Math.round((broadcast.deliveredCount / broadcast.sentCount) * 100)
    : 0;
  
  const readRate = broadcast.deliveredCount > 0
    ? Math.round((broadcast.readCount / broadcast.deliveredCount) * 100)
    : 0;
  
  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      className="card"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-white">{broadcast.name}</h3>
          <p className="text-sm text-gray-400 line-clamp-1">
            {broadcast.message || `Template: ${broadcast.templateName}`}
          </p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs flex items-center gap-1 ${status.color}`}>
          <StatusIcon size={12} />
          {status.label}
        </span>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        <div className="text-center">
          <p className="text-lg font-semibold text-white">{broadcast.targetCount}</p>
          <p className="text-xs text-gray-500">Target</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-primary">{broadcast.sentCount}</p>
          <p className="text-xs text-gray-500">Sent</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-success">{deliveryRate}%</p>
          <p className="text-xs text-gray-500">Delivered</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-info">{readRate}%</p>
          <p className="text-xs text-gray-500">Read</p>
        </div>
      </div>
      
      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t border-dark-200">
        {broadcast.status === 'draft' && (
          <button 
            onClick={() => onAction('start', broadcast.id)}
            className="btn-success flex-1 py-2 text-sm"
          >
            <FiPlay size={14} /> Start
          </button>
        )}
        {broadcast.status === 'sending' && (
          <button 
            onClick={() => onAction('pause', broadcast.id)}
            className="btn-secondary flex-1 py-2 text-sm"
          >
            <FiPause size={14} /> Pause
          </button>
        )}
        {broadcast.status === 'paused' && (
          <button 
            onClick={() => onAction('resume', broadcast.id)}
            className="btn-primary flex-1 py-2 text-sm"
          >
            <FiPlay size={14} /> Resume
          </button>
        )}
        {['draft', 'scheduled'].includes(broadcast.status) && (
          <button 
            onClick={() => onAction('delete', broadcast.id)}
            className="btn-danger flex-1 py-2 text-sm"
          >
            <FiX size={14} /> Delete
          </button>
        )}
      </div>
      
      {/* Date */}
      <p className="text-xs text-gray-500 mt-2">
        Created {format(new Date(broadcast.createdAt), 'PPp')}
      </p>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CREATE BROADCAST MODAL
// ═══════════════════════════════════════════════════════════════

function CreateBroadcastModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    name: '',
    messageType: 'text',
    message: '',
    templateName: '',
    targetType: 'all',
    targetSegment: '',
  });
  const [targetCount, setTargetCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  
  useEffect(() => {
    const preview = async () => {
      try {
        const data = await api.broadcasts.previewTargets(
          form.targetType,
          [],
          form.targetSegment
        );
        setTargetCount(data.count);
      } catch {}
    };
    preview();
  }, [form.targetType, form.targetSegment]);
  
  const handleSubmit = async () => {
    if (!form.name || (!form.message && !form.templateName)) {
      toast.error('Name and message are required');
      return;
    }
    
    setIsLoading(true);
    try {
      await api.broadcasts.create(form);
      toast.success('Broadcast created');
      onSave();
    } catch (error) {
      toast.error(error.message || 'Failed to create');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-dark-100 rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-hidden"
      >
        <div className="sticky top-0 bg-dark-100 border-b border-dark-200 p-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">New Broadcast</h2>
          <button onClick={onClose} className="p-2 hover:bg-dark-200 rounded-full">
            <FiX size={20} />
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto space-y-4" style={{ maxHeight: 'calc(90vh - 140px)' }}>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Campaign Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input"
              placeholder="Weekend Sale Campaign"
            />
          </div>
          
          <div>
            <label className="block text-sm text-gray-400 mb-2">Target Audience</label>
            <select
              value={form.targetType}
              onChange={(e) => setForm({ ...form, targetType: e.target.value })}
              className="input"
            >
              <option value="all">All Customers</option>
              <option value="segment">By Segment</option>
            </select>
          </div>
          
          {form.targetType === 'segment' && (
            <div>
              <label className="block text-sm text-gray-400 mb-2">Segment</label>
              <select
                value={form.targetSegment}
                onChange={(e) => setForm({ ...form, targetSegment: e.target.value })}
                className="input"
              >
                <option value="">Select segment</option>
                <option value="vip">VIP</option>
                <option value="loyal">Loyal</option>
                <option value="returning">Returning</option>
                <option value="new">New</option>
              </select>
            </div>
          )}
          
          <div className="bg-dark-200 rounded-xl p-3 flex items-center gap-3">
            <FiUsers className="text-primary" size={24} />
            <div>
              <p className="text-white font-medium">{targetCount} recipients</p>
              <p className="text-xs text-gray-400">Will receive this broadcast</p>
            </div>
          </div>
          
          <div>
            <label className="block text-sm text-gray-400 mb-2">Message *</label>
            <textarea
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              className="input min-h-[120px]"
              placeholder="Type your message..."
            />
          </div>
        </div>
        
        <div className="sticky bottom-0 bg-dark-100 border-t border-dark-200 p-4">
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="btn-primary w-full py-3"
          >
            {isLoading ? 'Creating...' : 'Create Broadcast'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN BROADCASTS SCREEN
// ═══════════════════════════════════════════════════════════════

export default function Broadcasts() {
  const [broadcasts, setBroadcasts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  
  const loadBroadcasts = useCallback(async () => {
    try {
      const data = await api.broadcasts.getAll();
      setBroadcasts(data.broadcasts || []);
    } catch (error) {
      console.error('Failed to load broadcasts:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);
  
  useEffect(() => {
    loadBroadcasts();
  }, [loadBroadcasts]);
  
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadBroadcasts();
  };
  
  const handleAction = async (action, broadcastId) => {
    try {
      switch (action) {
        case 'start':
          await api.broadcasts.start(broadcastId);
          toast.success('Broadcast started');
          break;
        case 'pause':
          await api.broadcasts.pause(broadcastId);
          toast.success('Broadcast paused');
          break;
        case 'resume':
          await api.broadcasts.resume(broadcastId);
          toast.success('Broadcast resumed');
          break;
        case 'delete':
          if (confirm('Delete this broadcast?')) {
            await api.broadcasts.delete(broadcastId);
            toast.success('Broadcast deleted');
          }
          break;
      }
      loadBroadcasts();
    } catch (error) {
      toast.error(error.message || 'Action failed');
    }
  };
  
  return (
    <>
      <PullToRefresh onRefresh={handleRefresh} isRefreshing={isRefreshing}>
        <div className="min-h-screen bg-dark safe-top">
          {/* Header */}
          <div className="sticky top-0 z-20 bg-dark/95 backdrop-blur-lg border-b border-dark-200 px-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white">Broadcasts</h1>
                <p className="text-sm text-gray-400">{broadcasts.length} campaigns</p>
              </div>
              <button 
                onClick={() => setShowModal(true)}
                className="btn-primary"
              >
                <FiPlus /> New
              </button>
            </div>
          </div>
          
          {/* Broadcast List */}
          <div className="p-4 pb-20 space-y-4">
            {isLoading ? (
              [1, 2, 3].map(i => (
                <div key={i} className="h-48 skeleton rounded-2xl" />
              ))
            ) : broadcasts.length > 0 ? (
              broadcasts.map(broadcast => (
                <BroadcastCard
                  key={broadcast.id}
                  broadcast={broadcast}
                  onAction={handleAction}
                />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                <FiSend size={48} className="mb-4 opacity-50" />
                <p className="text-lg">No broadcasts yet</p>
                <button 
                  onClick={() => setShowModal(true)}
                  className="btn-primary mt-4"
                >
                  <FiPlus /> Create Broadcast
                </button>
              </div>
            )}
          </div>
        </div>
      </PullToRefresh>
      
      {/* Create Modal */}
      <AnimatePresence>
        {showModal && (
          <CreateBroadcastModal
            onClose={() => setShowModal(false)}
            onSave={() => { setShowModal(false); loadBroadcasts(); }}
          />
        )}
      </AnimatePresence>
    </>
  );
}