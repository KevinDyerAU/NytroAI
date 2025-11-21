import { useState } from 'react';
import { DocumentUpload } from '../components/upload';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function UploadDemoPage() {
  const navigate = useNavigate();
  const [selectedUnit, setSelectedUnit] = useState('BSBWHS521');

  const handleUploadComplete = (validationId: number) => {
    console.log('Upload complete! Validation ID:', validationId);
    // In a real app, you might navigate to the validation progress page
    // navigate(`/validations/${validationId}`);
  };

  return (
    <div className="min-h-screen bg-[#f8f9fb] p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold text-[#1e293b]">Document Upload Demo</h1>
          <p className="text-muted-foreground mt-2">
            Upload assessment documents for validation
          </p>
        </div>

        {/* Unit Selection */}
        <Card className="p-6 mb-6">
          <label className="block text-sm font-medium mb-2">
            Unit of Competency
          </label>
          <select
            value={selectedUnit}
            onChange={(e) => setSelectedUnit(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg"
          >
            <option value="BSBWHS521">BSBWHS521 - Ensure a safe workplace</option>
            <option value="BSBCMM511">BSBCMM511 - Communicate with influence</option>
            <option value="ICTPRG302">ICTPRG302 - Apply introductory programming</option>
          </select>
        </Card>

        {/* Upload Component */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Upload Documents</h2>
          <DocumentUpload
            unitCode={selectedUnit}
            onUploadComplete={handleUploadComplete}
          />
        </Card>

        {/* Info Card */}
        <Card className="p-6 mt-6 bg-blue-50 border-blue-200">
          <h3 className="font-semibold text-blue-900 mb-2">What happens after upload?</h3>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>Files are uploaded to secure storage</li>
            <li>Document records are created in the database</li>
            <li>AI validation process is automatically triggered</li>
            <li>You'll be notified when validation is complete</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
