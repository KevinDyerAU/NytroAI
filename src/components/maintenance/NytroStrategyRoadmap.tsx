import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Rocket, 
  Server, 
  CreditCard, 
  Mail, 
  Globe, 
  Key, 
  Shield,
  ExternalLink,
  Target,
  Users,
  Building2,
  Megaphone,
  DollarSign,
  Truck,
  Factory,
  CheckSquare,
  Square,
  TrendingUp,
  Phone,
  FileText,
  Linkedin,
  Briefcase,
  MapPin,
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { Card } from '../ui/card';
import { useStrategyChecklist, ChecklistItem } from '../../hooks/useStrategyChecklist';

// Types
interface TimelineMilestone {
  id: string;
  month: string;
  title: string;
  status: 'completed' | 'in-progress' | 'upcoming';
  items: string[];
}

interface RoadmapItem {
  id: string;
  title: string;
  description: string;
  targetDate: string;
  status: 'planned' | 'in-progress' | 'completed' | 'monitoring';
  priority: 'high' | 'medium' | 'low';
  icon: React.ReactNode;
  category: 'integration' | 'infrastructure' | 'feature' | 'compliance';
  details?: string[];
}

type TabId = 'overview' | 'plan2026' | 'platform' | 'marketing' | 'commercial' | 'industry' | 'tech';

// Add/Edit Item Modal Component
interface ItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: Partial<ChecklistItem>) => Promise<void>;
  item?: ChecklistItem | null;
  category: string;
  section: string;
}

function ItemModal({ isOpen, onClose, onSave, item, category, section }: ItemModalProps) {
  const [formData, setFormData] = useState({
    item_id: '',
    title: '',
    description: '',
    target_date: '',
    priority: 'medium' as 'high' | 'medium' | 'low',
    sort_order: 0,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setFormData({
        item_id: item.item_id,
        title: item.title,
        description: item.description || '',
        target_date: item.target_date || '',
        priority: item.priority,
        sort_order: item.sort_order,
      });
    } else {
      setFormData({
        item_id: '',
        title: '',
        description: '',
        target_date: '',
        priority: 'medium',
        sort_order: 100,
      });
    }
  }, [item]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        ...formData,
        item_id: formData.item_id || formData.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        category,
        section,
      });
      onClose();
    } catch (error) {
      console.error('Error saving item:', error);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">{item ? 'Edit Item' : 'Add New Item'}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Target Date</label>
            <input
              type="text"
              value={formData.target_date}
              onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
              placeholder="e.g., Week 19 Jan 2026"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
            <select
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value as 'high' | 'medium' | 'low' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
            <input
              type="number"
              value={formData.sort_order}
              onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-cyan-600 text-white rounded-md hover:bg-cyan-700 disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Checklist Section Component with CRUD
interface ChecklistSectionProps {
  title: string;
  category: string;
  section: string;
  items: ChecklistItem[];
  onToggle: (itemId: string) => void;
  onAdd: (item: Partial<ChecklistItem>) => Promise<ChecklistItem>;
  onUpdate: (itemId: string, updates: Partial<ChecklistItem>) => Promise<void>;
  onDelete: (itemId: string) => Promise<void>;
}

function ChecklistSection({ title, category, section, items, onToggle, onAdd, onUpdate, onDelete }: ChecklistSectionProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ChecklistItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const sectionItems = items.filter(item => item.section === section);
  const completedCount = sectionItems.filter(item => item.completed).length;

  const handleSave = async (itemData: Partial<ChecklistItem>) => {
    if (editingItem) {
      await onUpdate(editingItem.item_id, itemData);
    } else {
      await onAdd({ ...itemData, category, section } as any);
    }
    setEditingItem(null);
  };

  const handleDelete = async (itemId: string) => {
    await onDelete(itemId);
    setDeleteConfirm(null);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
      <div className="flex justify-between items-center mb-3">
        <div>
          <h4 className="font-semibold text-gray-800">{title}</h4>
          <p className="text-sm text-gray-500">{completedCount}/{sectionItems.length} completed</p>
        </div>
        <button
          onClick={() => { setEditingItem(null); setModalOpen(true); }}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-cyan-50 text-cyan-700 rounded-md hover:bg-cyan-100"
        >
          <Plus className="w-4 h-4" /> Add Item
        </button>
      </div>
      <div className="space-y-2">
        {sectionItems.map((item) => (
          <div
            key={item.item_id}
            className={`flex items-start gap-3 p-2 rounded-md hover:bg-gray-50 group ${item.completed ? 'opacity-60' : ''}`}
          >
            <button
              onClick={() => onToggle(item.item_id)}
              className="mt-0.5 flex-shrink-0"
            >
              {item.completed ? (
                <CheckSquare className="w-5 h-5 text-green-600" />
              ) : (
                <Square className="w-5 h-5 text-gray-400 hover:text-cyan-600" />
              )}
            </button>
            <div className="flex-1 min-w-0">
              <p className={`text-sm ${item.completed ? 'line-through text-gray-500' : 'text-gray-700'}`}>
                {item.title}
              </p>
              {item.description && (
                <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
              )}
              <div className="flex items-center gap-2 mt-1">
                {item.target_date && (
                  <span className="text-xs text-gray-400">{item.target_date}</span>
                )}
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  item.priority === 'high' ? 'bg-red-100 text-red-700' :
                  item.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {item.priority}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => { setEditingItem(item); setModalOpen(true); }}
                className="p-1 text-gray-400 hover:text-cyan-600"
                title="Edit"
              >
                <Pencil className="w-4 h-4" />
              </button>
              {deleteConfirm === item.item_id ? (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleDelete(item.item_id)}
                    className="p-1 text-red-600 hover:text-red-700"
                    title="Confirm delete"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="p-1 text-gray-400 hover:text-gray-600"
                    title="Cancel"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setDeleteConfirm(item.item_id)}
                  className="p-1 text-gray-400 hover:text-red-600"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
        {sectionItems.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">No items yet. Click "Add Item" to create one.</p>
        )}
      </div>
      <ItemModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditingItem(null); }}
        onSave={handleSave}
        item={editingItem}
        category={category}
        section={section}
      />
    </div>
  );
}

