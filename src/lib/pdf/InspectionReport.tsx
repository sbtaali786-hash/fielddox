import React from 'react';
import { Document, Page, Text, View, Image, StyleSheet, Font } from '@react-pdf/renderer';
import type { Company, Inspection, ChecklistTemplate, Site, AppUser } from '@/lib/types';

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: 'Helvetica', color: '#1a1a1a' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '2 solid #1d4ed8', paddingBottom: 12 },
  logo: { width: 90, height: 90, objectFit: 'contain' },
  title: { fontSize: 18, fontWeight: 700, color: '#1d4ed8' },
  subtitle: { fontSize: 10, color: '#555', marginTop: 2 },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16, gap: 8 },
  metaBox: { width: '48%', backgroundColor: '#f3f4f6', padding: 8, borderRadius: 4, marginBottom: 6 },
  metaLabel: { fontSize: 8, color: '#666', textTransform: 'uppercase' },
  metaValue: { fontSize: 11, fontWeight: 700, marginTop: 2 },
  sectionTitle: { fontSize: 12, fontWeight: 700, marginTop: 14, marginBottom: 6, color: '#1d4ed8' },
  categoryHeader: { fontSize: 10, fontWeight: 700, marginTop: 8, marginBottom: 4, color: '#374151' },
  itemRow: { flexDirection: 'row', borderBottom: '0.5 solid #e5e7eb', paddingVertical: 5, alignItems: 'flex-start' },
  itemText: { flex: 1, fontSize: 9.5 },
  answerBadge: { width: 44, textAlign: 'center', fontSize: 9, fontWeight: 700, paddingVertical: 2, borderRadius: 3 },
  answerYes: { backgroundColor: '#dcfce7', color: '#166534' },
  answerNo: { backgroundColor: '#fee2e2', color: '#991b1b' },
  answerNa: { backgroundColor: '#f3f4f6', color: '#6b7280' },
  note: { fontSize: 8.5, color: '#555', marginTop: 2, fontStyle: 'italic' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, gap: 8 },
  photo: { width: 120, height: 90, objectFit: 'cover', borderRadius: 3, border: '1 solid #e5e7eb' },
  signatureRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24 },
  signatureBox: { width: '45%' },
  signatureImg: { height: 50, objectFit: 'contain', borderBottom: '1 solid #999', marginBottom: 4 },
  signatureLabel: { fontSize: 8, color: '#666' },
  footer: { position: 'absolute', bottom: 24, left: 36, right: 36, fontSize: 8, color: '#999', textAlign: 'center', borderTop: '0.5 solid #e5e7eb', paddingTop: 8 },
});

function badgeStyle(answer: string) {
  if (answer === 'yes') return [styles.answerBadge, styles.answerYes];
  if (answer === 'no') return [styles.answerBadge, styles.answerNo];
  return [styles.answerBadge, styles.answerNa];
}

export interface InspectionReportProps {
  company: Company;
  site: Site;
  inspection: Inspection;
  checklist: ChecklistTemplate;
  inspector: AppUser | null;
}

export function InspectionReport({ company, site, inspection, checklist, inspector }: InspectionReportProps) {
  const responseByItem = new Map(inspection.responses.map((r) => [r.item_id, r]));
  const categories = Array.from(new Set(checklist.items.map((i) => i.category)));
  const failedCount = inspection.responses.filter((r) => r.answer === 'no').length;
  const photos = inspection.responses.filter((r) => r.photo_url).map((r) => r.photo_url!) as string[];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Site Safety Inspection Report</Text>
            <Text style={styles.subtitle}>{company.name}</Text>
          </View>
          {company.logo_url ? <Image src={company.logo_url} style={styles.logo} /> : null}
        </View>

        <View style={styles.metaGrid}>
          <View style={styles.metaBox}>
            <Text style={styles.metaLabel}>Site</Text>
            <Text style={styles.metaValue}>{site.name}</Text>
          </View>
          <View style={styles.metaBox}>
            <Text style={styles.metaLabel}>Address</Text>
            <Text style={styles.metaValue}>{site.address || '—'}</Text>
          </View>
          <View style={styles.metaBox}>
            <Text style={styles.metaLabel}>Inspector</Text>
            <Text style={styles.metaValue}>{inspector?.full_name || inspector?.email || 'Unknown'}</Text>
          </View>
          <View style={styles.metaBox}>
            <Text style={styles.metaLabel}>Date Completed</Text>
            <Text style={styles.metaValue}>
              {inspection.completed_at ? new Date(inspection.completed_at).toLocaleString() : 'In progress'}
            </Text>
          </View>
          <View style={styles.metaBox}>
            <Text style={styles.metaLabel}>GPS Location</Text>
            <Text style={styles.metaValue}>
              {inspection.gps_lat && inspection.gps_lng
                ? `${inspection.gps_lat.toFixed(5)}, ${inspection.gps_lng.toFixed(5)}`
                : 'Not captured'}
            </Text>
          </View>
          <View style={styles.metaBox}>
            <Text style={styles.metaLabel}>Failed Items</Text>
            <Text style={[styles.metaValue, failedCount > 0 ? { color: '#dc2626' } : { color: '#16a34a' }]}>
              {failedCount} of {checklist.items.length}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Checklist Results — {checklist.name}</Text>
        {categories.map((category) => (
          <View key={category} wrap={false}>
            <Text style={styles.categoryHeader}>{category}</Text>
            {checklist.items
              .filter((i) => i.category === category)
              .map((item) => {
                const response = responseByItem.get(item.id);
                const answer = response?.answer || 'na';
                return (
                  <View key={item.id}>
                    <View style={styles.itemRow}>
                      <Text style={styles.itemText}>
                        {item.text}
                        {item.required ? ' *' : ''}
                      </Text>
                      <Text style={badgeStyle(answer)}>{answer.toUpperCase()}</Text>
                    </View>
                    {response?.note ? <Text style={styles.note}>Note: {response.note}</Text> : null}
                  </View>
                );
              })}
          </View>
        ))}

        {photos.length > 0 ? (
          <View wrap={false}>
            <Text style={styles.sectionTitle}>Site Photos</Text>
            <View style={styles.photoGrid}>
              {photos.map((url, idx) => (
                <Image key={idx} src={url} style={styles.photo} />
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.signatureRow} wrap={false}>
          <View style={styles.signatureBox}>
            {inspection.inspector_signature_url ? (
              <Image src={inspection.inspector_signature_url} style={styles.signatureImg} />
            ) : (
              <View style={styles.signatureImg} />
            )}
            <Text style={styles.signatureLabel}>Inspector Signature</Text>
          </View>
          <View style={styles.signatureBox}>
            {inspection.site_manager_signature_url ? (
              <Image src={inspection.site_manager_signature_url} style={styles.signatureImg} />
            ) : (
              <View style={styles.signatureImg} />
            )}
            <Text style={styles.signatureLabel}>Site Manager Signature</Text>
          </View>
        </View>

        <Text style={styles.footer} fixed>
          Generated by FieldDocs — {new Date().toLocaleDateString()} — Report ID: {inspection.id}
        </Text>
      </Page>
    </Document>
  );
}
