import { createElement } from "react";

/**
 * Server-rendered SVG icons from the Lucide set (ISC licence).
 *
 * We import plain icon *data* from `lucide` and draw the <svg> here instead of
 * using `lucide-react`, whose components are client components: this keeps
 * every icon in the HTML with zero JavaScript shipped or hydrated.
 */
export type IconNode = [tag: string, attrs: Record<string, string | number | undefined>][];

const camel = (k: string) => k.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

export function Icon({ icon, className = "h-5 w-5", strokeWidth = 2, label }: { icon: IconNode; className?: string; strokeWidth?: number; label?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      focusable="false"
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      {icon.map(([tag, attrs], i) => createElement(tag, { key: i, ...Object.fromEntries(Object.entries(attrs).map(([k, v]) => [camel(k), v])) }))}
    </svg>
  );
}

export {
  Activity,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Award,
  BadgeCheck,
  Ban,
  Banknote,
  Bell,
  BellRing,
  BookOpen,
  Bookmark,
  Briefcase,
  Building,
  Calendar,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleQuestionMark,
  CircleX,
  ClipboardCheck,
  Clock,
  Compass,
  Database,
  Download,
  ExternalLink,
  Eye,
  FileCheck,
  FileText,
  FingerprintPattern,
  Flag,
  Gavel,
  Gift,
  Globe,
  GraduationCap,
  HandHelping,
  Handshake,
  Hash,
  Heart,
  HeartHandshake,
  Hourglass,
  House,
  Inbox,
  Info,
  KeyRound,
  Landmark,
  Languages,
  LayoutDashboard,
  Library,
  LifeBuoy,
  Lightbulb,
  Link2,
  ListChecks,
  ListFilter,
  Lock,
  LogIn,
  LogOut,
  Mail,
  MailCheck,
  Mailbox,
  MapPin,
  Medal,
  Megaphone,
  Menu,
  MessageCircle,
  MessageSquare,
  MessageSquareText,
  MessagesSquare,
  MonitorSmartphone,
  Newspaper,
  PartyPopper,
  Pencil,
  Phone,
  Plane,
  Plus,
  Power,
  Quote,
  Route,
  Scale,
  School,
  ScrollText,
  Search,
  Send,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Siren,
  SlidersHorizontal,
  Sparkles,
  Sprout,
  Star,
  StarHalf,
  Target,
  Timer,
  Trash,
  TrendingUp,
  ThumbsUp,
  TriangleAlert,
  Trophy,
  User,
  UserCog,
  UserCheck,
  UserPlus,
  UserRound,
  Users,
  Video,
  X,
} from "lucide";