export function NytroStrategyRoadmap() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  
  // Use the database-backed hook
  const {
    items,
    loading,
    error,
    stats,
    fetchItems,
    toggleItem,
    addItem,
    updateItem,
    deleteItem,
    getItemsByCategory,
  } = useStrategyChecklist();

  // 12-month timeline milestones
  const timelineMilestones: TimelineMilestone[] = [
    {
      id: 'jan',
      month: 'Jan 2026',
      title: 'Launch & Setup',
      status: 'in-progress',
      items: ['Payment portal', 'Website launch', 'API meetings', 'Bank accounts']
    },
    {
      id: 'feb',
      month: 'Feb 2026',
      title: 'Sales Push',
      status: 'upcoming',
      items: ['$10K revenue target', 'RTO demos', 'Marketing campaigns', 'Litmos access']
    },
    {
      id: 'mar',
      month: 'Mar 2026',
      title: 'Growth',
      status: 'upcoming',
      items: ['Interstate expansion', 'Consultant network', 'API integrations']
    },
    {
      id: 'apr',
      month: 'Apr 2026',
      title: 'Scale',
      status: 'upcoming',
      items: ['Volume focus', 'Process refinement', 'Partner onboarding']
    },
    {
      id: 'may',
      month: 'May 2026',
      title: 'Expand',
      status: 'upcoming',
      items: ['Industry verticals', 'White label review', 'Feature updates']
    },
    {
      id: 'jun',
      month: 'Jun 2026',
      title: 'Infrastructure',
      status: 'upcoming',
      items: ['n8n Azure migration', 'Performance optimization', 'Security review']
    },
    {
      id: 'jul',
      month: 'Jul 2026',
      title: 'H2 Planning',
      status: 'upcoming',
      items: ['Review H1 results', 'Strategy adjustment', 'New targets']
    },
    {
      id: 'aug',
      month: 'Aug 2026',
      title: 'Industry Push',
      status: 'upcoming',
      items: ['Transport sector', 'Construction', 'Mining']
    },
    {
      id: 'sep',
      month: 'Sep 2026',
      title: 'Consolidate',
      status: 'upcoming',
      items: ['Customer success', 'Feature polish', 'Documentation']
    },
    {
      id: 'oct',
      month: 'Oct 2026',
      title: 'Tech Review',
      status: 'upcoming',
      items: ['Keystone meeting 23/10', 'API assessment', 'Platform review']
    },
    {
      id: 'nov',
      month: 'Nov 2026',
      title: 'Year End Prep',
      status: 'upcoming',
      items: ['2027 planning', 'Budget review', 'Team growth']
    },
    {
      id: 'dec',
      month: 'Dec 2026',
      title: 'Compliance',
      status: 'upcoming',
      items: ['Data sovereignty review', 'Azure decision', 'Annual review']
    }
  ];

  // Tech roadmap items
  const techRoadmapItems: RoadmapItem[] = [
    {
      id: 'keystone-meeting',
      title: 'Keystone Initial Tech Discussion',
      description: 'Initial technical discussion meeting with Keystone team to explore API integration possibilities.',
      targetDate: '23 October 2026, 11:00 AM',
      status: 'planned',
      priority: 'high',
      icon: <Calendar className="w-6 h-6" />,
      category: 'integration',
      details: [
        'Discuss API capabilities and documentation',
        'Review authentication requirements',
        'Explore data synchronization options',
        'Identify integration timeline and resources'
      ]
    },
    {
      id: 'keystone-api',
      title: 'Keystone API Integration',
      description: 'Integrate with Keystone API for enhanced training package data access and synchronization.',
      targetDate: 'February 2026',
      status: 'planned',
      priority: 'high',
      icon: <Key className="w-6 h-6" />,
      category: 'integration',
      details: [
        'API authentication and authorization setup',
        'Training package data synchronization',
        'Real-time updates for unit of competency changes',
        'Automated data validation against Keystone source'
      ]
    },
    {
      id: 'litmos-access',
      title: 'Litmos LMS Access',
      description: 'Establish Litmos Learning Management System access through Bill for enhanced learning content integration.',
      targetDate: 'February 2026',
      status: 'planned',
      priority: 'high',
      icon: <Globe className="w-6 h-6" />,
      category: 'integration',
      details: [
        'Coordinate access credentials through Bill',
        'LMS content synchronization',
        'User progress tracking integration',
        'Assessment result import capabilities'
      ]
    },
    {
      id: 'stripe-integration',
      title: 'Stripe Payment Gateway',
      description: 'Setup and integrate Stripe payment gateway for subscription management and credit purchases.',
      targetDate: 'February 2026',
      status: 'planned',
      priority: 'high',
      icon: <CreditCard className="w-6 h-6" />,
      category: 'integration',
      details: [
        'Stripe account configuration',
        'Payment processing implementation',
        'Subscription management setup',
        'Invoice and receipt generation'
      ]
    },
    {
      id: 'twilio-campaigns',
      title: 'Twilio Email & SMS Campaigns',
      description: 'Add Twilio integration for email and SMS marketing campaigns in admin pages.',
      targetDate: 'February 2026',
      status: 'planned',
      priority: 'medium',
      icon: <Mail className="w-6 h-6" />,
      category: 'feature',
      details: [
        'Twilio SendGrid email integration',
        'SMS notification capabilities',
        'Campaign management interface',
        'Template management system'
      ]
    },
    {
      id: 'app-nytro-link',
      title: 'App.nytro.com Website Link',
      description: 'Add app.nytro.com link to the main website for easy access to the application.',
      targetDate: 'February 2026',
      status: 'planned',
      priority: 'medium',
      icon: <ExternalLink className="w-6 h-6" />,
      category: 'feature',
      details: [
        'Update website navigation',
        'Add prominent CTA button',
        'Implement proper redirects',
        'Update marketing materials'
      ]
    },
    {
      id: 'n8n-azure',
      title: 'n8n Hosting Migration to Azure',
      description: 'Migrate n8n workflow automation hosting from current provider to Microsoft Azure.',
      targetDate: 'June 2026',
      status: 'planned',
      priority: 'high',
      icon: <Server className="w-6 h-6" />,
      category: 'infrastructure',
      details: [
        'Azure infrastructure setup',
        'n8n container deployment',
        'Data migration and testing',
        'DNS and SSL configuration',
        'Performance optimization'
      ]
    },
    {
      id: 'data-sovereignty',
      title: 'Google Data Sovereignty Monitoring',
      description: 'Monitor Google\'s response to Australian data sovereignty requirements for Gemini. Plan contingency switch to Microsoft Azure by end of year if needed.',
      targetDate: 'December 2026',
      status: 'monitoring',
      priority: 'high',
      icon: <Shield className="w-6 h-6" />,
      category: 'compliance',
      details: [
        'Track Google announcements on AU data residency',
        'Evaluate Azure OpenAI as alternative',
        'Prepare migration plan if needed',
        'Document compliance requirements',
        'Regular quarterly reviews'
      ]
    }
  ];

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <Target className="w-4 h-4" /> },
    { id: 'plan2026', label: '2026 Plan', icon: <Calendar className="w-4 h-4" /> },
    { id: 'platform', label: 'Platform & Systems', icon: <Server className="w-4 h-4" /> },
    { id: 'marketing', label: 'Marketing', icon: <Megaphone className="w-4 h-4" /> },
    { id: 'commercial', label: 'Commercial Model', icon: <DollarSign className="w-4 h-4" /> },
    { id: 'industry', label: 'Industry Expansion', icon: <Factory className="w-4 h-4" /> },
    { id: 'tech', label: 'Tech Roadmap', icon: <Rocket className="w-4 h-4" /> },
  ];

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'integration': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'infrastructure': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'feature': return 'bg-green-100 text-green-800 border-green-200';
      case 'compliance': return 'bg-amber-100 text-amber-800 border-amber-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'in-progress': return <Clock className="w-5 h-5 text-blue-600" />;
      case 'monitoring': return <AlertTriangle className="w-5 h-5 text-amber-600" />;
      default: return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f9fb] p-8 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-600">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading checklist data...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-[#f8f9fb] p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <span className="text-red-800">Error loading checklist: {error}</span>
          </div>
          <button
            onClick={fetchItems}
            className="flex items-center gap-2 px-3 py-1.5 bg-red-100 text-red-700 rounded-md hover:bg-red-200"
          >
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      </div>
    );
  }

  const renderOverviewTab = () => (
    <div className="space-y-6">
      {/* Six Month Plan Summary */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-cyan-600" />
          Six Month Plan Summary
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-cyan-50 rounded-lg p-4 border border-cyan-200">
            <h4 className="font-medium text-cyan-800">Revenue Target</h4>
            <p className="text-2xl font-bold text-cyan-600 mt-1">$10,000</p>
            <p className="text-sm text-cyan-600">By end of February</p>
          </div>
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <h4 className="font-medium text-green-800">Weekly Meeting</h4>
            <p className="text-lg font-semibold text-green-600 mt-1">Every Monday</p>
            <p className="text-sm text-green-600">Team sync and progress review</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
            <h4 className="font-medium text-purple-800">Focus Areas</h4>
            <p className="text-lg font-semibold text-purple-600 mt-1">RTO Market</p>
            <p className="text-sm text-purple-600">Then industry expansion</p>
          </div>
        </div>
      </Card>

      {/* Key Messaging Reminder */}
      <Card className="p-6 bg-blue-50 border-blue-200">
        <h3 className="text-lg font-semibold text-blue-800 mb-3 flex items-center gap-2">
          <Megaphone className="w-5 h-5" />
          Key Messaging Reminder
        </h3>
        <p className="text-blue-700">
          The messaging around Nytro must stay away from <strong>compliance</strong> and <strong>efficiency</strong> language. 
          Focus on <strong>generating income</strong>, <strong>streamlining day-to-day workload</strong>, and 
          <strong> reducing pressure on business owners and managers</strong>.
        </p>
      </Card>

      {/* Progress Overview */}
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-cyan-600" />
            Overall Progress
          </h3>
          <button
            onClick={fetchItems}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-cyan-600"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>{stats.completed} of {stats.total} tasks completed</span>
            <span>{stats.percentage}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-cyan-500 to-cyan-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${stats.percentage}%` }}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          {Object.entries(stats.byCategory).map(([category, data]) => (
            <div key={category} className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 uppercase">{category}</p>
              <p className="text-lg font-semibold text-gray-800">
                {data.completed}/{data.total}
              </p>
              <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                <div
                  className="bg-cyan-500 h-1.5 rounded-full"
                  style={{ width: `${data.total > 0 ? (data.completed / data.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );

  const renderPlan2026Tab = () => {
    const plan2026Items = getItemsByCategory('plan2026');
    
    return (
      <div className="space-y-6">
        {/* 12-Month Timeline */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-cyan-600" />
            12-Month Timeline
          </h3>
          <div className="overflow-x-auto">
            <div className="flex gap-2 min-w-max pb-4">
              {timelineMilestones.map((milestone) => (
                <div
                  key={milestone.id}
                  className={`flex-shrink-0 w-32 p-3 rounded-lg border ${
                    milestone.status === 'completed' ? 'bg-green-50 border-green-200' :
                    milestone.status === 'in-progress' ? 'bg-blue-50 border-blue-200' :
                    'bg-gray-50 border-gray-200'
                  }`}
                >
                  <p className="text-xs font-medium text-gray-500">{milestone.month}</p>
                  <p className="font-semibold text-sm text-gray-800 mt-1">{milestone.title}</p>
                  <ul className="mt-2 space-y-1">
                    {milestone.items.slice(0, 2).map((item, idx) => (
                      <li key={idx} className="text-xs text-gray-600 truncate">• {item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Weekly Checklists */}
        <ChecklistSection
          title="Week 19 January Tasks"
          category="plan2026"
          section="week-19-jan"
          items={plan2026Items}
          onToggle={toggleItem}
          onAdd={addItem}
          onUpdate={updateItem}
          onDelete={deleteItem}
        />

        <ChecklistSection
          title="Week 27 January Tasks"
          category="plan2026"
          section="week-27-jan"
          items={plan2026Items}
          onToggle={toggleItem}
          onAdd={addItem}
          onUpdate={updateItem}
          onDelete={deleteItem}
        />

        <ChecklistSection
          title="February Focus"
          category="plan2026"
          section="february"
          items={plan2026Items}
          onToggle={toggleItem}
          onAdd={addItem}
          onUpdate={updateItem}
          onDelete={deleteItem}
        />
      </div>
    );
  };

  const renderPlatformTab = () => {
    const platformItems = getItemsByCategory('platform');
    
    return (
      <div className="space-y-6">
        <ChecklistSection
          title="API Connections"
          category="platform"
          section="api-connections"
          items={platformItems}
          onToggle={toggleItem}
          onAdd={addItem}
          onUpdate={updateItem}
          onDelete={deleteItem}
        />

        <ChecklistSection
          title="Mandatory Documents"
          category="platform"
          section="documents"
          items={platformItems}
          onToggle={toggleItem}
          onAdd={addItem}
          onUpdate={updateItem}
          onDelete={deleteItem}
        />

        <ChecklistSection
          title="Platform Review"
          category="platform"
          section="review"
          items={platformItems}
          onToggle={toggleItem}
          onAdd={addItem}
          onUpdate={updateItem}
          onDelete={deleteItem}
        />
      </div>
    );
  };

  const renderMarketingTab = () => (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Linkedin className="w-5 h-5 text-blue-600" />
          LinkedIn Presence
        </h3>
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <Users className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-gray-800">Weekly Posts</p>
              <p className="text-sm text-gray-600">Post on LinkedIn weekly to maintain visibility and momentum</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <Target className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-gray-800">Targeted Ads</p>
              <p className="text-sm text-gray-600">LinkedIn and Meta advertising campaigns for RTO market</p>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Mail className="w-5 h-5 text-cyan-600" />
          Email Branding
        </h3>
        <p className="text-gray-600 mb-4">
          Email templates and introductory messaging finalised with consistent Nytro branding.
        </p>
        <div className="bg-cyan-50 rounded-lg p-4 border border-cyan-200">
          <p className="font-medium text-cyan-800">Introductory Pricing</p>
          <p className="text-3xl font-bold text-cyan-600 mt-1">$99</p>
          <p className="text-sm text-cyan-600">Special launch offer for early adopters</p>
        </div>
      </Card>
    </div>
  );

  const renderCommercialTab = () => (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-green-600" />
          Revenue Streams
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <h4 className="font-medium text-green-800">Subscriptions</h4>
            <p className="text-sm text-green-600 mt-1">Monthly/annual platform access fees</p>
          </div>
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="font-medium text-blue-800">Credit Purchases</h4>
            <p className="text-sm text-blue-600 mt-1">Pay-per-use validation credits</p>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
            <h4 className="font-medium text-purple-800">White Label</h4>
            <p className="text-sm text-purple-600 mt-1">Branded solutions for partners</p>
          </div>
          <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
            <h4 className="font-medium text-amber-800">Consulting</h4>
            <p className="text-sm text-amber-600 mt-1">Implementation and training services</p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Pricing Concepts</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-3">Service</th>
                <th className="text-left py-2 px-3">Unit</th>
                <th className="text-right py-2 px-3">Approx. Price</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="py-2 px-3">Pre-marking</td>
                <td className="py-2 px-3">Per question</td>
                <td className="text-right py-2 px-3 font-medium">~$0.04</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-3">Full Validation</td>
                <td className="py-2 px-3">Per unit</td>
                <td className="text-right py-2 px-3 font-medium">TBD</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-3">Document Processing</td>
                <td className="py-2 px-3">Per document</td>
                <td className="text-right py-2 px-3 font-medium">TBD</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );

  const renderIndustryTab = () => {
    const industries = [
      { name: 'Transport & Logistics', icon: <Truck className="w-5 h-5" /> },
      { name: 'Construction', icon: <Building2 className="w-5 h-5" /> },
      { name: 'Civil', icon: <MapPin className="w-5 h-5" /> },
      { name: 'Mining', icon: <Factory className="w-5 h-5" /> },
      { name: 'Warehousing', icon: <Building2 className="w-5 h-5" /> },
      { name: 'Manufacturing', icon: <Factory className="w-5 h-5" /> },
      { name: 'Real Estate', icon: <Building2 className="w-5 h-5" /> },
      { name: 'Security', icon: <Shield className="w-5 h-5" /> },
      { name: 'Cleaning', icon: <CheckCircle2 className="w-5 h-5" /> },
      { name: 'Facilities Management', icon: <Building2 className="w-5 h-5" /> },
      { name: 'Aviation Ground Ops', icon: <Rocket className="w-5 h-5" /> },
      { name: 'Ports & Stevedoring', icon: <Truck className="w-5 h-5" /> },
      { name: 'Utilities', icon: <Server className="w-5 h-5" /> },
      { name: 'Telecommunications', icon: <Phone className="w-5 h-5" /> },
      { name: 'Waste Management', icon: <Truck className="w-5 h-5" /> },
      { name: 'Traffic Control', icon: <AlertTriangle className="w-5 h-5" /> },
      { name: 'Labour Hire', icon: <Users className="w-5 h-5" /> },
      { name: 'Local Government', icon: <Building2 className="w-5 h-5" /> },
    ];

    return (
      <div className="space-y-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Factory className="w-5 h-5 text-cyan-600" />
            Target Industries (Beyond RTOs)
          </h3>
          <p className="text-gray-600 mb-4">
            After establishing the RTO market, expand into these 18 industry verticals that require workforce training and compliance.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {industries.map((industry) => (
              <div
                key={industry.name}
                className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-cyan-50 hover:border-cyan-200 transition-colors"
              >
                <span className="text-gray-500">{industry.icon}</span>
                <span className="text-sm font-medium text-gray-700">{industry.name}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Expansion Process</h3>
          <div className="flex flex-wrap gap-2">
            {['1. Identify key players', '2. Understand pain points', '3. Customize messaging', '4. Pilot program', '5. Scale'].map((step, idx) => (
              <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-cyan-50 rounded-full border border-cyan-200">
                <span className="w-6 h-6 bg-cyan-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                  {idx + 1}
                </span>
                <span className="text-sm text-cyan-800">{step.substring(3)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  };

  const renderTechTab = () => {
    const techItems = getItemsByCategory('tech');
    
    return (
      <div className="space-y-6">
        {/* Tech Checklist */}
        <ChecklistSection
          title="Tech Meetings & Milestones"
          category="tech"
          section="meetings"
          items={techItems}
          onToggle={toggleItem}
          onAdd={addItem}
          onUpdate={updateItem}
          onDelete={deleteItem}
        />

        {/* Roadmap Items */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Rocket className="w-5 h-5 text-cyan-600" />
            Technical Roadmap
          </h3>
          <div className="space-y-4">
            {techRoadmapItems.map((item) => (
              <div
                key={item.id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${getCategoryColor(item.category)}`}>
                      {item.icon}
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-800">{item.title}</h4>
                      <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {item.targetDate}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getPriorityColor(item.priority)}`}>
                          {item.priority}
                        </span>
                      </div>
                    </div>
                  </div>
                  {getStatusIcon(item.status)}
                </div>
                {item.details && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {item.details.map((detail, idx) => (
                        <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                          {detail}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview': return renderOverviewTab();
      case 'plan2026': return renderPlan2026Tab();
      case 'platform': return renderPlatformTab();
      case 'marketing': return renderMarketingTab();
      case 'commercial': return renderCommercialTab();
      case 'industry': return renderIndustryTab();
      case 'tech': return renderTechTab();
      default: return renderOverviewTab();
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fb] p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Nytro Strategy & Roadmap</h1>
        <p className="text-gray-600 mt-1">2026 Business Plan, Timeline, and Technical Roadmap</p>
      </div>

      {/* Progress Bar */}
      <Card className="p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Overall Progress</span>
          <span className="text-sm font-bold text-cyan-600">{stats.percentage}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-cyan-500 to-cyan-600 h-2 rounded-full transition-all duration-500"
            style={{ width: `${stats.percentage}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-2">{stats.completed} of {stats.total} tasks completed</p>
      </Card>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              activeTab === tab.id
                ? 'bg-cyan-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {renderTabContent()}
    </div>
  );
}
