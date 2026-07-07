'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import SignatureCanvas from 'react-signature-canvas';
import { Camera, Download, CheckCircle2, XCircle, MinusCircle } from 'lucide-react';
import DashboardShell from '@/components/DashboardShell';
import type { InspectionResponse, Answer } from '@/lib/types';

interface ChecklistItem {
  id: string;
  text: string;
  category: string;
  required: boolean;
}

interface InspectionDetail {
  id: string;
  status: 'draft' | 'completed' | 'signed';
  responses: InspectionResponse[];
  report_pdf_url: string | null;
  inspector_signature_url: string | null;
  site_manager_signature_url: string | null;
  sites: { name: string; address: string | null };
  checklists: { name: string; items: ChecklistItem[] };
  users: { full_name: string | null; email: string } | null;
}

const ANSWER_CONFIG: Record<Answer, { icon: typeof CheckCircle2; classes: string }> = {
  yes: { icon: CheckCircle2, classes: 'bg-status-green/10 text-status-green border-status-green/30' },
  no: { icon: XCircle, classes: 'bg-status-red/10 text-status-red border-status-red/30' },
  na: { icon: MinusCircle, classes: 'bg-gray-100 text-gray-500 border-gray-200' },
};

export default function InspectionDetailPage() {
  const params = useParams<{ id: string }>();
  const [inspection, setInspection] = useState<InspectionDetail | null>(null);
  const [responses, setResponses] = useState<Map<string, InspectionResponse>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inspectorSigRef = useRef<SignatureCanvas>(null);
  const managerSigRef = useRef<SignatureCanvas>(null);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/inspections/${params.id}`);
    const data = await res.json();
    if (res.ok) {
      setInspection(data.inspection);
      setResponses(new Map(data.inspection.responses.map((r: InspectionResponse) => [r.item_id, r])));
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  function setAnswer(itemId: string, answer: Answer) {
    setResponses((prev) => {
      const next = new Map(prev);
      next.set(itemId, { ...(next.get(itemId) || { item_id: itemId, answer: 'na' }), item_id: itemId, answer });
      return next;
    });
  }

  function setNote(itemId: string, note: string) {
    setResponses((prev) => {
      const next = new Map(prev);
      next.set(itemId, { ...(next.get(itemId) || { item_id: itemId, answer: 'na' }), item_id: itemId, note });
      return next;
    });
  }

  async function handlePhotoUpload(itemId: string, file: File) {
    setUploadingFor(itemId);
    setError(null);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('bucket', 'inspection-photos');
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const data = await res.json();
    setUploadingFor(null);
    if (!res.ok) {
      setError(data.error || 'Photo upload failed');
      return;
    }
    setResponses((prev) => {
      const next = new Map(prev);
      next.set(itemId, { ...(next.get(itemId) || { item_id: itemId, answer: 'na' }), item_id: itemId, photo_url: data.url });
      return next;
    });
  }

  async function persistResponses(extra: Record<string, unknown> = {}) {
    const res = await fetch(`/api/inspections/${params.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ responses: Array.from(responses.values()), ...extra }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save');
    return data.inspection;
  }

  async function handleSaveDraft() {
    setSaving(true);
    setError(null);
    try {
      await persistResponses();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleCompleteAndGenerate() {
    if (!inspectorSigRef.current || inspectorSigRef.current.isEmpty()) {
      setError('Inspector signature is required to complete the report.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // Upload signatures as PNG blobs to the signatures bucket.
      const inspectorSigBlob = await new Promise<Blob>((resolve) =>
        inspectorSigRef.current!.getTrimmedCanvas().toBlob((b) => resolve(b!), 'image/png')
      );
      const inspectorForm = new FormData();
      inspectorForm.append('file', new File([inspectorSigBlob], 'inspector-signature.png', { type: 'image/png' }));
      inspectorForm.append('bucket', 'signatures');
      const inspectorRes = await fetch('/api/upload', { method: 'POST', body: inspectorForm });
      const inspectorData = await inspectorRes.json();
      if (!inspectorRes.ok) throw new Error(inspectorData.error || 'Failed to save inspector signature');

      let managerSigUrl: string | undefined;
      if (managerSigRef.current && !managerSigRef.current.isEmpty()) {
        const managerBlob = await new Promise<Blob>((resolve) =>
          managerSigRef.current!.getTrimmedCanvas().toBlob((b) => resolve(b!), 'image/png')
        );
        const managerForm = new FormData();
        managerForm.append('file', new File([managerBlob], 'manager-signature.png', { type: 'image/png' }));
        managerForm.append('bucket', 'signatures');
        const managerRes = await fetch('/api/upload', { method: 'POST', body: managerForm });
        const managerData = await managerRes.json();
        if (managerRes.ok) managerSigUrl = managerData.url;
      }

      await persistResponses({
        status: 'completed',
        inspector_signature_url: inspectorData.url,
        ...(managerSigUrl ? { site_manager_signature_url: managerSigUrl } : {}),
      });

      setGeneratingPdf(true);
      const pdfRes = await fetch(`/api/inspections/${params.id}/generate-pdf`, { method: 'POST' });
      const pdfData = await pdfRes.json();
      if (!pdfRes.ok) throw new Error(pdfData.error || 'Failed to generate PDF');

      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
      setGeneratingPdf(false);
    }
  }

  if (loading) {
    return (
      <DashboardShell>
        <p className="text-sm text-gray-400">Loading…</p>
      </DashboardShell>
    );
  }
  if (!inspection) {
    return (
      <DashboardShell>
        <p className="text-sm text-status-red">Inspection not found.</p>
      </DashboardShell>
    );
  }

  const isEditable = inspection.status === 'draft';
  const categories = Array.from(new Set(inspection.checklists.items.map((i) => i.category)));

  return (
    <DashboardShell>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{inspection.sites.name}</h1>
          <p className="text-sm text-gray-500">{inspection.checklists.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              inspection.status === 'signed'
                ? 'bg-status-green/10 text-status-green'
                : inspection.status === 'completed'
                ? 'bg-brand-500/10 text-brand-600'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {inspection.status}
          </span>
          {inspection.report_pdf_url && (
            <a href={inspection.report_pdf_url} target="_blank" rel="noreferrer" className="btn-secondary">
              <Download className="mr-1.5 h-4 w-4" /> Download PDF
            </a>
          )}
        </div>
      </div>

      {error && <div className="mt-4 rounded-lg bg-status-red/10 px-3 py-2 text-sm text-status-red">{error}</div>}

      <div className="mt-6 space-y-6">
        {categories.map((category) => (
          <div key={category} className="card">
            <h2 className="font-semibold text-gray-800">{category}</h2>
            <div className="mt-3 divide-y divide-gray-100">
              {inspection.checklists.items
                .filter((i) => i.category === category)
                .map((item) => {
                  const response = responses.get(item.id);
                  return (
                    <div key={item.id} className="py-4">
                      <div className="flex items-start justify-between gap-4">
                        <p className="text-sm">
                          {item.text}
                          {item.required && <span className="text-status-red"> *</span>}
                        </p>
                        <div className="flex shrink-0 gap-1.5">
                          {(['yes', 'no', 'na'] as Answer[]).map((option) => {
                            const { icon: Icon, classes } = ANSWER_CONFIG[option];
                            const active = response?.answer === option;
                            return (
                              <button
                                key={option}
                                type="button"
                                disabled={!isEditable}
                                onClick={() => setAnswer(item.id, option)}
                                className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${
                                  active ? classes : 'border-gray-200 text-gray-300'
                                } ${isEditable ? 'hover:border-brand-300' : 'cursor-not-allowed opacity-70'}`}
                                title={option.toUpperCase()}
                              >
                                <Icon className="h-4 w-4" />
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {isEditable ? (
                        <div className="mt-2 flex flex-wrap items-center gap-3">
                          <input
                            className="input flex-1 text-xs"
                            placeholder="Add a note (optional)"
                            value={response?.note || ''}
                            onChange={(e) => setNote(item.id, e.target.value)}
                          />
                          <label className="btn-secondary cursor-pointer px-3 py-1.5 text-xs">
                            <Camera className="mr-1 h-3.5 w-3.5" />
                            {uploadingFor === item.id ? 'Uploading…' : response?.photo_url ? 'Retake' : 'Add photo'}
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              className="hidden"
                              onChange={(e) => e.target.files?.[0] && handlePhotoUpload(item.id, e.target.files[0])}
                            />
                          </label>
                        </div>
                      ) : response?.note ? (
                        <p className="mt-1 text-xs italic text-gray-500">Note: {response.note}</p>
                      ) : null}

                      {response?.photo_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={response.photo_url} alt="Site condition" className="mt-2 h-24 w-32 rounded-lg border border-gray-200 object-cover" />
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        ))}

        {isEditable && (
          <div className="card">
            <h2 className="font-semibold text-gray-800">Signatures</h2>
            <div className="mt-4 grid gap-6 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-gray-500">Inspector signature *</label>
                <div className="mt-1 rounded-lg border border-gray-200">
                  <SignatureCanvas ref={inspectorSigRef} canvasProps={{ className: 'w-full h-32' }} />
                </div>
                <button type="button" onClick={() => inspectorSigRef.current?.clear()} className="mt-1 text-xs text-gray-400 hover:text-gray-600">
                  Clear
                </button>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Site manager signature (optional)</label>
                <div className="mt-1 rounded-lg border border-gray-200">
                  <SignatureCanvas ref={managerSigRef} canvasProps={{ className: 'w-full h-32' }} />
                </div>
                <button type="button" onClick={() => managerSigRef.current?.clear()} className="mt-1 text-xs text-gray-400 hover:text-gray-600">
                  Clear
                </button>
              </div>
            </div>
          </div>
        )}

        {isEditable && (
          <div className="flex gap-3">
            <button onClick={handleSaveDraft} disabled={saving} className="btn-secondary">
              {saving && !generatingPdf ? 'Saving…' : 'Save Draft'}
            </button>
            <button onClick={handleCompleteAndGenerate} disabled={saving} className="btn-primary">
              {generatingPdf ? 'Generating PDF…' : saving ? 'Saving…' : 'Complete & Generate PDF'}
            </button>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
