export type ModuleCode = 'ams' | 'hokmanote';

export type ModuleStatus = 
  | 'inactive'      // 미사용
  | 'trial'         // 체험 사용
  | 'pending_setup' // 계약 완료 / 설치 대기
  | 'active'        // 정상 사용
  | 'grace'         // 유예 사용
  | 'suspended';    // 이용 중지

export type ActivationCodeStatus = 'issued' | 'used' | 'expired' | 'revoked';

export type DeviceStatus = 'active' | 'revoked';

export interface AcademyModule {
  id: string;
  academy_id: string;
  module_code: ModuleCode;
  status: ModuleStatus;
  plan_code?: string;
  max_devices: number;
  trial_ends_at?: string | null;
  grace_until?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActivationCode {
  id: string;
  academy_id: string;
  module_code: ModuleCode;
  code_hash?: string;
  code_prefix: string;
  status: ActivationCodeStatus;
  expires_at: string;
  max_uses: number;
  used_count: number;
  used_at?: string | null;
  revoked_at?: string | null;
  created_by?: string | null;
  created_at: string;
}

export interface AcademyDevice {
  id: string;
  academy_id: string;
  module_code: ModuleCode;
  device_uuid: string;
  device_name: string;
  platform: 'macos' | 'windows';
  os_version?: string | null;
  app_version?: string | null;
  status: DeviceStatus;
  activated_at: string;
  last_seen_at: string;
  revoked_at?: string | null;
  metadata?: Record<string, any>;
}

export interface AcademyModuleOverview {
  id: string;
  academy_name: string;
  slug: string;
  is_suspended: boolean;
  ams_status: ModuleStatus;
  hokmanote_status: ModuleStatus;
  hokmanote_max_devices: number;
  active_device_count: number;
  registered_devices: AcademyDevice[];
  is_legacy_installation: boolean; // 기존 .env 설치본 여부
  latest_activity: {
    source: 'AMS' | 'HokmaNote' | 'none';
    timestamp?: string;
    display: string;
  };
}
