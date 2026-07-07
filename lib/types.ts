export type UserRole = 'admin' | 'supervisor' | 'worker';
export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'canceled';
export type SiteStatus = 'active' | 'completed' | 'on-hold';
export type InspectionStatus = 'draft' | 'completed' | 'signed';
export type ComplianceType = 'license' | 'training' | 'insurance';
export type Answer = 'yes' | 'no' | 'na';

export interface Company {
  id: string;
  name: string;
  contact_email: string;
  phone: string | null;
  logo_url: string | null;
  address: string | null;
  stripe_customer_id: string | null;
  subscription_status: SubscriptionStatus;
  trial_ends_at: string;
  created_at: string;
}

export interface AppUser {
  id: string;
  company_id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  active: boolean;
  created_at: string;
}

export interface Site {
  id: string;
  company_id: string;
  name: string;
  address: string | null;
  status: SiteStatus;
  created_at: string;
}

export interface ChecklistTemplate {
  id: string;
  company_id: string;
  name: string;
  items: { id: string; text: string; category: string; required: boolean }[];
  is_default: boolean;
  created_at: string;
}

export interface InspectionResponse {
  item_id: string;
  answer: Answer;
  note?: string;
  photo_url?: string;
}

export interface Inspection {
  id: string;
  site_id: string;
  company_id: string;
  inspector_id: string | null;
  checklist_id: string | null;
  status: InspectionStatus;
  responses: InspectionResponse[];
  gps_lat: number | null;
  gps_lng: number | null;
  inspector_signature_url: string | null;
  site_manager_signature_url: string | null;
  report_pdf_url: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface ComplianceItem {
  id: string;
  company_id: string;
  type: ComplianceType;
  name: string;
  expiry_date: string;
  reminder_days: number;
  last_reminder_sent_at: string | null;
}
