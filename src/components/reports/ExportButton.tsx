import { useRef } from 'react';
import { Button } from '../ui/button';
import { Download, Printer } from 'lucide-react';
import { exportReportToPDF, printReport } from '../../utils/reportExport';
import { toast } from 'sonner';

interface ExportButtonProps {
  reportRef: React.RefObject<HTMLDivElement>;
  fileName: string;
}

export function ExportButton({ reportRef, fileName }: ExportButtonProps) {
  const isExporting = useRef(false);

  const handleExportPDF = async () => {
    if (!reportRef.current || isExporting.current) return;

    isExporting.current = true;

    try {
      await exportReportToPDF(reportRef.current, fileName);
      toast.success('Report exported successfully!');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error('Failed to export report. Try using print instead.');
    } finally {
      isExporting.current = false;
    }
  };

  const handlePrint = () => {
    printReport();
  };

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleExportPDF}
        className="gap-2"
        disabled={isExporting.current}
      >
        <Download className="h-4 w-4" />
        Export PDF
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handlePrint}
        className="gap-2"
      >
        <Printer className="h-4 w-4" />
        Print
      </Button>
    </div>
  );
}
