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
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  GripVertical
} from 'lucide-react';
import { Card } from '../ui/card';
import { 
  useStrategyChecklist, 
  useStrategyRoadmap, 
  useStrategyTimeline, 
  useStrategyContent,
  useStrategyStats,
  ChecklistItem,
  RoadmapItem,
  TimelineMilestone,
  ContentBlock
} from '../../hooks/useStrategyData';

// Icon mapping for roadmap items
const iconMap: Record<string, React.ReactNode> = {
  Calendar: <Calendar className="w-5 h-5" />,
  Key: <Key className="w-5 h-5" />,
  Globe: <Globe className="w-5 h-5" />,
  CreditCard: <CreditCard className="w-5 h-5" />,
  Mail: <Mail className="w-5 h-5" />,
  ExternalLink: <ExternalLink className="w-5 h-5" />,
  Server: <Server className="w-5 h-5" />,
  Shield: <Shield className="w-5 h-5" />,
  Rocket: <Rocket className="w-5 h-5" />,
};

type TabId = 'overview' | 'plan2026' | 'platform' | 'marketing' | 'commercial' | 'industry';

// ============ EDITABLE TEXT COMPONENT ============
interface EditableTextProps {
  value: string;
  onSave: (value: string) => Promise<void>;
  className?: string;
  multiline?: boolean;
  placeholder?: string;
}

function EditableText({ value, onSave, className = '', multiline = false, placeholder = 'Click to edit...' }: EditableTextProps) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setText(value); }, [value]);

  const handleSave = async () => {
    if (text !== value) {
      setSaving(true);
      try {
        await onSave(text);
      } catch (err) {
        setText(value);
      } finally {
        setSaving(false);
      }
    }
    setEditing(false);
  };

  if (editing) {
    return multiline ? (
      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
          autoFocus
          className={`w-full p-2 border border-cyan-300 rounded-md focus:ring-2 focus:ring-cyan-500 ${className}`}
          rows={3}
        />
        {saving && <Loader2 className="absolute right-2 top-2 w-4 h-4 animate-spin text-cyan-600" />}
      </div>
    ) : (
      <div className="relative inline-flex items-center">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
          autoFocus
          className={`px-2 py-1 border border-cyan-300 rounded-md focus:ring-2 focus:ring-cyan-500 ${className}`}
        />
        {saving && <Loader2 className="ml-2 w-4 h-4 animate-spin text-cyan-600" />}
      </div>
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className={`cursor-pointer hover:bg-cyan-50 rounded px-1 transition-colors ${className} ${!value ? 'text-gray-400 italic' : ''}`}
    >
      {value || placeholder}
      <Pencil className="inline-block w-3 h-3 ml-1 opacity-0 group-hover:opacity-50" />
    </span>
  );
}

// ============ CALENDAR VIEW COMPONENT ============
interface CalendarViewProps {
  milestones: TimelineMilestone[];
  onUpdateMilestone: (monthKey: string, updates: Partial<TimelineMilestone>) => Promise<void>;
  onAddItem: (monthKey: string, item: string) => Promise<void>;
  onRemoveItem: (monthKey: string, index: number) => Promise<void>;
  onUpdateItem: (monthKey: string, index: number, value: string) => Promise<void>;
}

