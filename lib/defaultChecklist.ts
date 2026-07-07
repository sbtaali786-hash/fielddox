export interface ChecklistItem {
  id: string;
  text: string;
  category: string;
  required: boolean;
}

/**
 * General construction safety checklist, aligned to OSHA 1926 subparts most
 * commonly cited in roofing/electrical/HVAC field inspections (Subpart C
 * general safety, M fall protection, K electrical, E PPE).
 *
 * This is a starting template, not a compliance guarantee — trade-specific
 * and jurisdiction-specific items should be added per company in Settings.
 * Do not represent this list to customers as exhaustive OSHA compliance.
 */
export const DEFAULT_CHECKLIST_ITEMS: ChecklistItem[] = [
  { id: 'fp-1', category: 'Fall Protection', text: 'Guardrails or personal fall arrest systems in place at all unprotected edges 6ft+', required: true },
  { id: 'fp-2', category: 'Fall Protection', text: 'Ladders inspected, fully extended, secured, and rated for the load', required: true },
  { id: 'fp-3', category: 'Fall Protection', text: 'Roof anchors/lifelines inspected and rated for current crew', required: true },
  { id: 'ppe-1', category: 'PPE', text: 'Hard hats worn in designated areas', required: true },
  { id: 'ppe-2', category: 'PPE', text: 'Eye and hearing protection available and worn where required', required: true },
  { id: 'ppe-3', category: 'PPE', text: 'High-visibility clothing worn near vehicle/equipment traffic', required: false },
  { id: 'elec-1', category: 'Electrical', text: 'GFCI protection in place for all temporary power and cord sets', required: true },
  { id: 'elec-2', category: 'Electrical', text: 'Extension cords and tools inspected, no visible damage', required: true },
  { id: 'elec-3', category: 'Electrical', text: 'Lockout/tagout procedures followed where applicable', required: true },
  { id: 'site-1', category: 'Site Conditions', text: 'Site free of trip hazards, debris cleared from walkways', required: true },
  { id: 'site-2', category: 'Site Conditions', text: 'Emergency exits and first aid kit accessible', required: true },
  { id: 'site-3', category: 'Site Conditions', text: 'Weather conditions checked and safe for planned work', required: true },
  { id: 'eq-1', category: 'Equipment', text: 'Heavy equipment inspected before use (daily pre-op check)', required: true },
  { id: 'eq-2', category: 'Equipment', text: 'Scaffolding fully planked, guardrails installed, tagged', required: false },
  { id: 'comm-1', category: 'Communication', text: 'Toolbox talk / safety briefing conducted before work start', required: true },
  { id: 'comm-2', category: 'Communication', text: 'All crew aware of site-specific hazards and emergency procedures', required: true },
];
