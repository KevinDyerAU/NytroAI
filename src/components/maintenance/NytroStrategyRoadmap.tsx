import React, { useState } from 'react';
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
  MapPin
} from 'lucide-react';
import { Card } from '../ui/card';

// Types
interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

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

export function NytroStrategyRoadmap() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  
  // State for checklist items
  const [checklistItems, setChecklistItems] = useState<Record<string, boolean>>({
    // Week 19 Jan
    'contact-cloud-assess': false,
    'api-meeting-kevin-luke': false,
    'payment-portal-setup': false,
    'website-finished': false,
    'email-templates': false,
    'bank-accounts-active': false,
    // Week 27 Jan
    'simon-national-visit': false,
    'litmos-admin-access': false,
    'pricing-loaded': false,
    'marketing-campaigns-live': false,
    'rto-demos': false,
    'rto-calling': false,
    'linkedin-meta-ads': false,
    // February
    'consultant-followup': false,
    'interstate-rtos': false,
    'ammonite-api': false,
    'weekly-linkedin': false,
    // Platform
    'keystone-api': false,
    'litmos-api': false,
    'terms-acknowledgement': false,
    'referral-document': false,
    'white-label-review': false,
    // Tech
    'keystone-meeting-23oct': true,
  });

  const toggleCheckbox = (id: string) => {
    setChecklistItems(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Calculate progress
  const totalItems = Object.keys(checklistItems).length;
  const completedItems = Object.values(checklistItems).filter(Boolean).length;
  const progressPercent = Math.round((completedItems / totalItems) * 100);

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
        'Campaign analytics and reporting'
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
        'Backup and disaster recovery setup'
      ]
    },
    {
      id: 'data-sovereignty',
      title: 'Google Data Sovereignty Monitoring',
      description: 'Monitor Google\'s response to Australian data sovereignty requirements for Gemini AI.',
      targetDate: 'December 2026',
      status: 'monitoring',
      priority: 'high',
      icon: <Shield className="w-6 h-6" />,
      category: 'compliance',
      details: [
        'Track Google Gemini data residency announcements',
        'Evaluate Australian data sovereignty compliance',
        'Prepare Azure OpenAI migration plan as fallback',
        'Switch to Microsoft Azure by end of year if needed'
      ]
    }
  ];

  const tabs = [
    { id: 'overview' as TabId, label: 'Overview', icon: <Target className="w-4 h-4" /> },
    { id: 'plan2026' as TabId, label: '2026 Plan', icon: <Calendar className="w-4 h-4" /> },
    { id: 'platform' as TabId, label: 'Platform & Systems', icon: <Server className="w-4 h-4" /> },
    { id: 'marketing' as TabId, label: 'Marketing', icon: <Megaphone className="w-4 h-4" /> },
    { id: 'commercial' as TabId, label: 'Commercial Model', icon: <DollarSign className="w-4 h-4" /> },
    { id: 'industry' as TabId, label: 'Industry Expansion', icon: <Factory className="w-4 h-4" /> },
    { id: 'tech' as TabId, label: 'Tech Roadmap', icon: <Rocket className="w-4 h-4" /> },
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

  const ChecklistItemComponent = ({ id, text, checked }: { id: string; text: string; checked: boolean }) => (
    <div 
      className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
      onClick={() => toggleCheckbox(id)}
    >
      {checked ? (
        <CheckSquare className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
      ) : (
        <Square className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
      )}
      <span className={`text-sm ${checked ? 'text-gray-500 line-through' : 'text-gray-700'}`}>{text}</span>
    </div>
  );

  // Render 12-month timeline
  const renderTimeline = () => (
    <div className="mb-8">
      <h2 className="text-xl font-poppins font-bold text-[#1e293b] mb-4">12-Month Timeline</h2>
      <div className="relative">
        {/* Progress bar */}
        <div className="absolute top-6 left-0 right-0 h-2 bg-gray-200 rounded-full">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        
        {/* Timeline items */}
        <div className="grid grid-cols-12 gap-1 pt-12">
          {timelineMilestones.map((milestone, index) => (
            <div key={milestone.id} className="text-center">
              <div className={`w-3 h-3 mx-auto rounded-full mb-2 ${
                milestone.status === 'completed' ? 'bg-green-500' :
                milestone.status === 'in-progress' ? 'bg-blue-500 animate-pulse' :
                'bg-gray-300'
              }`} />
              <p className="text-xs font-medium text-gray-600">{milestone.month.split(' ')[0]}</p>
              <p className="text-[10px] text-gray-400 mt-1 hidden lg:block">{milestone.title}</p>
            </div>
          ))}
        </div>
      </div>
      
      {/* Progress summary */}
      <div className="mt-6 flex items-center justify-between bg-gradient-to-r from-blue-50 to-green-50 p-4 rounded-lg">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-6 h-6 text-blue-600" />
          <div>
            <p className="text-sm font-semibold text-gray-800">Overall Progress</p>
            <p className="text-xs text-gray-600">{completedItems} of {totalItems} tasks completed</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-blue-600">{progressPercent}%</p>
          <p className="text-xs text-gray-500">Complete</p>
        </div>
      </div>
    </div>
  );

  // Tab content renderers
  const renderOverview = () => (
    <div className="space-y-6">
      {renderTimeline()}
      
      <Card className="bg-gradient-to-r from-[#3b82f6] to-[#2563eb] text-white p-6">
        <h2 className="text-xl font-poppins font-bold mb-4">Nytro 2026 Six Month Plan</h2>
        <p className="text-blue-100 mb-4">
          This plan is focused on getting Nytro moving in 2026. The key priority is <strong className="text-white">sales activity and volume</strong>, 
          while continuing to improve the platform in the background.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div className="bg-white/10 rounded-lg p-4">
            <Target className="w-8 h-8 mb-2" />
            <h3 className="font-semibold">Revenue Target</h3>
            <p className="text-2xl font-bold">$10,000</p>
            <p className="text-sm text-blue-200">by end of February</p>
          </div>
          <div className="bg-white/10 rounded-lg p-4">
            <Users className="w-8 h-8 mb-2" />
            <h3 className="font-semibold">Focus</h3>
            <p className="text-lg font-bold">Sales Volume</p>
            <p className="text-sm text-blue-200">Get system in front of people</p>
          </div>
          <div className="bg-white/10 rounded-lg p-4">
            <Megaphone className="w-8 h-8 mb-2" />
            <h3 className="font-semibold">Messaging</h3>
            <p className="text-lg font-bold">Income Focus</p>
            <p className="text-sm text-blue-200">Not compliance language</p>
          </div>
        </div>
      </Card>

      <Card className="bg-amber-50 border-amber-200 p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-amber-800">Key Messaging Reminder</h3>
            <p className="text-amber-700 mt-1">
              The messaging around Nytro must stay away from compliance and efficiency language. 
              Focus on <strong>generating income</strong>, <strong>streamlining day-to-day workload</strong>, 
              and <strong>reducing pressure on business owners and managers</strong>.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 border">
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            Weekly Planning Meeting
          </h3>
          <p className="text-gray-600 mb-4">
            Lock in a regular Nytro planning meeting each week. Ideally on a Friday, 
            or another consistent day that works for everyone.
          </p>
          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Purpose:</strong> Review progress and make decisions weekly rather than letting things drift.
            </p>
          </div>
        </Card>

        <Card className="p-6 border">
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <Phone className="w-5 h-5 text-green-600" />
            CEO Outreach
          </h3>
          <p className="text-gray-600 mb-4">
            Create a short, catchy text-style message that can be sent directly to CEOs.
          </p>
          <div className="bg-green-50 p-3 rounded-lg">
            <p className="text-sm text-green-800">
              <strong>Style:</strong> Simple, clear, and focused on opportunity rather than regulation.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );

  const renderPlan2026 = () => (
    <div className="space-y-6">
      {renderTimeline()}
      
      <Card className="p-6 border">
        <h2 className="text-xl font-poppins font-bold text-[#1e293b] mb-4 flex items-center gap-2">
          <Calendar className="w-6 h-6 text-blue-600" />
          Week Commencing 19 January
        </h2>
        <div className="space-y-1">
          <ChecklistItemComponent id="contact-cloud-assess" text="Richard to contact Andrew from Cloud Assess" checked={checklistItems['contact-cloud-assess']} />
          <ChecklistItemComponent id="api-meeting-kevin-luke" text="Meeting with Kevin and Luke's IT representative to work through API connections" checked={checklistItems['api-meeting-kevin-luke']} />
          <ChecklistItemComponent id="payment-portal-setup" text="Payment portal fully set up and working" checked={checklistItems['payment-portal-setup']} />
          <ChecklistItemComponent id="website-finished" text="Website finished and ready to send to prospective clients" checked={checklistItems['website-finished']} />
          <ChecklistItemComponent id="email-templates" text="Email templates and introductory messaging finalised" checked={checklistItems['email-templates']} />
          <ChecklistItemComponent id="bank-accounts-active" text="Bank accounts and credit card processing confirmed and active" checked={checklistItems['bank-accounts-active']} />
        </div>
      </Card>

      <Card className="p-6 border">
        <h2 className="text-xl font-poppins font-bold text-[#1e293b] mb-4 flex items-center gap-2">
          <Calendar className="w-6 h-6 text-purple-600" />
          Week Commencing 27 January
        </h2>
        <div className="space-y-1">
          <ChecklistItemComponent id="simon-national-visit" text="Richard to attend Simon National to meet with Bill" checked={checklistItems['simon-national-visit']} />
          <ChecklistItemComponent id="litmos-admin-access" text="Obtain admin access to Litmos" checked={checklistItems['litmos-admin-access']} />
          <ChecklistItemComponent id="pricing-loaded" text="Introductory pricing confirmed and loaded into online payment portal" checked={checklistItems['pricing-loaded']} />
          <ChecklistItemComponent id="marketing-campaigns-live" text="All marketing campaigns live" checked={checklistItems['marketing-campaigns-live']} />
          <ChecklistItemComponent id="rto-demos" text="Richard and Adam to contact RTO consultants and run live demos" checked={checklistItems['rto-demos']} />
          <ChecklistItemComponent id="rto-calling" text="Richard and Adam to spend time calling RTOs using Training.gov.au spreadsheet" checked={checklistItems['rto-calling']} />
          <ChecklistItemComponent id="linkedin-meta-ads" text="LinkedIn and Meta advertising campaigns commenced for RTO market" checked={checklistItems['linkedin-meta-ads']} />
        </div>
        <div className="mt-4 bg-green-50 p-4 rounded-lg">
          <p className="text-green-800 font-semibold flex items-center gap-2">
            <Target className="w-5 h-5" />
            Target: Generate $10,000 in revenue by end of February
          </p>
        </div>
      </Card>

      <Card className="p-6 border">
        <h2 className="text-xl font-poppins font-bold text-[#1e293b] mb-4 flex items-center gap-2">
          <Calendar className="w-6 h-6 text-green-600" />
          February Focus
        </h2>
        <p className="text-gray-600 mb-4">February is focused on sales activity and follow up.</p>
        <div className="space-y-1">
          <ChecklistItemComponent id="consultant-followup" text="Continue following up consultants and clearly showing what the system can do" checked={checklistItems['consultant-followup']} />
          <ChecklistItemComponent id="interstate-rtos" text="Contact RTOs in other states and offer introductory trial" checked={checklistItems['interstate-rtos']} />
          <ChecklistItemComponent id="ammonite-api" text="Follow up with Andrew Gimble and Ammonite regarding access to their API" checked={checklistItems['ammonite-api']} />
          <ChecklistItemComponent id="weekly-linkedin" text="Post on LinkedIn weekly to maintain visibility and momentum" checked={checklistItems['weekly-linkedin']} />
        </div>
        <div className="mt-4 bg-blue-50 p-4 rounded-lg">
          <p className="text-blue-800">
            <strong>Key Focus:</strong> Volume and numbers. Getting the system in front of people is more important than refining everything perfectly at this stage.
          </p>
        </div>
      </Card>
    </div>
  );

  const renderPlatform = () => (
    <div className="space-y-6">
      <Card className="p-6 border">
        <h2 className="text-xl font-poppins font-bold text-[#1e293b] mb-4 flex items-center gap-2">
          <Key className="w-6 h-6 text-blue-600" />
          API Connections Priority
        </h2>
        <p className="text-gray-600 mb-4">API connections are a priority to other software systems.</p>
        <div className="space-y-1">
          <ChecklistItemComponent id="keystone-api" text="Luke & Richard continue working on API link for Kevin to implement" checked={checklistItems['keystone-api']} />
          <ChecklistItemComponent id="litmos-api" text="Contact Brendan for API connection link to Litmos" checked={checklistItems['litmos-api']} />
        </div>
        <div className="mt-4 bg-gray-50 p-4 rounded-lg">
          <p className="text-gray-700">
            Review other trucking and transport systems that use Litmos or similar platforms to understand how Nytro can integrate into their environments.
          </p>
        </div>
      </Card>

      <Card className="p-6 border">
        <h2 className="text-xl font-poppins font-bold text-[#1e293b] mb-4 flex items-center gap-2">
          <FileText className="w-6 h-6 text-purple-600" />
          Mandatory Documents
        </h2>
        <div className="space-y-1">
          <ChecklistItemComponent id="terms-acknowledgement" text="Mandatory acknowledgement of terms built into Nytro (scroll and sign process)" checked={checklistItems['terms-acknowledgement']} />
          <ChecklistItemComponent id="referral-document" text="Referral document customised and converted to scroll and sign format" checked={checklistItems['referral-document']} />
        </div>
        <div className="mt-4 bg-amber-50 p-4 rounded-lg">
          <p className="text-amber-800">
            <strong>Important:</strong> Before anyone can pay or access the system, users must complete the terms acknowledgement process.
          </p>
        </div>
      </Card>

      <Card className="p-6 border">
        <h2 className="text-xl font-poppins font-bold text-[#1e293b] mb-4 flex items-center gap-2">
          <Building2 className="w-6 h-6 text-green-600" />
          White Labelling Review
        </h2>
        <div className="space-y-1">
          <ChecklistItemComponent id="white-label-review" text="Luke platform - review if white labelling is realistic or if ongoing upkeep creates too much overhead" checked={checklistItems['white-label-review']} />
        </div>
      </Card>
    </div>
  );

  const renderMarketing = () => (
    <div className="space-y-6">
      <Card className="bg-gradient-to-r from-pink-500 to-purple-600 text-white p-6">
        <h2 className="text-xl font-poppins font-bold mb-4">Marketing Foundations</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white/10 rounded-lg p-4">
            <Linkedin className="w-8 h-8 mb-2" />
            <h3 className="font-semibold">LinkedIn Presence</h3>
            <p className="text-sm text-pink-100">Dedicated page for visibility and engagement</p>
          </div>
          <div className="bg-white/10 rounded-lg p-4">
            <Globe className="w-8 h-8 mb-2" />
            <h3 className="font-semibold">Website</h3>
            <p className="text-sm text-pink-100">Flyer-style landing page or clean website link</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 border">
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-600" />
            Email & Branding
          </h3>
          <ul className="space-y-2 text-gray-600">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
              All team members need Nytro email addresses
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
              Branded email signatures for consistency
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
              Follow-up email templates for consistent messaging
            </li>
          </ul>
        </Card>

        <Card className="p-6 border">
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            Introductory Pricing
          </h3>
          <div className="text-center py-4">
            <p className="text-4xl font-bold text-green-600">$99</p>
            <p className="text-gray-500">Introductory offer to reduce barriers to entry</p>
          </div>
        </Card>
      </div>

      <Card className="p-6 border">
        <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-purple-600" />
          Banking & Payments
        </h3>
        <ul className="space-y-2 text-gray-600">
          <li className="flex items-start gap-2">
            <Square className="w-4 h-4 text-gray-400 mt-1 flex-shrink-0" />
            Credit card facilities finalised
          </li>
          <li className="flex items-start gap-2">
            <Square className="w-4 h-4 text-gray-400 mt-1 flex-shrink-0" />
            Online payment portal operational
          </li>
          <li className="flex items-start gap-2">
            <Square className="w-4 h-4 text-gray-400 mt-1 flex-shrink-0" />
            Bank accounts confirmed and active
          </li>
        </ul>
      </Card>

      <Card className="p-6 border bg-blue-50">
        <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-blue-600" />
          Advertising Campaigns
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-lg">
            <Linkedin className="w-6 h-6 text-blue-700 mb-2" />
            <p className="font-medium">LinkedIn Ads</p>
            <p className="text-sm text-gray-500">RTO market targeting</p>
          </div>
          <div className="bg-white p-4 rounded-lg">
            <Globe className="w-6 h-6 text-blue-600 mb-2" />
            <p className="font-medium">Meta Ads</p>
            <p className="text-sm text-gray-500">Facebook & Instagram</p>
          </div>
        </div>
      </Card>
    </div>
  );

  const renderCommercial = () => (
    <div className="space-y-6">
      <Card className="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-6">
        <h2 className="text-xl font-poppins font-bold mb-4">Commercial Model</h2>
        <p className="text-green-100">We need clarity around the commercial model. Income will come from multiple streams.</p>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border text-center">
          <Building2 className="w-8 h-8 mx-auto mb-2 text-blue-600" />
          <h3 className="font-semibold">RTO Subscriptions</h3>
          <p className="text-sm text-gray-500">Recurring revenue</p>
        </Card>
        <Card className="p-4 border text-center">
          <CheckSquare className="w-8 h-8 mx-auto mb-2 text-green-600" />
          <h3 className="font-semibold">One-off Validations</h3>
          <p className="text-sm text-gray-500">Per-use purchases</p>
        </Card>
        <Card className="p-4 border text-center">
          <Briefcase className="w-8 h-8 mx-auto mb-2 text-purple-600" />
          <h3 className="font-semibold">System Sales</h3>
          <p className="text-sm text-gray-500">General RTO sales</p>
        </Card>
        <Card className="p-4 border text-center">
          <Users className="w-8 h-8 mx-auto mb-2 text-orange-600" />
          <h3 className="font-semibold">Referral Partners</h3>
          <p className="text-sm text-gray-500">Consultant referrals</p>
        </Card>
      </div>

      <Card className="p-6 border">
        <h3 className="font-semibold text-lg mb-4">Pricing Concepts</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-4">Service</th>
                <th className="text-left py-2 px-4">Pricing Guide</th>
                <th className="text-left py-2 px-4">Notes</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="py-3 px-4 font-medium">Pre-marking</td>
                <td className="py-3 px-4">~$0.04 per question</td>
                <td className="py-3 px-4 text-gray-500">Guide pricing</td>
              </tr>
              <tr className="border-b">
                <td className="py-3 px-4 font-medium">Unit Validation</td>
                <td className="py-3 px-4">TBC</td>
                <td className="py-3 px-4 text-gray-500">To be confirmed</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium">Student Validation</td>
                <td className="py-3 px-4">TBC</td>
                <td className="py-3 px-4 text-gray-500">To be confirmed</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-4 bg-yellow-50 p-4 rounded-lg">
          <p className="text-yellow-800">
            <strong>Goal:</strong> Pricing needs to be simple and easy to explain.
          </p>
        </div>
      </Card>
    </div>
  );

  const renderIndustry = () => (
    <div className="space-y-6">
      <Card className="bg-gradient-to-r from-orange-500 to-red-600 text-white p-6">
        <h2 className="text-xl font-poppins font-bold mb-4 flex items-center gap-2">
          <Truck className="w-6 h-6" />
          Beyond RTOs: Industry Expansion
        </h2>
        <p className="text-orange-100">
          Nytro can be used beyond RTOs, particularly in the trucking, warehouse and broader industry space.
        </p>
      </Card>

      <Card className="p-6 border">
        <h3 className="font-semibold text-lg mb-4">How It Works for Industry</h3>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-blue-600 font-bold">1</span>
            </div>
            <div>
              <p className="font-medium">Upload Materials</p>
              <p className="text-gray-600 text-sm">Businesses upload their own training material into the system</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-blue-600 font-bold">2</span>
            </div>
            <div>
              <p className="font-medium">Generate Units</p>
              <p className="text-gray-600 text-sm">Nytro generates units and benchmark answers for trainers</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-blue-600 font-bold">3</span>
            </div>
            <div>
              <p className="font-medium">Auto-Marking</p>
              <p className="text-gray-600 text-sm">System automatically marks responses and provides feedback on incorrect questions</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-blue-600 font-bold">4</span>
            </div>
            <div>
              <p className="font-medium">Re-attempt & Review</p>
              <p className="text-gray-600 text-sm">Assessment returned to student for completion, trainer provides final decision</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-green-600 font-bold">5</span>
            </div>
            <div>
              <p className="font-medium">Certificate Generation</p>
              <p className="text-gray-600 text-sm">System generates certificate showing completion of non-accredited training</p>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6 border">
        <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
          <Factory className="w-5 h-5 text-purple-600" />
          Target Industries
        </h3>
        <p className="text-gray-600 mb-4">
          These industries often run large volumes of internal training but are generally behind with technology and tracking systems.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            'Transport & Logistics',
            'Construction',
            'Civil',
            'Mining',
            'Warehousing',
            'Manufacturing',
            'Real Estate',
            'Security',
            'Cleaning',
            'Facilities Management',
            'Aviation Ground Ops',
            'Ports & Stevedoring',
            'Utilities',
            'Telecommunications',
            'Waste Management',
            'Traffic Control',
            'Labour Hire',
            'Local Government'
          ].map((industry) => (
            <div key={industry} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
              <MapPin className="w-4 h-4 text-gray-400" />
              <span className="text-sm">{industry}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6 border bg-purple-50">
        <h3 className="font-semibold text-lg mb-4">Trainer Quality Assurance</h3>
        <p className="text-gray-700">
          If trainers are completing marking themselves, Nytro can also review trainer marking and feedback 
          to ensure consistency and quality. This same structure can be applied across many other industries 
          using the same delivery model.
        </p>
      </Card>
    </div>
  );

  const renderTechRoadmap = () => (
    <div className="space-y-6">
      {/* Keystone Meeting Highlight */}
      <Card className="bg-gradient-to-r from-amber-500 to-orange-600 text-white p-6">
        <div className="flex items-center gap-4">
          <Calendar className="w-12 h-12" />
          <div>
            <h2 className="text-xl font-poppins font-bold">Keystone Initial Tech Discussion</h2>
            <p className="text-amber-100">23 October 2026 at 11:00 AM</p>
            <div className="mt-2">
              <ChecklistItemComponent 
                id="keystone-meeting-23oct" 
                text="Meeting scheduled and confirmed" 
                checked={checklistItems['keystone-meeting-23oct']} 
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Tech roadmap items */}
      {techRoadmapItems.map((item) => (
        <Card key={item.id} className="p-6 border">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg text-blue-600">
                {item.icon}
              </div>
              <div>
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="text-sm text-gray-500">{item.targetDate}</p>
              </div>
            </div>
            {getStatusBadge(item.status)}
          </div>
          <p className="text-gray-600 mb-4">{item.description}</p>
          {item.details && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-semibold mb-2">Implementation Details:</h4>
              <ul className="space-y-1">
                {item.details.map((detail, index) => (
                  <li key={index} className="text-sm text-gray-600 flex items-start gap-2">
                    <span className="text-blue-500">•</span>
                    {detail}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      ))}
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverview();
      case 'plan2026':
        return renderPlan2026();
      case 'platform':
        return renderPlatform();
      case 'marketing':
        return renderMarketing();
      case 'commercial':
        return renderCommercial();
      case 'industry':
        return renderIndustry();
      case 'tech':
        return renderTechRoadmap();
      default:
        return renderOverview();
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      {/* Header */}
      <div className="bg-white border-b px-8 py-6">
        <h1 className="text-3xl font-poppins font-bold text-[#1e293b]">Nytro Strategy and Roadmap</h1>
        <p className="text-[#64748b] mt-1">Strategic planning, execution tracking, and technology roadmap for 2026</p>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b px-8">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-8 max-w-6xl mx-auto">
        {renderTabContent()}
      </div>
    </div>
  );
}
