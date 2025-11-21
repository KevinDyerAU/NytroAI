import { useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { ExportButton } from './ExportButton';
import { ComplianceSummary } from './ComplianceSummary';
import { ValidationSection } from './ValidationSection';
import { ValidationItem } from './ValidationItem';
import { useValidationReport } from '../../hooks/useValidationReport';
import {
  BookOpen,
  CheckCircle,
  FileText,
  Layers,
  List,
  AlertCircle,
} from 'lucide-react';

interface ValidationReportProps {
  validationId: number;
}

interface ComplianceStats {
  totalItems: number;
  compliant: number;
  nonCompliant: number;
  complianceRate: number;
}

function calculateComplianceStats(report: any): ComplianceStats {
  if (!report) {
    return {
      totalItems: 0,
      compliant: 0,
      nonCompliant: 0,
      complianceRate: 0,
    };
  }

  const allItems = [
    ...(report.knowledgeEvidence || []),
    ...(report.performanceEvidence || []),
    ...(report.assessmentConditions || []),
    ...(report.foundationSkills || []),
    ...(report.elementsPerformanceCriteria || []),
  ];

  const compliant = allItems.filter(
    (item) =>
      item.status?.toLowerCase() === 'compliant' ||
      item.status?.toLowerCase() === 'success'
  ).length;

  const nonCompliant = allItems.filter(
    (item) =>
      item.status?.toLowerCase() === 'failed' ||
      item.status?.toLowerCase() === 'non-compliant'
  ).length;

  return {
    totalItems: allItems.length,
    compliant,
    nonCompliant,
    complianceRate: allItems.length > 0 ? Math.round((compliant / allItems.length) * 100) : 0,
  };
}

function SkeletonReport() {
  return (
    <div className="max-w-5xl mx-auto space-y-6 p-8">
      <Skeleton className="h-12 w-64" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export function ValidationReport({ validationId }: ValidationReportProps) {
  const { report, isLoading, error } = useValidationReport(validationId);
  const reportRef = useRef<HTMLDivElement>(null);

  if (isLoading) {
    return <SkeletonReport />;
  }

  if (error || !report) {
    return (
      <div className="max-w-5xl mx-auto p-8">
        <Card className="border-2 border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-900 mb-1">Failed to Load Report</h3>
                <p className="text-sm text-red-800">
                  {error || 'Unable to load validation report. Please try again.'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const complianceStats = calculateComplianceStats(report);

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold font-poppins text-[#1e293b] mb-2">
            Validation Report
          </h1>
          {report.detail.UnitOfCompetency && (
            <p className="text-[#64748b]">
              {report.detail.UnitOfCompetency.unitCode} • {report.detail.UnitOfCompetency.Title}
            </p>
          )}
        </div>
        <ExportButton
          reportRef={reportRef}
          fileName={`validation-report-${validationId}`}
        />
      </div>

      {/* Report Content */}
      <div ref={reportRef} className="space-y-6">
        {/* Compliance Summary */}
        <ComplianceSummary stats={complianceStats} />

        {/* Document Information */}
        <Card className="border-2 border-[#dbeafe]">
          <CardHeader>
            <CardTitle className="font-poppins text-[#1e293b]">Document Information</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {report.detail.UnitOfCompetency && (
                <>
                  <div>
                    <dt className="text-sm font-medium text-[#64748b] mb-1">Unit Code</dt>
                    <dd className="text-sm font-mono text-[#1e293b] bg-[#f8f9fb] p-2 rounded">
                      {report.detail.UnitOfCompetency.unitCode}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-[#64748b] mb-1">Unit Title</dt>
                    <dd className="text-sm text-[#1e293b]">
                      {report.detail.UnitOfCompetency.Title}
                    </dd>
                  </div>
                </>
              )}
              <div>
                <dt className="text-sm font-medium text-[#64748b] mb-1">Validation Date</dt>
                <dd className="text-sm text-[#1e293b]">
                  {report.detail.created_at
                    ? new Date(report.detail.created_at).toLocaleDateString('en-AU', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    : '-'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-[#64748b] mb-1">Validation Status</dt>
                <dd className="text-sm text-[#1e293b] capitalize">
                  {report.detail.extractStatus || '-'}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Knowledge Evidence */}
        <ValidationSection
          title="Knowledge Evidence"
          icon={BookOpen}
          items={report.knowledgeEvidence}
          renderItem={(item) => (
            <ValidationItem
              key={item.id}
              number={item.ke_number || '-'}
              requirement={
                item.knowledge_evidence_requirements?.knowled_point ||
                item.ke_requirement ||
                'Knowledge Evidence'
              }
              status={item.status || 'pending'}
              mappedContent={item.mapped_questions}
              unmappedContent={item.unmappedContent}
              recommendations={item.unmappedRecommendations}
              docReferences={item.docReferences}
            />
          )}
        />

        {/* Performance Evidence */}
        <ValidationSection
          title="Performance Evidence"
          icon={CheckCircle}
          items={report.performanceEvidence}
          renderItem={(item) => (
            <ValidationItem
              key={item.id}
              number={item.pe_number || '-'}
              requirement={
                item.performance_evidence_requirements?.performance_evidence ||
                item.pe_requirement ||
                'Performance Evidence'
              }
              status={item.status || 'pending'}
              mappedContent={item.mapped_questions}
              unmappedContent={item.unmappedContent}
              recommendations={item.unmappedRecommendation}
              docReferences={item.docReferences}
            />
          )}
        />

        {/* Assessment Conditions */}
        <ValidationSection
          title="Assessment Conditions"
          icon={FileText}
          items={report.assessmentConditions}
          renderItem={(item) => (
            <ValidationItem
              key={item.id}
              number={item.ac_point || '-'}
              requirement={item.ac_point || 'Assessment Condition'}
              status={item.status || 'pending'}
              reasoning={item.reasoning}
              recommendations={item.recommendation}
            />
          )}
        />

        {/* Foundation Skills */}
        <ValidationSection
          title="Foundation Skills"
          icon={Layers}
          items={report.foundationSkills}
          renderItem={(item) => (
            <ValidationItem
              key={item.id}
              number={item.fs_number || '-'}
              requirement={
                item.foundation_skills_requirements?.skill_point ||
                item.fs_requirement ||
                'Foundation Skill'
              }
              status={item.status || 'pending'}
              mappedContent={item.mapped_questions}
              unmappedContent={item.unmappedContent}
              recommendations={item.unmappedRecommendations}
              docReferences={item.docReferences}
            />
          )}
        />

        {/* Elements & Performance Criteria */}
        <ValidationSection
          title="Elements & Performance Criteria"
          icon={List}
          items={report.elementsPerformanceCriteria}
          renderItem={(item) => {
            const req = item.elements_performance_criteria_requirements;
            const requirement = req
              ? `${req.element}: ${req.performance_criteria}`
              : item.performance_criteria || 'Element & Performance Criteria';
            return (
              <ValidationItem
                key={item.id}
                number={item.epc_number || '-'}
                requirement={requirement}
                status={item.status || 'pending'}
                mappedContent={item.mapped_questions}
                unmappedContent={item.unmappedContentExplanation}
                recommendations={item.unmappedContentRecommendation}
                benchmarkAnswer={item.benchmarkAnswer}
                docReferences={item.docReferences}
              />
            );
          }}
        />
      </div>
    </div>
  );
}
