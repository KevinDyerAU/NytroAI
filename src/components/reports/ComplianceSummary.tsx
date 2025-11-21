import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { CheckCircle, AlertCircle, FileText } from 'lucide-react';

interface ComplianceSummaryProps {
  stats: {
    totalItems: number;
    compliant: number;
    nonCompliant: number;
    complianceRate: number;
  };
}

export function ComplianceSummary({ stats }: ComplianceSummaryProps) {
  return (
    <Card className="border-2 border-[#dbeafe]">
      <CardHeader>
        <CardTitle className="font-poppins text-[#1e293b]">Compliance Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Progress Bar */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-[#64748b]">Overall Compliance Rate</span>
              <span className="text-2xl font-bold text-[#1e293b]">{stats.complianceRate}%</span>
            </div>
            <Progress value={stats.complianceRate} className="h-3" />
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-[#f8f9fb] border border-[#dbeafe] rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-5 w-5 text-[#3b82f6]" />
                <span className="text-sm font-medium text-[#64748b]">Total Items</span>
              </div>
              <div className="text-3xl font-bold text-[#1e293b]">{stats.totalItems}</div>
            </div>

            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="text-sm font-medium text-[#64748b]">Compliant</span>
              </div>
              <div className="text-3xl font-bold text-green-600">{stats.compliant}</div>
            </div>

            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <span className="text-sm font-medium text-[#64748b]">Non-Compliant</span>
              </div>
              <div className="text-3xl font-bold text-red-600">{stats.nonCompliant}</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
