export type RoleSlug = 'super_admin' | 'team_leader' | 'employee';

export interface Ref {
  id: string;
  name: string;
  code?: string;
  email?: string;
  employeeCode?: string;
  designation?: string;
}

export interface User {
  id: string;
  employeeCode?: string;
  name: string;
  email: string;
  phone?: string;
  designation?: string;
  role: RoleSlug;
  department?: Ref | null;
  manager?: Ref | null;
  teamLeader?: Ref | null;
  status: 'active' | 'inactive';
  lastLoginAt?: string | null;
  createdAt?: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  description: string;
  categories: string[];
  isActive: boolean;
  manager?: Ref | null;
  employeeCount?: number;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  department?: Ref | null;
  category?: string;
  assignedTo?: Ref | null;
  assignedBy?: Ref | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  startDate?: string | null;
  deadline?: string | null;
  status: 'pending' | 'in_progress' | 'review' | 'completed';
  progress: number;
  completedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface TaskUpdate {
  id: string;
  status: string;
  progress: number;
  note: string;
  createdAt: string;
  author?: Ref | null;
}

export interface Comment {
  id: string;
  body: string;
  createdAt: string;
  author?: Ref | null;
}

export interface Attachment {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export interface DailyReport {
  id: string;
  date: string;
  assignedWork: string;
  completedWork: string;
  pendingWork: string;
  problems: string;
  progress: number;
  tomorrowPlan: string;
  links: string[];
  status: 'submitted' | 'approved' | 'rejected' | 'changes_requested';
  reviewNote?: string;
  reviewedAt?: string | null;
  employee?: Ref | null;
  department?: Ref | null;
  reviewedBy?: Ref | null;
  tasks?: Array<{ id: string; title: string; status?: string }>;
  createdAt: string;
}

export interface AttendanceRecord {
  id: string;
  date: string;
  checkIn?: string | null;
  checkOut?: string | null;
  segmentStart?: string | null;
  lastSeenAt?: string | null;
  hours: number;
  running?: boolean;
  status: 'present' | 'late' | 'absent' | 'off' | 'upcoming';
  openTasks?: number;
  note?: string;
  employee?: Ref | null;
  department?: Ref | null;
}

export interface Timesheet {
  id: string;
  date: string;
  hours: number;
  description: string;
  status: 'submitted' | 'approved' | 'rejected';
  reviewNote?: string;
  employee?: Ref | null;
  department?: Ref | null;
  task?: { id: string; title: string } | null;
  reviewedBy?: Ref | null;
}

export interface Notice {
  id: string;
  title: string;
  message: string;
  type: string;
  link: string;
  read: boolean;
  createdAt: string;
}

export interface Role {
  id: string;
  name: string;
  slug: RoleSlug | string;
  description: string;
  permissions: string[];
}

export interface Permission {
  id: string;
  key: string;
  group: string;
  description: string;
}

export interface Settings {
  companyName: string;
  timezone: string;
  workStart: string;
  workEnd: string;
}

export interface Meta {
  page: number;
  limit: number;
  total: number;
  pages: number;
  unread?: number;
  counts?: {
    total: number;
    active?: number;
    blocked?: number;
    pending?: number;
    in_progress?: number;
    review?: number;
    completed?: number;
    overdue?: number;
  };
}

export interface ChatFile {
  originalName: string;
  mimeType: string;
  size: number;
  url?: string;
}

export interface ChatMessage {
  id: string;
  from: string;
  to: string;
  body: string;
  file: ChatFile | null;
  readAt: string | null;
  createdAt: string;
  mine: boolean;
  fromName?: string;
}

export interface ChatPerson {
  id: string;
  name: string;
  role: RoleSlug;
  employeeCode?: string;
  designation?: string;
  department?: { id: string; name: string } | null;
  online?: boolean;
  lastSeen?: string | null;
  unread?: number;
  lastBody?: string;
  lastFile?: string;
  lastAt?: string;
  lastFromMe?: boolean;
}

export interface WorkSession {
  running: boolean;
  startedAt: string | null;
  hours: number;
}

export interface Session {
  token?: string;
  user: User;
  permissions: string[];
  company: { name: string; timezone?: string };
  shift?: WorkSession | null;
}

export interface DashboardData {
  stats: {
    total: number;
    pending: number;
    inProgress: number;
    review: number;
    completed: number;
    overdue: number;
  };
  today: Task[];
  upcoming: Task[];
  trend: Array<{ date: string; completed: number }>;
  recentReports: DailyReport[];
  recentActivity: Array<{ id: string; message: string; createdAt: string; actor?: Ref | null }>;
  pendingApprovals: number;
  reportSubmittedToday: boolean;
  todayReportStatus: string | null;
}

export interface Productivity {
  from: string;
  to: string;
  summary: { tasks: number; completed: number; overdue: number; reports: number; attendanceRate: number };
  byDepartment: Array<{ id: string; name: string; total: number; completed: number; overdue: number; rate: number }>;
  byEmployee: Array<{
    id: string;
    name: string;
    department: string;
    assigned: number;
    completed: number;
    overdue: number;
    avgProgress: number;
    reports: number;
  }>;
  trend: Array<{ date: string; completed: number }>;
}

export interface SearchHits {
  tasks: Task[];
  employees: User[];
  reports: DailyReport[];
}
