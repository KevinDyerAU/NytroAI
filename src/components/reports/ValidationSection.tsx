import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { LucideIcon } from 'lucide-react';

interface ValidationSectionProps {
  title: string;
  icon: LucideIcon;
  items: any[];
  renderItem: (item: any) => React.ReactNode;
}

export function ValidationSection({
  title,
  icon: Icon,
  items,
  renderItem,
}: ValidationSectionProps) {
  if (!items || items.length === 0) {
    return null;
  }

  const compliantCount = items.filter(
    (item) => item.status?.toLowerCase() === 'compliant' || item.status?.toLowerCase() === 'success'
  ).length;
  const failedCount = items.filter(
    (item) => item.status?.toLowerCase() === 'failed' || item.status?.toLowerCase() === 'non-compliant'
  ).length;

  return (
    <Card className="border-2 border-[#dbeafe]">
      <CardHeader>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-[#dbeafe] border border-[#3b82f6] rounded-lg">
            <Icon className="h-5 w-5 text-[#3b82f6]" />
          </div>
          <div className="flex-1">
            <CardTitle className="font-poppins text-[#1e293b]">{title}</CardTitle>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="text-right">
              <div className="font-semibold text-green-600">{compliantCount}</div>
              <div className="text-xs text-[#64748b]">Compliant</div>
            </div>
            <div className="text-right">
              <div className="font-semibold text-red-600">{failedCount}</div>
              <div className="text-xs text-[#64748b]">Non-Compliant</div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">{items.map((item) => renderItem(item))}</div>
      </CardContent>
    </Card>
  );
}
