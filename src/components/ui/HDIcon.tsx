import {
  Home, User, Users, Settings, Calendar, MessageCircle, Phone, Mail,
  Search, Bell, Menu, X, ChevronRight, ChevronDown, LogOut, LayoutDashboard,
  ClipboardList, Briefcase, Wallet, BarChart3, ShieldCheck, FileText,
  CheckCircle, AlertCircle, Clock, Send, Bot, Headphones, Building2,
  CreditCard, Database, Lock, Unlock, Eye, EyeOff, Edit, Trash, Plus,
  Minus, Download, Upload, Filter, RefreshCcw, type LucideProps
} from 'lucide-react';

const icons: Record<string, React.ComponentType<LucideProps>> = {
  home: Home, user: User, users: Users, settings: Settings,
  calendar: Calendar, message: MessageCircle, phone: Phone, mail: Mail,
  search: Search, bell: Bell, menu: Menu, close: X,
  chevronRight: ChevronRight, chevronDown: ChevronDown, logout: LogOut,
  dashboard: LayoutDashboard, candidates: ClipboardList, jobs: Briefcase,
  finance: Wallet, reports: BarChart3, security: ShieldCheck, document: FileText,
  success: CheckCircle, warning: AlertCircle, clock: Clock, send: Send,
  bot: Bot, support: Headphones, company: Building2, payment: CreditCard,
  database: Database, lock: Lock, unlock: Unlock, eye: Eye, eyeOff: EyeOff,
  edit: Edit, trash: Trash, plus: Plus, minus: Minus,
  download: Download, upload: Upload, filter: Filter, refresh: RefreshCcw,
};

interface HDIconProps extends Omit<LucideProps, 'ref'> {
  name: string;
}

export default function HDIcon({ name, size = 20, strokeWidth = 2, className = '', ...props }: HDIconProps) {
  const Icon = icons[name];
  if (!Icon) return null;
  return <Icon size={size} strokeWidth={strokeWidth} className={`hd-icon ${className}`} {...props} />;
}