function CalendarView({ milestones, onUpdateMilestone, onAddItem, onRemoveItem, onUpdateItem }: CalendarViewProps) {
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [newItem, setNewItem] = useState('');
  const [editingItem, setEditingItem] = useState<{ monthKey: string; index: number } | null>(null);
  const [editValue, setEditValue] = useState('');

  const currentMonth = new Date().getMonth() + 1;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'in-progress': return 'bg-blue-500';
      default: return 'bg-gray-300';
    }
  };

  const getMilestoneForMonth = (monthNum: number) => {
    return milestones.find(m => m.month_number === monthNum);
  };

  const handleAddItem = async (monthKey: string) => {
    if (newItem.trim()) {
      await onAddItem(monthKey, newItem.trim());
      setNewItem('');
    }
  };

  const handleStartEdit = (monthKey: string, index: number, currentValue: string) => {
    setEditingItem({ monthKey, index });
    setEditValue(currentValue);
  };

  const handleSaveEdit = async () => {
    if (editingItem && editValue.trim()) {
      await onUpdateItem(editingItem.monthKey, editingItem.index, editValue.trim());
    }
    setEditingItem(null);
    setEditValue('');
  };

  return (
    <div className="space-y-6">
      {/* Calendar Grid */}
      <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2">
        {months.map((month, idx) => {
          const monthNum = idx + 1;
          const milestone = getMilestoneForMonth(monthNum);
          const isCurrentMonth = monthNum === currentMonth;
          const isPast = monthNum < currentMonth;
          
          return (
            <button
              key={month}
              onClick={() => setSelectedMonth(milestone?.month_key || null)}
              className={`relative p-3 rounded-lg border-2 transition-all ${
                selectedMonth === milestone?.month_key
                  ? 'border-cyan-500 bg-cyan-50'
                  : isCurrentMonth
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <div className="text-xs font-medium text-gray-500">{month}</div>
              <div className="text-sm font-semibold text-gray-800 truncate mt-1">
                {milestone?.title || '-'}
              </div>
              <div className={`absolute top-1 right-1 w-2 h-2 rounded-full ${
                milestone ? getStatusColor(milestone.status) : 'bg-gray-200'
              }`} />
              {isCurrentMonth && (
                <div className="absolute -top-1 -left-1 w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
              )}
              {milestone && (
                <div className="text-xs text-gray-400 mt-1">
                  {milestone.items.length} items
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected Month Details */}
      {selectedMonth && (
        <Card className="p-6">
          {(() => {
            const milestone = milestones.find(m => m.month_key === selectedMonth);
            if (!milestone) return null;

            return (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 group">
                      <EditableText
                        value={milestone.title}
                        onSave={(value) => onUpdateMilestone(milestone.month_key, { title: value })}
                      />
                    </h3>
                    <p className="text-sm text-gray-500">{milestone.month_label}</p>
                  </div>
                  <select
                    value={milestone.status}
                    onChange={(e) => onUpdateMilestone(milestone.month_key, { status: e.target.value as any })}
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      milestone.status === 'completed' ? 'bg-green-100 text-green-800' :
                      milestone.status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}
                  >
                    <option value="upcoming">Upcoming</option>
                    <option value="in-progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-700">Milestone Items</h4>
                  {milestone.items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded-md group">
                      <GripVertical className="w-4 h-4 text-gray-300" />
                      {editingItem?.monthKey === milestone.month_key && editingItem?.index === idx ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleSaveEdit}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') setEditingItem(null); }}
                          autoFocus
                          className="flex-1 px-2 py-1 border border-cyan-300 rounded"
                        />
                      ) : (
                        <span
                          className="flex-1 text-sm text-gray-700 cursor-pointer hover:text-cyan-600"
                          onClick={() => handleStartEdit(milestone.month_key, idx, item)}
                        >
                          {item}
                        </span>
                      )}
                      <button
                        onClick={() => onRemoveItem(milestone.month_key, idx)}
                        className="p-1 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  
                  {/* Add new item */}
                  <div className="flex items-center gap-2 mt-3">
                    <input
                      type="text"
                      value={newItem}
                      onChange={(e) => setNewItem(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddItem(milestone.month_key); }}
                      placeholder="Add new item..."
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-cyan-500"
                    />
                    <button
                      onClick={() => handleAddItem(milestone.month_key)}
                      className="px-3 py-2 bg-cyan-600 text-white rounded-md hover:bg-cyan-700"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </Card>
      )}
    </div>
  );
}

// ============ CHECKLIST SECTION COMPONENT ============
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
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState({ title: '', description: '', priority: 'medium' as const });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const sectionItems = items.filter(item => item.section === section);
  const completedCount = sectionItems.filter(item => item.completed).length;

  const handleAdd = async () => {
    if (newItem.title.trim()) {
      await onAdd({
        item_id: `${section}-${Date.now()}`,
        category,
        section,
        title: newItem.title,
        description: newItem.description || null,
        priority: newItem.priority,
        sort_order: sectionItems.length + 1,
      });
      setNewItem({ title: '', description: '', priority: 'medium' });
      setShowAddForm(false);
    }
  };

  return (
    <Card className="p-4">
      <div className="flex justify-between items-center mb-3">
        <div>
          <h4 className="font-semibold text-gray-800">{title}</h4>
          <p className="text-sm text-gray-500">{completedCount}/{sectionItems.length} completed</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-cyan-50 text-cyan-700 rounded-md hover:bg-cyan-100"
        >
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>

      {showAddForm && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg space-y-2">
          <input
            type="text"
            value={newItem.title}
            onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
            placeholder="Task title..."
            className="w-full px-3 py-2 border border-gray-200 rounded-md"
            autoFocus
          />
          <input
            type="text"
            value={newItem.description}
            onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
            placeholder="Description (optional)..."
            className="w-full px-3 py-2 border border-gray-200 rounded-md"
          />
          <div className="flex items-center gap-2">
            <select
              value={newItem.priority}
              onChange={(e) => setNewItem({ ...newItem, priority: e.target.value as any })}
              className="px-3 py-2 border border-gray-200 rounded-md"
            >
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>
            <button onClick={handleAdd} className="px-4 py-2 bg-cyan-600 text-white rounded-md hover:bg-cyan-700">
              Add Task
            </button>
            <button onClick={() => setShowAddForm(false)} className="px-4 py-2 text-gray-600 hover:text-gray-800">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {sectionItems.map((item) => (
          <div
            key={item.item_id}
            className={`flex items-start gap-3 p-2 rounded-md hover:bg-gray-50 group ${item.completed ? 'opacity-60' : ''}`}
          >
            <button onClick={() => onToggle(item.item_id)} className="mt-0.5 flex-shrink-0">
              {item.completed ? (
                <CheckSquare className="w-5 h-5 text-green-600" />
              ) : (
                <Square className="w-5 h-5 text-gray-400 hover:text-cyan-600" />
              )}
            </button>
            <div className="flex-1 min-w-0">
              <div className="group">
                <EditableText
                  value={item.title}
                  onSave={(value) => onUpdate(item.item_id, { title: value })}
                  className={`text-sm ${item.completed ? 'line-through text-gray-500' : 'text-gray-700'}`}
                />
              </div>
              {item.description && (
                <div className="group">
                  <EditableText
                    value={item.description}
                    onSave={(value) => onUpdate(item.item_id, { description: value })}
                    className="text-xs text-gray-500"
                  />
                </div>
              )}
              <div className="flex items-center gap-2 mt-1">
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
              {deleteConfirm === item.item_id ? (
                <>
                  <button onClick={() => { onDelete(item.item_id); setDeleteConfirm(null); }} className="p-1 text-red-600">
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => setDeleteConfirm(null)} className="p-1 text-gray-400">
                    <X className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <button onClick={() => setDeleteConfirm(item.item_id)} className="p-1 text-gray-400 hover:text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
        {sectionItems.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">No items yet. Click "Add" to create one.</p>
        )}
      </div>
    </Card>
  );
}

// ============ ROADMAP ITEM COMPONENT ============
interface RoadmapItemCardProps {
  item: RoadmapItem;
  onUpdate: (itemId: string, updates: Partial<RoadmapItem>) => Promise<void>;
  onDelete: (itemId: string) => Promise<void>;
}

function RoadmapItemCard({ item, onUpdate, onDelete }: RoadmapItemCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [editingDetail, setEditingDetail] = useState<number | null>(null);
  const [newDetail, setNewDetail] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const handleAddDetail = async () => {
    if (newDetail.trim()) {
      await onUpdate(item.item_id, { details: [...item.details, newDetail.trim()] });
      setNewDetail('');
    }
  };

  const handleUpdateDetail = async (index: number, value: string) => {
    const newDetails = [...item.details];
    newDetails[index] = value;
    await onUpdate(item.item_id, { details: newDetails });
    setEditingDetail(null);
  };

  const handleRemoveDetail = async (index: number) => {
    const newDetails = item.details.filter((_, i) => i !== index);
    await onUpdate(item.item_id, { details: newDetails });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in-progress': return 'bg-blue-100 text-blue-800';
      case 'monitoring': return 'bg-amber-100 text-amber-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-cyan-50 rounded-lg text-cyan-600">
          {iconMap[item.icon || 'Rocket'] || <Rocket className="w-5 h-5" />}
        </div>
        <div className="flex-1">
          <div className="flex items-start justify-between">
            <div className="group flex-1">
              <EditableText
                value={item.title}
                onSave={(value) => onUpdate(item.item_id, { title: value })}
                className="font-semibold text-gray-800"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={item.status}
                onChange={(e) => onUpdate(item.item_id, { status: e.target.value as any })}
                className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}
              >
                <option value="planned">Planned</option>
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="monitoring">Monitoring</option>
              </select>
              {deleteConfirm ? (
                <div className="flex items-center gap-1">
                  <button onClick={() => onDelete(item.item_id)} className="p-1 text-red-600">
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => setDeleteConfirm(false)} className="p-1 text-gray-400">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button onClick={() => setDeleteConfirm(true)} className="p-1 text-gray-400 hover:text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          
          <div className="group mt-1">
            <EditableText
              value={item.description || ''}
              onSave={(value) => onUpdate(item.item_id, { description: value })}
              className="text-sm text-gray-600"
              multiline
              placeholder="Add description..."
            />
          </div>

          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <EditableText
                value={item.target_date || ''}
                onSave={(value) => onUpdate(item.item_id, { target_date: value })}
                placeholder="Set target date..."
              />
            </span>
            <select
              value={item.priority}
              onChange={(e) => onUpdate(item.item_id, { priority: e.target.value as any })}
              className={`px-2 py-0.5 rounded text-xs ${
                item.priority === 'high' ? 'bg-red-50 text-red-700' :
                item.priority === 'medium' ? 'bg-yellow-50 text-yellow-700' :
                'bg-gray-50 text-gray-600'
              }`}
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* Expandable Details */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-3 text-xs text-cyan-600 hover:text-cyan-700"
          >
            {expanded ? 'Hide details' : `Show details (${item.details.length})`}
          </button>

          {expanded && (
            <div className="mt-3 space-y-2 pl-2 border-l-2 border-cyan-100">
              {item.details.map((detail, idx) => (
                <div key={idx} className="flex items-center gap-2 group">
                  <CheckCircle2 className="w-3 h-3 text-gray-400 flex-shrink-0" />
                  {editingDetail === idx ? (
                    <input
                      type="text"
                      defaultValue={detail}
                      onBlur={(e) => handleUpdateDetail(idx, e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleUpdateDetail(idx, (e.target as HTMLInputElement).value); }}
                      autoFocus
                      className="flex-1 text-sm px-2 py-1 border border-cyan-300 rounded"
                    />
                  ) : (
                    <span
                      className="flex-1 text-sm text-gray-600 cursor-pointer hover:text-cyan-600"
                      onClick={() => setEditingDetail(idx)}
                    >
                      {detail}
                    </span>
                  )}
                  <button
                    onClick={() => handleRemoveDetail(idx)}
                    className="p-1 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="text"
                  value={newDetail}
                  onChange={(e) => setNewDetail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddDetail(); }}
                  placeholder="Add detail..."
                  className="flex-1 text-sm px-2 py-1 border border-gray-200 rounded"
                />
                <button onClick={handleAddDetail} className="p-1 text-cyan-600 hover:text-cyan-700">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

// ============ ADD ROADMAP ITEM FORM ============
interface AddRoadmapFormProps {
  onAdd: (item: Partial<RoadmapItem>) => Promise<RoadmapItem>;
  onCancel: () => void;
}

function AddRoadmapForm({ onAdd, onCancel }: AddRoadmapFormProps) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    target_date: '',
    priority: 'medium' as const,
    status: 'planned' as const,
    icon: 'Rocket',
  });

  const handleSubmit = async () => {
    if (form.title.trim()) {
      await onAdd({
        item_id: `roadmap-${Date.now()}`,
        ...form,
        category: 'platform',
        details: [],
        sort_order: 100,
      });
      onCancel();
    }
  };

  return (
    <Card className="p-4 border-2 border-dashed border-cyan-300 bg-cyan-50">
      <h4 className="font-semibold text-gray-800 mb-3">Add New Roadmap Item</h4>
      <div className="space-y-3">
        <input
          type="text"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="Title..."
          className="w-full px-3 py-2 border border-gray-200 rounded-md"
          autoFocus
        />
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Description..."
          rows={2}
          className="w-full px-3 py-2 border border-gray-200 rounded-md"
        />
        <div className="grid grid-cols-2 gap-3">
          <input
            type="text"
            value={form.target_date}
            onChange={(e) => setForm({ ...form, target_date: e.target.value })}
            placeholder="Target date..."
            className="px-3 py-2 border border-gray-200 rounded-md"
          />
          <select
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value as any })}
            className="px-3 py-2 border border-gray-200 rounded-md"
          >
            <option value="high">High Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="low">Low Priority</option>
          </select>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 text-gray-600 hover:text-gray-800">
            Cancel
          </button>
          <button onClick={handleSubmit} className="px-4 py-2 bg-cyan-600 text-white rounded-md hover:bg-cyan-700">
            Add Item
          </button>
        </div>
      </div>
    </Card>
  );
}

// ============ MAIN COMPONENT ============
export function NytroStrategyRoadmap() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [showAddRoadmap, setShowAddRoadmap] = useState(false);

  // Data hooks
  const checklist = useStrategyChecklist();
  const roadmap = useStrategyRoadmap();
  const timeline = useStrategyTimeline();
  const content = useStrategyContent();
  const stats = useStrategyStats(checklist.items, roadmap.items);

  const loading = checklist.loading || roadmap.loading || timeline.loading || content.loading;
  const error = checklist.error || roadmap.error || timeline.error || content.error;

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <Target className="w-4 h-4" /> },
    { id: 'plan2026', label: '2026 Plan', icon: <Calendar className="w-4 h-4" /> },
    { id: 'platform', label: 'Platform & Systems', icon: <Server className="w-4 h-4" /> },
    { id: 'marketing', label: 'Marketing', icon: <Megaphone className="w-4 h-4" /> },
    { id: 'commercial', label: 'Commercial', icon: <DollarSign className="w-4 h-4" /> },
    { id: 'industry', label: 'Industry', icon: <Factory className="w-4 h-4" /> },
  ];

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f9fb] p-8 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-600">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading strategy data...</span>
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
            <span className="text-red-800">Error: {error}</span>
          </div>
          <button
            onClick={() => { checklist.fetchItems(); roadmap.fetchItems(); timeline.fetchMilestones(); content.fetchBlocks(); }}
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
      {/* Progress Overview */}
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-cyan-600" />
            Overall Progress
          </h3>
          <button
            onClick={() => { checklist.fetchItems(); roadmap.fetchItems(); }}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-cyan-600"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>{stats.checklistCompleted} of {stats.checklistTotal} tasks completed</span>
            <span>{stats.checklistPercentage}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-cyan-500 to-cyan-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${stats.checklistPercentage}%` }}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-cyan-50 rounded-lg p-3 border border-cyan-200">
            <p className="text-xs text-cyan-600 uppercase">Tasks</p>
            <p className="text-2xl font-bold text-cyan-700">{stats.checklistCompleted}/{stats.checklistTotal}</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
            <p className="text-xs text-blue-600 uppercase">Roadmap Items</p>
            <p className="text-2xl font-bold text-blue-700">{stats.roadmapTotal}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3 border border-green-200">
            <p className="text-xs text-green-600 uppercase">Completed</p>
            <p className="text-2xl font-bold text-green-700">{stats.roadmapCompleted}</p>
          </div>
          <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
            <p className="text-xs text-amber-600 uppercase">In Progress</p>
            <p className="text-2xl font-bold text-amber-700">{stats.roadmapInProgress}</p>
          </div>
        </div>
      </Card>

      {/* Key Messaging */}
      <Card className="p-6 bg-blue-50 border-blue-200">
        <h3 className="text-lg font-semibold text-blue-800 mb-3 flex items-center gap-2">
          <Megaphone className="w-5 h-5" />
          Key Messaging Reminder
        </h3>
        <div className="group">
          <EditableText
            value={content.getBlock('overview-messaging')?.content || 'The messaging around Nytro must stay away from compliance and efficiency language. Focus on generating income, streamlining day-to-day workload, and reducing pressure on business owners and managers.'}
            onSave={(value) => content.updateBlock('overview-messaging', { content: value })}
            className="text-blue-700"
            multiline
          />
        </div>
      </Card>

      {/* 12-Month Calendar View */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-cyan-600" />
          12-Month Timeline
        </h3>
        <CalendarView
          milestones={timeline.milestones}
          onUpdateMilestone={timeline.updateMilestone}
          onAddItem={timeline.addMilestoneItem}
          onRemoveItem={timeline.removeMilestoneItem}
          onUpdateItem={timeline.updateMilestoneItem}
        />
      </Card>
    </div>
  );

  const renderPlan2026Tab = () => (
    <div className="space-y-6">
      <CalendarView
        milestones={timeline.milestones}
        onUpdateMilestone={timeline.updateMilestone}
        onAddItem={timeline.addMilestoneItem}
        onRemoveItem={timeline.removeMilestoneItem}
        onUpdateItem={timeline.updateMilestoneItem}
      />

      <ChecklistSection
        title="Week 19 January Tasks"
        category="plan2026"
        section="week-19-jan"
        items={checklist.items}
        onToggle={checklist.toggleItem}
        onAdd={checklist.addItem}
        onUpdate={checklist.updateItem}
        onDelete={checklist.deleteItem}
      />

      <ChecklistSection
        title="Week 27 January Tasks"
        category="plan2026"
        section="week-27-jan"
        items={checklist.items}
        onToggle={checklist.toggleItem}
        onAdd={checklist.addItem}
        onUpdate={checklist.updateItem}
        onDelete={checklist.deleteItem}
      />

      <ChecklistSection
        title="February Focus"
        category="plan2026"
        section="february"
        items={checklist.items}
        onToggle={checklist.toggleItem}
        onAdd={checklist.addItem}
        onUpdate={checklist.updateItem}
        onDelete={checklist.deleteItem}
      />
    </div>
  );

  const renderPlatformTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-800">Platform & Systems Roadmap</h3>
        <button
          onClick={() => setShowAddRoadmap(!showAddRoadmap)}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-md hover:bg-cyan-700"
        >
          <Plus className="w-4 h-4" /> Add Item
        </button>
      </div>

      {showAddRoadmap && (
        <AddRoadmapForm
          onAdd={roadmap.addItem}
          onCancel={() => setShowAddRoadmap(false)}
        />
      )}

      <div className="space-y-4">
        {roadmap.items.map((item) => (
          <RoadmapItemCard
            key={item.item_id}
            item={item}
            onUpdate={roadmap.updateItem}
            onDelete={roadmap.deleteItem}
          />
        ))}
      </div>

      <ChecklistSection
        title="Platform Tasks"
        category="platform"
        section="api-connections"
        items={checklist.items}
        onToggle={checklist.toggleItem}
        onAdd={checklist.addItem}
        onUpdate={checklist.updateItem}
        onDelete={checklist.deleteItem}
      />
    </div>
  );

  const renderMarketingTab = () => (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">LinkedIn Strategy</h3>
        <div className="group">
          <EditableText
            value={content.getBlock('marketing-linkedin')?.content || 'Post on LinkedIn weekly to maintain visibility and momentum. Targeted LinkedIn and Meta advertising campaigns for RTO market.'}
            onSave={(value) => content.updateBlock('marketing-linkedin', { content: value })}
            className="text-gray-600"
            multiline
          />
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Email Branding</h3>
        <div className="group">
          <EditableText
            value={content.getBlock('marketing-email')?.content || 'Email templates and introductory messaging finalised with consistent Nytro branding.'}
            onSave={(value) => content.updateBlock('marketing-email', { content: value })}
            className="text-gray-600"
            multiline
          />
        </div>
      </Card>

      <Card className="p-6 bg-cyan-50 border-cyan-200">
        <h3 className="text-lg font-semibold text-cyan-800 mb-2">Introductory Pricing</h3>
        <div className="group">
          <EditableText
            value={content.getBlock('marketing-pricing')?.content || '$99 - Special launch offer for early adopters'}
            onSave={(value) => content.updateBlock('marketing-pricing', { content: value })}
            className="text-2xl font-bold text-cyan-600"
          />
        </div>
      </Card>
    </div>
  );

  const renderCommercialTab = () => (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Revenue Streams</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {['Subscriptions', 'Credit Purchases', 'White Label', 'Consulting'].map((stream) => (
            <div key={stream} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="font-medium text-gray-800">{stream}</h4>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Pricing</h3>
        <div className="group">
          <EditableText
            value={content.getBlock('commercial-premarking')?.content || '~$0.04 per question'}
            onSave={(value) => content.updateBlock('commercial-premarking', { content: value })}
            className="text-gray-600"
          />
        </div>
      </Card>
    </div>
  );

  const renderIndustryTab = () => {
    const industries = [
      'Transport & Logistics', 'Construction', 'Civil', 'Mining', 'Warehousing', 'Manufacturing',
      'Real Estate', 'Security', 'Cleaning', 'Facilities Management', 'Aviation Ground Ops',
      'Ports & Stevedoring', 'Utilities', 'Telecommunications', 'Waste Management',
      'Traffic Control', 'Labour Hire', 'Local Government'
    ];

    return (
      <div className="space-y-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Target Industries (Beyond RTOs)</h3>
          <div className="group mb-4">
            <EditableText
              value={content.getBlock('industry-expansion')?.content || 'After establishing the RTO market, expand into 18 industry verticals that require workforce training and compliance.'}
              onSave={(value) => content.updateBlock('industry-expansion', { content: value })}
              className="text-gray-600"
              multiline
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {industries.map((industry) => (
              <div key={industry} className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-cyan-50 hover:border-cyan-200 transition-colors">
                <span className="text-sm font-medium text-gray-700">{industry}</span>
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
      default: return renderOverviewTab();
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fb] p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Nytro Strategy & Roadmap</h1>
        <p className="text-gray-600 mt-1">2026 Business Plan, Timeline, and Project Tracking</p>
      </div>

      {/* Progress Bar */}
      <Card className="p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Overall Progress</span>
          <span className="text-sm font-bold text-cyan-600">{stats.checklistPercentage}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-cyan-500 to-cyan-600 h-2 rounded-full transition-all duration-500"
            style={{ width: `${stats.checklistPercentage}%` }}
          />
        </div>
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
