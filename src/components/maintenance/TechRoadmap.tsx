import React from 'react';
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
  Cloud,
  Shield,
  ExternalLink
} from 'lucide-react';
import { Card } from '../ui/card';

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

export function TechRoadmap() {
  const roadmapItems: RoadmapItem[] = [
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
      id: 'app-nytro-link',
      title: 'App.nytro.com Website Link',
      description: 'Add app.nytro.com link to the main website for seamless user navigation to the application.',
      targetDate: 'February 2026',
      status: 'planned',
      priority: 'medium',
      icon: <ExternalLink className="w-6 h-6" />,
      category: 'feature',
      details: [
        'Update main website navigation',
        'Add prominent CTA button for app access',
        'Ensure consistent branding across domains',
        'Implement proper redirect handling'
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
        'Subscription tier management',
        'Invoice and receipt generation',
        'Webhook integration for payment events',
        'Credit top-up functionality'
      ]
    },
    {
      id: 'twilio-campaigns',
      title: 'Twilio Email & SMS Campaigns',
      description: 'Add Twilio-powered email and SMS campaign management to admin pages for customer communication.',
      targetDate: 'February 2026',
      status: 'planned',
      priority: 'medium',
      icon: <Mail className="w-6 h-6" />,
      category: 'feature',
      details: [
        'Campaign creation and management interface',
        'Email template builder',
        'SMS notification system',
        'Scheduled campaign delivery',
        'Campaign analytics and reporting',
        'Opt-out and compliance management'
      ]
    },
    {
      id: 'n8n-azure',
      title: 'n8n Hosting Migration to Azure',
      description: 'Migrate n8n workflow automation hosting from current infrastructure to Microsoft Azure.',
      targetDate: 'June 2026',
      status: 'planned',
      priority: 'high',
      icon: <Server className="w-6 h-6" />,
      category: 'infrastructure',
      details: [
        'Azure infrastructure provisioning',
        'n8n deployment configuration',
        'Workflow migration and testing',
        'Performance optimization',
        'Backup and disaster recovery setup',
        'Monitoring and alerting configuration'
      ]
    },
    {
      id: 'data-sovereignty',
      title: 'Google Data Sovereignty Monitoring',
      description: 'Monitor Google\'s response to Australian data sovereignty requirements for Gemini AI. Prepare contingency for Microsoft Azure migration if needed.',
      targetDate: 'December 2026',
      status: 'monitoring',
      priority: 'high',
      icon: <Shield className="w-6 h-6" />,
      category: 'compliance',
      details: [
        'Track Google Gemini data residency announcements',
        'Evaluate Australian data sovereignty compliance',
        'Prepare Azure OpenAI migration plan as fallback',
        'Document data processing locations',
        'Assess impact on current AI workflows',
        'Timeline: Switch to Microsoft Azure by end of year if Google doesn\'t address Australian data sovereignty in Gemini'
      ]
    }
  ];

  const getStatusBadge = (status: RoadmapItem['status']) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
            <CheckCircle2 className="w-3 h-3" /> Completed
          </span>
        );
      case 'in-progress':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
            <Rocket className="w-3 h-3" /> In Progress
          </span>
        );
      case 'monitoring':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
            <AlertTriangle className="w-3 h-3" /> Monitoring
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">
            <Clock className="w-3 h-3" /> Planned
          </span>
        );
    }
  };

  const getPriorityBadge = (priority: RoadmapItem['priority']) => {
    switch (priority) {
      case 'high':
        return <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">High Priority</span>;
      case 'medium':
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">Medium Priority</span>;
      default:
        return <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">Low Priority</span>;
    }
  };

  const getCategoryColor = (category: RoadmapItem['category']) => {
    switch (category) {
      case 'integration':
        return 'border-l-blue-500';
      case 'infrastructure':
        return 'border-l-purple-500';
      case 'feature':
        return 'border-l-green-500';
      case 'compliance':
        return 'border-l-amber-500';
      default:
        return 'border-l-gray-500';
    }
  };

  // Group items by quarter
  const q1Items = roadmapItems.filter(item => item.targetDate.includes('February'));
  const q2Items = roadmapItems.filter(item => item.targetDate.includes('June'));
  const q4Items = roadmapItems.filter(item => item.targetDate.includes('December'));

  const renderRoadmapSection = (title: string, items: RoadmapItem[]) => (
    <div className="mb-10">
      <div className="flex items-center gap-3 mb-6">
        <Calendar className="w-6 h-6 text-[#3b82f6]" />
        <h2 className="text-2xl font-poppins font-bold text-[#1e293b]">{title}</h2>
        <span className="px-3 py-1 bg-[#dbeafe] text-[#3b82f6] text-sm font-medium rounded-full">
          {items.length} items
        </span>
      </div>
      <div className="space-y-4">
        {items.map((item) => (
          <Card
            key={item.id}
            className={`border-l-4 ${getCategoryColor(item.category)} bg-white p-6 hover:shadow-md transition-shadow`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#f1f5f9] rounded-lg text-[#3b82f6]">
                  {item.icon}
                </div>
                <div>
                  <h3 className="text-lg font-poppins font-semibold text-[#1e293b]">{item.title}</h3>
                  <p className="text-sm text-[#64748b]">{item.targetDate}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getPriorityBadge(item.priority)}
                {getStatusBadge(item.status)}
              </div>
            </div>
            <p className="text-[#475569] mb-4">{item.description}</p>
            {item.details && (
              <div className="bg-[#f8fafc] rounded-lg p-4">
                <h4 className="text-sm font-semibold text-[#1e293b] mb-2">Implementation Details:</h4>
                <ul className="space-y-1">
                  {item.details.map((detail, index) => (
                    <li key={index} className="text-sm text-[#64748b] flex items-start gap-2">
                      <span className="text-[#3b82f6] mt-1">•</span>
                      {detail}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8f9fb] p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-4xl font-poppins font-bold text-[#1e293b] mb-2">Technology Roadmap</h1>
          <p className="text-[#64748b] text-lg">Planned features, integrations, and infrastructure updates for 2026</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10">
          <Card className="bg-white p-4 border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Key className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#1e293b]">3</p>
                <p className="text-sm text-[#64748b]">Integrations</p>
              </div>
            </div>
          </Card>
          <Card className="bg-white p-4 border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Rocket className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#1e293b]">2</p>
                <p className="text-sm text-[#64748b]">Features</p>
              </div>
            </div>
          </Card>
          <Card className="bg-white p-4 border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Server className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#1e293b]">1</p>
                <p className="text-sm text-[#64748b]">Infrastructure</p>
              </div>
            </div>
          </Card>
          <Card className="bg-white p-4 border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Shield className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#1e293b]">1</p>
                <p className="text-sm text-[#64748b]">Compliance</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Recommended Updates Summary */}
        <Card className="bg-gradient-to-r from-[#3b82f6] to-[#2563eb] text-white p-6 mb-10">
          <h2 className="text-xl font-poppins font-bold mb-4">Recommended Updates Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold mb-2">February 2026 (Q1)</h3>
              <ul className="text-sm space-y-1 text-blue-100">
                <li>• Keystone API integration for training package data</li>
                <li>• Litmos LMS access via Bill</li>
                <li>• App.nytro.com link on main website</li>
                <li>• Stripe payment gateway setup</li>
                <li>• Twilio email/SMS campaigns in admin</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">June - December 2026</h3>
              <ul className="text-sm space-y-1 text-blue-100">
                <li>• n8n hosting migration to Azure (June)</li>
                <li>• Monitor Google data sovereignty stance</li>
                <li>• Prepare Azure fallback if Google doesn't comply</li>
                <li>• Complete Azure migration by EOY if needed</li>
              </ul>
            </div>
          </div>
        </Card>

        {/* Timeline Sections */}
        {renderRoadmapSection('Q1 2026 - February', q1Items)}
        {renderRoadmapSection('Q2 2026 - June', q2Items)}
        {renderRoadmapSection('Q4 2026 - December', q4Items)}

        {/* Legend */}
        <Card className="bg-white p-6 border mt-10">
          <h3 className="text-lg font-poppins font-semibold text-[#1e293b] mb-4">Legend</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm font-medium text-[#1e293b] mb-2">Status</p>
              <div className="space-y-2">
                {getStatusBadge('planned')}
                {getStatusBadge('in-progress')}
                {getStatusBadge('monitoring')}
                {getStatusBadge('completed')}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-[#1e293b] mb-2">Priority</p>
              <div className="space-y-2">
                {getPriorityBadge('high')}
                {getPriorityBadge('medium')}
                {getPriorityBadge('low')}
              </div>
            </div>
            <div className="md:col-span-2">
              <p className="text-sm font-medium text-[#1e293b] mb-2">Categories</p>
              <div className="space-y-2 text-sm text-[#64748b]">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-500 rounded"></div>
                  <span>Integration - External API/service connections</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-purple-500 rounded"></div>
                  <span>Infrastructure - Hosting and platform changes</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-500 rounded"></div>
                  <span>Feature - New application functionality</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-amber-500 rounded"></div>
                  <span>Compliance - Regulatory and data requirements</span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
