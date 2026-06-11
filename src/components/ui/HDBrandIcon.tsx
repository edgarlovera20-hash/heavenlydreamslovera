import {
  siWhatsapp, siFacebook, siInstagram, siTiktok, siYoutube,
  siGoogle, siGmail, siGooglecalendar, siGoogledrive, siGooglemeet,
  siMicrosoft, siMicrosoftoutlook, siMicrosoftteams, siMicrosoftoffice,
  siTelegram, siX, siLinkedin, siGithub
} from 'simple-icons';

const brandIcons: Record<string, { path: string }> = {
  whatsapp: siWhatsapp, facebook: siFacebook, instagram: siInstagram,
  tiktok: siTiktok, youtube: siYoutube, google: siGoogle, gmail: siGmail,
  googleCalendar: siGooglecalendar, googleDrive: siGoogledrive, googleMeet: siGooglemeet,
  microsoft: siMicrosoft, outlook: siMicrosoftoutlook, teams: siMicrosoftteams,
  office: siMicrosoftoffice, telegram: siTelegram, x: siX,
  linkedin: siLinkedin, github: siGithub,
};

interface HDBrandIconProps {
  name: string;
  size?: number;
  className?: string;
  title?: string;
  style?: React.CSSProperties;
}

export default function HDBrandIcon({ name, size = 20, className = '', title, style }: HDBrandIconProps) {
  const icon = brandIcons[name];
  if (!icon) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24"
      role={title ? 'img' : 'presentation'} aria-label={title}
      className={`hd-brand-icon ${className}`} style={style}>
      {title && <title>{title}</title>}
      <path d={icon.path} />
    </svg>
  );
}
