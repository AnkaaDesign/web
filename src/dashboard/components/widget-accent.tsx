// Shared accent system for dashboard widgets — a curated palette of named
// colors and a curated set of icons that widgets can use to give each
// instance a distinct visual identity (e.g. "Em Produção" violet with a
// brush icon, "Concluídas" green with a check, etc.).
//
// Color classes are listed as LITERAL strings here so Tailwind's JIT picks
// them up at build time. Don't construct class names like `text-${color}-500`
// at runtime — they would be tree-shaken away.
//
// Each color drives — consistently in both light and dark mode — the title
// text color, the header icon foreground, the leading "dot" indicator, the
// optional left-border accent, and the card outer border. Colors are grouped
// by hue family (neutral / warm / nature / cool / rich) so the picker can
// present them in a logical layout.

import { useState } from "react";
import type { ComponentType, CSSProperties, ReactNode } from "react";
import { z } from "zod";
import {
  // Status / feedback
  IconCheck,
  IconCheckbox,
  IconCircleCheck,
  IconCircleX,
  IconX,
  IconBan,
  IconAlertCircle,
  IconAlertTriangle,
  IconAlertOctagon,
  IconInfoCircle,
  IconQuestionMark,
  IconHelp,
  IconCircleDot,
  IconTarget,
  IconTargetArrow,
  IconLoader,
  IconLoader2,
  // Time / calendar
  IconClock,
  IconClock24,
  IconClockHour3,
  IconClockOff,
  IconHourglass,
  IconHourglassHigh,
  IconHourglassLow,
  IconHourglassOff,
  IconCalendar,
  IconCalendarDue,
  IconCalendarEvent,
  IconCalendarTime,
  IconCalendarMonth,
  IconCalendarStats,
  IconCalendarPlus,
  IconCalendarOff,
  // Arrows / navigation
  IconArrowRight,
  IconArrowLeft,
  IconArrowUp,
  IconArrowDown,
  IconArrowUpRight,
  IconArrowDownRight,
  IconArrowBackUp,
  IconArrowForwardUp,
  IconArrowsExchange,
  IconChevronRight,
  IconChevronLeft,
  IconChevronUp,
  IconChevronDown,
  IconChevronsRight,
  IconChevronsLeft,
  IconRefresh,
  IconRotate,
  IconPlayerPlay,
  IconPlayerPause,
  IconPlayerStop,
  // Files / documents
  IconFile,
  IconFileText,
  IconFiles,
  IconFolder,
  IconFolderOpen,
  IconFolderPlus,
  IconFileInvoice,
  IconFileSpreadsheet,
  IconReceipt,
  IconReceipt2,
  IconReceiptOff,
  IconClipboard,
  IconClipboardText,
  IconClipboardList,
  IconClipboardCheck,
  IconClipboardCopy,
  IconCheckupList,
  IconNote,
  IconNotebook,
  IconBook,
  IconBooks,
  IconBookmark,
  IconBookmarks,
  IconArchive,
  IconArchiveOff,
  IconCertificate,
  IconLicense,
  IconBadge,
  IconSignature,
  IconWriting,
  // Money / finance
  IconCash,
  IconCoin,
  IconCoins,
  IconCurrencyDollar,
  IconCurrencyReal,
  IconCurrencyEuro,
  IconCreditCard,
  IconWallet,
  IconBuildingBank,
  IconReportMoney,
  IconShoppingCart,
  IconShoppingBag,
  IconBasket,
  // Charts / analytics
  IconChartBar,
  IconChartLine,
  IconChartPie,
  IconChartArea,
  IconChartDonut,
  IconChartBubble,
  IconTrendingUp,
  IconTrendingDown,
  IconActivity,
  IconGauge,
  IconReportAnalytics,
  // Communication
  IconMail,
  IconMailOpened,
  IconMessage,
  IconMessages,
  IconMessageCircle,
  IconPhone,
  IconPhoneCall,
  IconBell,
  IconBellRinging,
  IconBellOff,
  IconNotification,
  IconBroadcast,
  IconSend,
  IconShare,
  // People / teams
  IconUser,
  IconUsers,
  IconUserCircle,
  IconUserPlus,
  IconUserCheck,
  IconUserOff,
  IconUserShield,
  IconFriends,
  IconBriefcase,
  IconAddressBook,
  IconMan,
  IconWoman,
  // Buildings / org
  IconBuilding,
  IconBuildingFactory,
  IconBuildingFactory2,
  IconBuildingStore,
  IconBuildingWarehouse,
  IconBuildingSkyscraper,
  IconBuildingCommunity,
  IconBuildingHospital,
  IconBuildingArch,
  IconBuildingChurch,
  IconBuildingMonument,
  IconHome,
  IconHome2,
  IconSchool,
  // Tools / settings
  IconSettings,
  IconAdjustments,
  IconTool,
  IconTools,
  IconHammer,
  IconScale,
  IconBrush,
  IconBrushOff,
  IconPalette,
  IconPaint,
  IconColorSwatch,
  IconRuler,
  IconScissors,
  IconPaperclip,
  IconPin,
  IconPinned,
  // Security
  IconKey,
  IconLock,
  IconLockOpen,
  IconLockSquare,
  IconShield,
  IconShieldCheck,
  IconEye,
  IconEyeOff,
  IconFingerprint,
  // Locations / geo
  IconWorld,
  IconMapPin,
  IconMap2,
  IconNavigation,
  IconCompass,
  IconLocation,
  IconRoute,
  // Vehicles / logistics
  IconCar,
  IconTruck,
  IconBike,
  IconPlane,
  IconAmbulance,
  IconPackage,
  IconPackages,
  IconBox,
  // Devices / tech
  IconDeviceDesktop,
  IconDeviceMobile,
  IconDeviceLaptop,
  IconDeviceTablet,
  IconDeviceTv,
  IconKeyboard,
  IconMouse,
  IconHeadphones,
  IconCamera,
  IconPhoto,
  IconVideo,
  IconMusic,
  IconVolume,
  IconMicrophone,
  IconPrinter,
  IconCpu,
  IconDatabase,
  IconServer,
  IconCode,
  IconTerminal2,
  IconRobot,
  IconQrcode,
  IconBarcode,
  IconScan,
  IconWifi,
  IconWifiOff,
  IconBluetooth,
  IconBattery,
  IconBattery1,
  IconBattery2,
  IconBattery3,
  IconBattery4,
  // Highlights / fun / rewards
  IconBolt,
  IconBoltOff,
  IconStar,
  IconHeart,
  IconHeartbeat,
  IconHeartHandshake,
  IconFlag,
  IconFlame,
  IconRocket,
  IconTrophy,
  IconAward,
  IconCrown,
  IconGift,
  IconBalloon,
  IconCake,
  IconConfetti,
  IconSparkles,
  IconWand,
  IconBulb,
  // Shapes
  IconCircle,
  IconSquare,
  IconTriangle,
  IconHexagon,
  IconDiamond,
  IconShape,
  // Weather / nature
  IconCloud,
  IconSun,
  IconMoon,
  IconCloudRain,
  IconCloudFog,
  IconSnowflake,
  IconUmbrella,
  IconWind,
  IconRainbow,
  IconSunrise,
  IconSunset,
  IconLeaf,
  IconTree,
  IconFlower,
  IconClover,
  IconCactus,
  IconMushroom,
  IconPlant,
  IconPaw,
  IconFish,
  IconCat,
  IconDog,
  IconHorse,
  IconBug,
  IconButterfly,
  // Health
  IconStethoscope,
  IconFirstAidKit,
  IconPill,
  IconVaccine,
  // Food / drink
  IconCoffee,
  IconBeer,
  IconPizza,
  IconCookie,
  IconCarrot,
  IconApple,
  IconBread,
  IconCheese,
  IconGrain,
  // Layout / UI / table
  IconSearch,
  IconFilter,
  IconSortAscending,
  IconSortDescending,
  IconLayoutGrid,
  IconLayoutList,
  IconLayoutDashboard,
  IconList,
  IconColumns,
  IconTableImport,
  IconTableExport,
  // Actions
  IconUpload,
  IconDownload,
  IconCloudUpload,
  IconCloudDownload,
  IconLink,
  IconUnlink,
  IconExternalLink,
  IconCopy,
  IconCut,
  IconRecycle,
  IconRecycleOff,
  IconTrash,
  IconPlus,
  IconMinus,
  IconEdit,
  IconPencil,
  IconHighlight,
  IconBallpen,
  IconEraser,
  IconBackpack,
  // Science / misc
  IconFlask,
  IconAtom,
  IconMicroscope,
  IconSwords,
  IconFireHydrant,
  IconTie,
  IconShirt,
  // Header (for dialogs)
  IconPalette as IconPaletteHeader,
} from "@tabler/icons-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { ScrollArea } from "../../components/ui/scroll-area";

// ============================================================
// Color palette
// ============================================================
//
// Colors are grouped by hue family. Each group surfaces in the picker as a
// labelled section. Every entry maps the same tone across light and dark
// mode so the title text, header icon, dot, left accent border, and card
// outer border all stay in sync.

export type WidgetAccentColor =
  // Neutral
  | "gray"
  | "slate"
  | "zinc"
  | "stone"
  // Warm
  | "red"
  | "orange"
  | "amber"
  | "yellow"
  // Nature
  | "lime"
  | "green"
  | "emerald"
  | "teal"
  // Cool
  | "cyan"
  | "sky"
  | "blue"
  | "indigo"
  // Rich
  | "violet"
  | "purple"
  | "fuchsia"
  | "pink"
  | "rose";

export type WidgetAccentColorGroup =
  | "neutral"
  | "warm"
  | "nature"
  | "cool"
  | "rich";

interface AccentColorClasses {
  /** Title text color (header). */
  text: string;
  /** Icon foreground (header icon). */
  icon: string;
  /** Small dot / badge before each row's primary cell. */
  dot: string;
  /** Optional left-border accent. */
  border: string;
  /** Card outer border (used when this color is picked as the widget border). */
  cardBorder: string;
}

export const ACCENT_COLOR_CLASSES: Record<WidgetAccentColor, AccentColorClasses> = {
  // ----- Neutral -----
  gray: {
    text: "text-secondary-foreground",
    icon: "text-muted-foreground",
    dot: "bg-muted-foreground",
    border: "border-l-muted-foreground/40",
    cardBorder: "border-muted-foreground/50",
  },
  slate: {
    text: "text-slate-700 dark:text-slate-300",
    icon: "text-slate-600 dark:text-slate-400",
    dot: "bg-slate-500 dark:bg-slate-400",
    border: "border-l-slate-500/40 dark:border-l-slate-400/40",
    cardBorder: "border-slate-500/50 dark:border-slate-400/50",
  },
  zinc: {
    text: "text-zinc-700 dark:text-zinc-300",
    icon: "text-zinc-600 dark:text-zinc-400",
    dot: "bg-zinc-500 dark:bg-zinc-400",
    border: "border-l-zinc-500/40 dark:border-l-zinc-400/40",
    cardBorder: "border-zinc-500/50 dark:border-zinc-400/50",
  },
  stone: {
    text: "text-stone-700 dark:text-stone-300",
    icon: "text-stone-600 dark:text-stone-400",
    dot: "bg-stone-500 dark:bg-stone-400",
    border: "border-l-stone-500/40 dark:border-l-stone-400/40",
    cardBorder: "border-stone-500/50 dark:border-stone-400/50",
  },
  // ----- Warm -----
  red: {
    text: "text-red-700 dark:text-red-300",
    icon: "text-red-600 dark:text-red-400",
    dot: "bg-red-500 dark:bg-red-400",
    border: "border-l-red-500/40 dark:border-l-red-400/40",
    cardBorder: "border-red-500/50 dark:border-red-400/50",
  },
  orange: {
    text: "text-orange-700 dark:text-orange-300",
    icon: "text-orange-600 dark:text-orange-400",
    dot: "bg-orange-500 dark:bg-orange-400",
    border: "border-l-orange-500/40 dark:border-l-orange-400/40",
    cardBorder: "border-orange-500/50 dark:border-orange-400/50",
  },
  amber: {
    text: "text-amber-700 dark:text-amber-300",
    icon: "text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500 dark:bg-amber-400",
    border: "border-l-amber-500/40 dark:border-l-amber-400/40",
    cardBorder: "border-amber-500/50 dark:border-amber-400/50",
  },
  yellow: {
    text: "text-yellow-700 dark:text-yellow-300",
    icon: "text-yellow-600 dark:text-yellow-400",
    dot: "bg-yellow-500 dark:bg-yellow-400",
    border: "border-l-yellow-500/40 dark:border-l-yellow-400/40",
    cardBorder: "border-yellow-500/50 dark:border-yellow-400/50",
  },
  // ----- Nature -----
  lime: {
    text: "text-lime-700 dark:text-lime-300",
    icon: "text-lime-600 dark:text-lime-400",
    dot: "bg-lime-500 dark:bg-lime-400",
    border: "border-l-lime-500/40 dark:border-l-lime-400/40",
    cardBorder: "border-lime-500/50 dark:border-lime-400/50",
  },
  green: {
    text: "text-green-700 dark:text-green-300",
    icon: "text-green-600 dark:text-green-400",
    dot: "bg-green-500 dark:bg-green-400",
    border: "border-l-green-500/40 dark:border-l-green-400/40",
    cardBorder: "border-green-500/50 dark:border-green-400/50",
  },
  emerald: {
    text: "text-emerald-700 dark:text-emerald-300",
    icon: "text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500 dark:bg-emerald-400",
    border: "border-l-emerald-500/40 dark:border-l-emerald-400/40",
    cardBorder: "border-emerald-500/50 dark:border-emerald-400/50",
  },
  teal: {
    text: "text-teal-700 dark:text-teal-300",
    icon: "text-teal-600 dark:text-teal-400",
    dot: "bg-teal-500 dark:bg-teal-400",
    border: "border-l-teal-500/40 dark:border-l-teal-400/40",
    cardBorder: "border-teal-500/50 dark:border-teal-400/50",
  },
  // ----- Cool -----
  cyan: {
    text: "text-cyan-700 dark:text-cyan-300",
    icon: "text-cyan-600 dark:text-cyan-400",
    dot: "bg-cyan-500 dark:bg-cyan-400",
    border: "border-l-cyan-500/40 dark:border-l-cyan-400/40",
    cardBorder: "border-cyan-500/50 dark:border-cyan-400/50",
  },
  sky: {
    text: "text-sky-700 dark:text-sky-300",
    icon: "text-sky-600 dark:text-sky-400",
    dot: "bg-sky-500 dark:bg-sky-400",
    border: "border-l-sky-500/40 dark:border-l-sky-400/40",
    cardBorder: "border-sky-500/50 dark:border-sky-400/50",
  },
  blue: {
    text: "text-blue-700 dark:text-blue-300",
    icon: "text-blue-600 dark:text-blue-400",
    dot: "bg-blue-500 dark:bg-blue-400",
    border: "border-l-blue-500/40 dark:border-l-blue-400/40",
    cardBorder: "border-blue-500/50 dark:border-blue-400/50",
  },
  indigo: {
    text: "text-indigo-700 dark:text-indigo-300",
    icon: "text-indigo-600 dark:text-indigo-400",
    dot: "bg-indigo-500 dark:bg-indigo-400",
    border: "border-l-indigo-500/40 dark:border-l-indigo-400/40",
    cardBorder: "border-indigo-500/50 dark:border-indigo-400/50",
  },
  // ----- Rich -----
  violet: {
    text: "text-violet-700 dark:text-violet-300",
    icon: "text-violet-600 dark:text-violet-400",
    dot: "bg-violet-500 dark:bg-violet-400",
    border: "border-l-violet-500/40 dark:border-l-violet-400/40",
    cardBorder: "border-violet-500/50 dark:border-violet-400/50",
  },
  purple: {
    text: "text-purple-700 dark:text-purple-300",
    icon: "text-purple-600 dark:text-purple-400",
    dot: "bg-purple-500 dark:bg-purple-400",
    border: "border-l-purple-500/40 dark:border-l-purple-400/40",
    cardBorder: "border-purple-500/50 dark:border-purple-400/50",
  },
  fuchsia: {
    text: "text-fuchsia-700 dark:text-fuchsia-300",
    icon: "text-fuchsia-600 dark:text-fuchsia-400",
    dot: "bg-fuchsia-500 dark:bg-fuchsia-400",
    border: "border-l-fuchsia-500/40 dark:border-l-fuchsia-400/40",
    cardBorder: "border-fuchsia-500/50 dark:border-fuchsia-400/50",
  },
  pink: {
    text: "text-pink-700 dark:text-pink-300",
    icon: "text-pink-600 dark:text-pink-400",
    dot: "bg-pink-500 dark:bg-pink-400",
    border: "border-l-pink-500/40 dark:border-l-pink-400/40",
    cardBorder: "border-pink-500/50 dark:border-pink-400/50",
  },
  rose: {
    text: "text-rose-700 dark:text-rose-300",
    icon: "text-rose-600 dark:text-rose-400",
    dot: "bg-rose-500 dark:bg-rose-400",
    border: "border-l-rose-500/40 dark:border-l-rose-400/40",
    cardBorder: "border-rose-500/50 dark:border-rose-400/50",
  },
};


// ============================================================
// Per-shade palette (Tailwind-style 50→950 grid)
// ============================================================
//
// The palette dialog mirrors Tailwind's color reference page: each color
// (e.g., "Red", "Emerald") becomes a row of 11 swatches across shades 50–950.
// To pick a shade, the user clicks a swatch.
//
// Tailwind's JIT compiler can only emit classes that appear as LITERAL
// strings in the source — anything constructed at runtime via template
// strings (e.g., `text-${color}-${shade}`) gets tree-shaken. So the full
// 22 colors × 11 shades × 5 class kinds (~1200 entries) is hardcoded below.
// The table is mechanically generated; see /tmp/gen-shades.js. Add a color
// or shade and re-run the generator to regenerate this section.
//
// `PaletteColor` covers every color used by the widget accent picker (21)
// plus the deadline-color palette's `neutral` (the deadline picker reuses
// the same dialog). `PaletteShade` covers all 11 Tailwind tints.

export type PaletteColor =
  | "gray"
  | "slate"
  | "zinc"
  | "neutral"
  | "stone"
  | "red"
  | "orange"
  | "amber"
  | "yellow"
  | "lime"
  | "green"
  | "emerald"
  | "teal"
  | "cyan"
  | "sky"
  | "blue"
  | "indigo"
  | "violet"
  | "purple"
  | "fuchsia"
  | "pink"
  | "rose";

export type PaletteShade =
  | "50"
  | "100"
  | "200"
  | "300"
  | "400"
  | "500"
  | "600"
  | "700"
  | "800"
  | "900"
  | "950";

export const PALETTE_SHADES: readonly PaletteShade[] = [
  "50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950",
] as const;

export const PALETTE_SHADE_CLASSES: Record<PaletteColor, Record<PaletteShade, AccentColorClasses>> = {
  gray: {
    "50": {
      text: "text-gray-50 dark:text-gray-50",
      icon: "text-gray-50 dark:text-gray-50",
      dot: "bg-gray-50 dark:bg-gray-50",
      border: "border-l-gray-50/40 dark:border-l-gray-50/40",
      cardBorder: "border-gray-50/50 dark:border-gray-50/50",
    },
    "100": {
      text: "text-gray-100 dark:text-gray-100",
      icon: "text-gray-100 dark:text-gray-100",
      dot: "bg-gray-100 dark:bg-gray-100",
      border: "border-l-gray-100/40 dark:border-l-gray-100/40",
      cardBorder: "border-gray-100/50 dark:border-gray-100/50",
    },
    "200": {
      text: "text-gray-200 dark:text-gray-200",
      icon: "text-gray-200 dark:text-gray-200",
      dot: "bg-gray-200 dark:bg-gray-200",
      border: "border-l-gray-200/40 dark:border-l-gray-200/40",
      cardBorder: "border-gray-200/50 dark:border-gray-200/50",
    },
    "300": {
      text: "text-gray-300 dark:text-gray-300",
      icon: "text-gray-300 dark:text-gray-300",
      dot: "bg-gray-300 dark:bg-gray-300",
      border: "border-l-gray-300/40 dark:border-l-gray-300/40",
      cardBorder: "border-gray-300/50 dark:border-gray-300/50",
    },
    "400": {
      text: "text-gray-400 dark:text-gray-400",
      icon: "text-gray-400 dark:text-gray-400",
      dot: "bg-gray-400 dark:bg-gray-400",
      border: "border-l-gray-400/40 dark:border-l-gray-400/40",
      cardBorder: "border-gray-400/50 dark:border-gray-400/50",
    },
    "500": {
      text: "text-gray-500 dark:text-gray-500",
      icon: "text-gray-500 dark:text-gray-500",
      dot: "bg-gray-500 dark:bg-gray-500",
      border: "border-l-gray-500/40 dark:border-l-gray-500/40",
      cardBorder: "border-gray-500/50 dark:border-gray-500/50",
    },
    "600": {
      text: "text-gray-600 dark:text-gray-600",
      icon: "text-gray-600 dark:text-gray-600",
      dot: "bg-gray-600 dark:bg-gray-600",
      border: "border-l-gray-600/40 dark:border-l-gray-600/40",
      cardBorder: "border-gray-600/50 dark:border-gray-600/50",
    },
    "700": {
      text: "text-gray-700 dark:text-gray-700",
      icon: "text-gray-700 dark:text-gray-700",
      dot: "bg-gray-700 dark:bg-gray-700",
      border: "border-l-gray-700/40 dark:border-l-gray-700/40",
      cardBorder: "border-gray-700/50 dark:border-gray-700/50",
    },
    "800": {
      text: "text-gray-800 dark:text-gray-800",
      icon: "text-gray-800 dark:text-gray-800",
      dot: "bg-gray-800 dark:bg-gray-800",
      border: "border-l-gray-800/40 dark:border-l-gray-800/40",
      cardBorder: "border-gray-800/50 dark:border-gray-800/50",
    },
    "900": {
      text: "text-gray-900 dark:text-gray-900",
      icon: "text-gray-900 dark:text-gray-900",
      dot: "bg-gray-900 dark:bg-gray-900",
      border: "border-l-gray-900/40 dark:border-l-gray-900/40",
      cardBorder: "border-gray-900/50 dark:border-gray-900/50",
    },
    "950": {
      text: "text-gray-950 dark:text-gray-950",
      icon: "text-gray-950 dark:text-gray-950",
      dot: "bg-gray-950 dark:bg-gray-950",
      border: "border-l-gray-950/40 dark:border-l-gray-950/40",
      cardBorder: "border-gray-950/50 dark:border-gray-950/50",
    },
  },
  slate: {
    "50": {
      text: "text-slate-50 dark:text-slate-50",
      icon: "text-slate-50 dark:text-slate-50",
      dot: "bg-slate-50 dark:bg-slate-50",
      border: "border-l-slate-50/40 dark:border-l-slate-50/40",
      cardBorder: "border-slate-50/50 dark:border-slate-50/50",
    },
    "100": {
      text: "text-slate-100 dark:text-slate-100",
      icon: "text-slate-100 dark:text-slate-100",
      dot: "bg-slate-100 dark:bg-slate-100",
      border: "border-l-slate-100/40 dark:border-l-slate-100/40",
      cardBorder: "border-slate-100/50 dark:border-slate-100/50",
    },
    "200": {
      text: "text-slate-200 dark:text-slate-200",
      icon: "text-slate-200 dark:text-slate-200",
      dot: "bg-slate-200 dark:bg-slate-200",
      border: "border-l-slate-200/40 dark:border-l-slate-200/40",
      cardBorder: "border-slate-200/50 dark:border-slate-200/50",
    },
    "300": {
      text: "text-slate-300 dark:text-slate-300",
      icon: "text-slate-300 dark:text-slate-300",
      dot: "bg-slate-300 dark:bg-slate-300",
      border: "border-l-slate-300/40 dark:border-l-slate-300/40",
      cardBorder: "border-slate-300/50 dark:border-slate-300/50",
    },
    "400": {
      text: "text-slate-400 dark:text-slate-400",
      icon: "text-slate-400 dark:text-slate-400",
      dot: "bg-slate-400 dark:bg-slate-400",
      border: "border-l-slate-400/40 dark:border-l-slate-400/40",
      cardBorder: "border-slate-400/50 dark:border-slate-400/50",
    },
    "500": {
      text: "text-slate-500 dark:text-slate-500",
      icon: "text-slate-500 dark:text-slate-500",
      dot: "bg-slate-500 dark:bg-slate-500",
      border: "border-l-slate-500/40 dark:border-l-slate-500/40",
      cardBorder: "border-slate-500/50 dark:border-slate-500/50",
    },
    "600": {
      text: "text-slate-600 dark:text-slate-600",
      icon: "text-slate-600 dark:text-slate-600",
      dot: "bg-slate-600 dark:bg-slate-600",
      border: "border-l-slate-600/40 dark:border-l-slate-600/40",
      cardBorder: "border-slate-600/50 dark:border-slate-600/50",
    },
    "700": {
      text: "text-slate-700 dark:text-slate-700",
      icon: "text-slate-700 dark:text-slate-700",
      dot: "bg-slate-700 dark:bg-slate-700",
      border: "border-l-slate-700/40 dark:border-l-slate-700/40",
      cardBorder: "border-slate-700/50 dark:border-slate-700/50",
    },
    "800": {
      text: "text-slate-800 dark:text-slate-800",
      icon: "text-slate-800 dark:text-slate-800",
      dot: "bg-slate-800 dark:bg-slate-800",
      border: "border-l-slate-800/40 dark:border-l-slate-800/40",
      cardBorder: "border-slate-800/50 dark:border-slate-800/50",
    },
    "900": {
      text: "text-slate-900 dark:text-slate-900",
      icon: "text-slate-900 dark:text-slate-900",
      dot: "bg-slate-900 dark:bg-slate-900",
      border: "border-l-slate-900/40 dark:border-l-slate-900/40",
      cardBorder: "border-slate-900/50 dark:border-slate-900/50",
    },
    "950": {
      text: "text-slate-950 dark:text-slate-950",
      icon: "text-slate-950 dark:text-slate-950",
      dot: "bg-slate-950 dark:bg-slate-950",
      border: "border-l-slate-950/40 dark:border-l-slate-950/40",
      cardBorder: "border-slate-950/50 dark:border-slate-950/50",
    },
  },
  zinc: {
    "50": {
      text: "text-zinc-50 dark:text-zinc-50",
      icon: "text-zinc-50 dark:text-zinc-50",
      dot: "bg-zinc-50 dark:bg-zinc-50",
      border: "border-l-zinc-50/40 dark:border-l-zinc-50/40",
      cardBorder: "border-zinc-50/50 dark:border-zinc-50/50",
    },
    "100": {
      text: "text-zinc-100 dark:text-zinc-100",
      icon: "text-zinc-100 dark:text-zinc-100",
      dot: "bg-zinc-100 dark:bg-zinc-100",
      border: "border-l-zinc-100/40 dark:border-l-zinc-100/40",
      cardBorder: "border-zinc-100/50 dark:border-zinc-100/50",
    },
    "200": {
      text: "text-zinc-200 dark:text-zinc-200",
      icon: "text-zinc-200 dark:text-zinc-200",
      dot: "bg-zinc-200 dark:bg-zinc-200",
      border: "border-l-zinc-200/40 dark:border-l-zinc-200/40",
      cardBorder: "border-zinc-200/50 dark:border-zinc-200/50",
    },
    "300": {
      text: "text-zinc-300 dark:text-zinc-300",
      icon: "text-zinc-300 dark:text-zinc-300",
      dot: "bg-zinc-300 dark:bg-zinc-300",
      border: "border-l-zinc-300/40 dark:border-l-zinc-300/40",
      cardBorder: "border-zinc-300/50 dark:border-zinc-300/50",
    },
    "400": {
      text: "text-zinc-400 dark:text-zinc-400",
      icon: "text-zinc-400 dark:text-zinc-400",
      dot: "bg-zinc-400 dark:bg-zinc-400",
      border: "border-l-zinc-400/40 dark:border-l-zinc-400/40",
      cardBorder: "border-zinc-400/50 dark:border-zinc-400/50",
    },
    "500": {
      text: "text-zinc-500 dark:text-zinc-500",
      icon: "text-zinc-500 dark:text-zinc-500",
      dot: "bg-zinc-500 dark:bg-zinc-500",
      border: "border-l-zinc-500/40 dark:border-l-zinc-500/40",
      cardBorder: "border-zinc-500/50 dark:border-zinc-500/50",
    },
    "600": {
      text: "text-zinc-600 dark:text-zinc-600",
      icon: "text-zinc-600 dark:text-zinc-600",
      dot: "bg-zinc-600 dark:bg-zinc-600",
      border: "border-l-zinc-600/40 dark:border-l-zinc-600/40",
      cardBorder: "border-zinc-600/50 dark:border-zinc-600/50",
    },
    "700": {
      text: "text-zinc-700 dark:text-zinc-700",
      icon: "text-zinc-700 dark:text-zinc-700",
      dot: "bg-zinc-700 dark:bg-zinc-700",
      border: "border-l-zinc-700/40 dark:border-l-zinc-700/40",
      cardBorder: "border-zinc-700/50 dark:border-zinc-700/50",
    },
    "800": {
      text: "text-zinc-800 dark:text-zinc-800",
      icon: "text-zinc-800 dark:text-zinc-800",
      dot: "bg-zinc-800 dark:bg-zinc-800",
      border: "border-l-zinc-800/40 dark:border-l-zinc-800/40",
      cardBorder: "border-zinc-800/50 dark:border-zinc-800/50",
    },
    "900": {
      text: "text-zinc-900 dark:text-zinc-900",
      icon: "text-zinc-900 dark:text-zinc-900",
      dot: "bg-zinc-900 dark:bg-zinc-900",
      border: "border-l-zinc-900/40 dark:border-l-zinc-900/40",
      cardBorder: "border-zinc-900/50 dark:border-zinc-900/50",
    },
    "950": {
      text: "text-zinc-950 dark:text-zinc-950",
      icon: "text-zinc-950 dark:text-zinc-950",
      dot: "bg-zinc-950 dark:bg-zinc-950",
      border: "border-l-zinc-950/40 dark:border-l-zinc-950/40",
      cardBorder: "border-zinc-950/50 dark:border-zinc-950/50",
    },
  },
  neutral: {
    "50": {
      text: "text-neutral-50 dark:text-neutral-50",
      icon: "text-neutral-50 dark:text-neutral-50",
      dot: "bg-neutral-50 dark:bg-neutral-50",
      border: "border-l-neutral-50/40 dark:border-l-neutral-50/40",
      cardBorder: "border-neutral-50/50 dark:border-neutral-50/50",
    },
    "100": {
      text: "text-neutral-100 dark:text-neutral-100",
      icon: "text-neutral-100 dark:text-neutral-100",
      dot: "bg-neutral-100 dark:bg-neutral-100",
      border: "border-l-neutral-100/40 dark:border-l-neutral-100/40",
      cardBorder: "border-neutral-100/50 dark:border-neutral-100/50",
    },
    "200": {
      text: "text-neutral-200 dark:text-neutral-200",
      icon: "text-neutral-200 dark:text-neutral-200",
      dot: "bg-neutral-200 dark:bg-neutral-200",
      border: "border-l-neutral-200/40 dark:border-l-neutral-200/40",
      cardBorder: "border-neutral-200/50 dark:border-neutral-200/50",
    },
    "300": {
      text: "text-neutral-300 dark:text-neutral-300",
      icon: "text-neutral-300 dark:text-neutral-300",
      dot: "bg-neutral-300 dark:bg-neutral-300",
      border: "border-l-neutral-300/40 dark:border-l-neutral-300/40",
      cardBorder: "border-neutral-300/50 dark:border-neutral-300/50",
    },
    "400": {
      text: "text-neutral-400 dark:text-neutral-400",
      icon: "text-neutral-400 dark:text-neutral-400",
      dot: "bg-neutral-400 dark:bg-neutral-400",
      border: "border-l-neutral-400/40 dark:border-l-neutral-400/40",
      cardBorder: "border-neutral-400/50 dark:border-neutral-400/50",
    },
    "500": {
      text: "text-neutral-500 dark:text-neutral-500",
      icon: "text-neutral-500 dark:text-neutral-500",
      dot: "bg-neutral-500 dark:bg-neutral-500",
      border: "border-l-neutral-500/40 dark:border-l-neutral-500/40",
      cardBorder: "border-neutral-500/50 dark:border-neutral-500/50",
    },
    "600": {
      text: "text-neutral-600 dark:text-neutral-600",
      icon: "text-neutral-600 dark:text-neutral-600",
      dot: "bg-neutral-600 dark:bg-neutral-600",
      border: "border-l-neutral-600/40 dark:border-l-neutral-600/40",
      cardBorder: "border-neutral-600/50 dark:border-neutral-600/50",
    },
    "700": {
      text: "text-neutral-700 dark:text-neutral-700",
      icon: "text-neutral-700 dark:text-neutral-700",
      dot: "bg-neutral-700 dark:bg-neutral-700",
      border: "border-l-neutral-700/40 dark:border-l-neutral-700/40",
      cardBorder: "border-neutral-700/50 dark:border-neutral-700/50",
    },
    "800": {
      text: "text-neutral-800 dark:text-neutral-800",
      icon: "text-neutral-800 dark:text-neutral-800",
      dot: "bg-neutral-800 dark:bg-neutral-800",
      border: "border-l-neutral-800/40 dark:border-l-neutral-800/40",
      cardBorder: "border-neutral-800/50 dark:border-neutral-800/50",
    },
    "900": {
      text: "text-neutral-900 dark:text-neutral-900",
      icon: "text-neutral-900 dark:text-neutral-900",
      dot: "bg-neutral-900 dark:bg-neutral-900",
      border: "border-l-neutral-900/40 dark:border-l-neutral-900/40",
      cardBorder: "border-neutral-900/50 dark:border-neutral-900/50",
    },
    "950": {
      text: "text-neutral-950 dark:text-neutral-950",
      icon: "text-neutral-950 dark:text-neutral-950",
      dot: "bg-neutral-950 dark:bg-neutral-950",
      border: "border-l-neutral-950/40 dark:border-l-neutral-950/40",
      cardBorder: "border-neutral-950/50 dark:border-neutral-950/50",
    },
  },
  stone: {
    "50": {
      text: "text-stone-50 dark:text-stone-50",
      icon: "text-stone-50 dark:text-stone-50",
      dot: "bg-stone-50 dark:bg-stone-50",
      border: "border-l-stone-50/40 dark:border-l-stone-50/40",
      cardBorder: "border-stone-50/50 dark:border-stone-50/50",
    },
    "100": {
      text: "text-stone-100 dark:text-stone-100",
      icon: "text-stone-100 dark:text-stone-100",
      dot: "bg-stone-100 dark:bg-stone-100",
      border: "border-l-stone-100/40 dark:border-l-stone-100/40",
      cardBorder: "border-stone-100/50 dark:border-stone-100/50",
    },
    "200": {
      text: "text-stone-200 dark:text-stone-200",
      icon: "text-stone-200 dark:text-stone-200",
      dot: "bg-stone-200 dark:bg-stone-200",
      border: "border-l-stone-200/40 dark:border-l-stone-200/40",
      cardBorder: "border-stone-200/50 dark:border-stone-200/50",
    },
    "300": {
      text: "text-stone-300 dark:text-stone-300",
      icon: "text-stone-300 dark:text-stone-300",
      dot: "bg-stone-300 dark:bg-stone-300",
      border: "border-l-stone-300/40 dark:border-l-stone-300/40",
      cardBorder: "border-stone-300/50 dark:border-stone-300/50",
    },
    "400": {
      text: "text-stone-400 dark:text-stone-400",
      icon: "text-stone-400 dark:text-stone-400",
      dot: "bg-stone-400 dark:bg-stone-400",
      border: "border-l-stone-400/40 dark:border-l-stone-400/40",
      cardBorder: "border-stone-400/50 dark:border-stone-400/50",
    },
    "500": {
      text: "text-stone-500 dark:text-stone-500",
      icon: "text-stone-500 dark:text-stone-500",
      dot: "bg-stone-500 dark:bg-stone-500",
      border: "border-l-stone-500/40 dark:border-l-stone-500/40",
      cardBorder: "border-stone-500/50 dark:border-stone-500/50",
    },
    "600": {
      text: "text-stone-600 dark:text-stone-600",
      icon: "text-stone-600 dark:text-stone-600",
      dot: "bg-stone-600 dark:bg-stone-600",
      border: "border-l-stone-600/40 dark:border-l-stone-600/40",
      cardBorder: "border-stone-600/50 dark:border-stone-600/50",
    },
    "700": {
      text: "text-stone-700 dark:text-stone-700",
      icon: "text-stone-700 dark:text-stone-700",
      dot: "bg-stone-700 dark:bg-stone-700",
      border: "border-l-stone-700/40 dark:border-l-stone-700/40",
      cardBorder: "border-stone-700/50 dark:border-stone-700/50",
    },
    "800": {
      text: "text-stone-800 dark:text-stone-800",
      icon: "text-stone-800 dark:text-stone-800",
      dot: "bg-stone-800 dark:bg-stone-800",
      border: "border-l-stone-800/40 dark:border-l-stone-800/40",
      cardBorder: "border-stone-800/50 dark:border-stone-800/50",
    },
    "900": {
      text: "text-stone-900 dark:text-stone-900",
      icon: "text-stone-900 dark:text-stone-900",
      dot: "bg-stone-900 dark:bg-stone-900",
      border: "border-l-stone-900/40 dark:border-l-stone-900/40",
      cardBorder: "border-stone-900/50 dark:border-stone-900/50",
    },
    "950": {
      text: "text-stone-950 dark:text-stone-950",
      icon: "text-stone-950 dark:text-stone-950",
      dot: "bg-stone-950 dark:bg-stone-950",
      border: "border-l-stone-950/40 dark:border-l-stone-950/40",
      cardBorder: "border-stone-950/50 dark:border-stone-950/50",
    },
  },
  red: {
    "50": {
      text: "text-red-50 dark:text-red-50",
      icon: "text-red-50 dark:text-red-50",
      dot: "bg-red-50 dark:bg-red-50",
      border: "border-l-red-50/40 dark:border-l-red-50/40",
      cardBorder: "border-red-50/50 dark:border-red-50/50",
    },
    "100": {
      text: "text-red-100 dark:text-red-100",
      icon: "text-red-100 dark:text-red-100",
      dot: "bg-red-100 dark:bg-red-100",
      border: "border-l-red-100/40 dark:border-l-red-100/40",
      cardBorder: "border-red-100/50 dark:border-red-100/50",
    },
    "200": {
      text: "text-red-200 dark:text-red-200",
      icon: "text-red-200 dark:text-red-200",
      dot: "bg-red-200 dark:bg-red-200",
      border: "border-l-red-200/40 dark:border-l-red-200/40",
      cardBorder: "border-red-200/50 dark:border-red-200/50",
    },
    "300": {
      text: "text-red-300 dark:text-red-300",
      icon: "text-red-300 dark:text-red-300",
      dot: "bg-red-300 dark:bg-red-300",
      border: "border-l-red-300/40 dark:border-l-red-300/40",
      cardBorder: "border-red-300/50 dark:border-red-300/50",
    },
    "400": {
      text: "text-red-400 dark:text-red-400",
      icon: "text-red-400 dark:text-red-400",
      dot: "bg-red-400 dark:bg-red-400",
      border: "border-l-red-400/40 dark:border-l-red-400/40",
      cardBorder: "border-red-400/50 dark:border-red-400/50",
    },
    "500": {
      text: "text-red-500 dark:text-red-500",
      icon: "text-red-500 dark:text-red-500",
      dot: "bg-red-500 dark:bg-red-500",
      border: "border-l-red-500/40 dark:border-l-red-500/40",
      cardBorder: "border-red-500/50 dark:border-red-500/50",
    },
    "600": {
      text: "text-red-600 dark:text-red-600",
      icon: "text-red-600 dark:text-red-600",
      dot: "bg-red-600 dark:bg-red-600",
      border: "border-l-red-600/40 dark:border-l-red-600/40",
      cardBorder: "border-red-600/50 dark:border-red-600/50",
    },
    "700": {
      text: "text-red-700 dark:text-red-700",
      icon: "text-red-700 dark:text-red-700",
      dot: "bg-red-700 dark:bg-red-700",
      border: "border-l-red-700/40 dark:border-l-red-700/40",
      cardBorder: "border-red-700/50 dark:border-red-700/50",
    },
    "800": {
      text: "text-red-800 dark:text-red-800",
      icon: "text-red-800 dark:text-red-800",
      dot: "bg-red-800 dark:bg-red-800",
      border: "border-l-red-800/40 dark:border-l-red-800/40",
      cardBorder: "border-red-800/50 dark:border-red-800/50",
    },
    "900": {
      text: "text-red-900 dark:text-red-900",
      icon: "text-red-900 dark:text-red-900",
      dot: "bg-red-900 dark:bg-red-900",
      border: "border-l-red-900/40 dark:border-l-red-900/40",
      cardBorder: "border-red-900/50 dark:border-red-900/50",
    },
    "950": {
      text: "text-red-950 dark:text-red-950",
      icon: "text-red-950 dark:text-red-950",
      dot: "bg-red-950 dark:bg-red-950",
      border: "border-l-red-950/40 dark:border-l-red-950/40",
      cardBorder: "border-red-950/50 dark:border-red-950/50",
    },
  },
  orange: {
    "50": {
      text: "text-orange-50 dark:text-orange-50",
      icon: "text-orange-50 dark:text-orange-50",
      dot: "bg-orange-50 dark:bg-orange-50",
      border: "border-l-orange-50/40 dark:border-l-orange-50/40",
      cardBorder: "border-orange-50/50 dark:border-orange-50/50",
    },
    "100": {
      text: "text-orange-100 dark:text-orange-100",
      icon: "text-orange-100 dark:text-orange-100",
      dot: "bg-orange-100 dark:bg-orange-100",
      border: "border-l-orange-100/40 dark:border-l-orange-100/40",
      cardBorder: "border-orange-100/50 dark:border-orange-100/50",
    },
    "200": {
      text: "text-orange-200 dark:text-orange-200",
      icon: "text-orange-200 dark:text-orange-200",
      dot: "bg-orange-200 dark:bg-orange-200",
      border: "border-l-orange-200/40 dark:border-l-orange-200/40",
      cardBorder: "border-orange-200/50 dark:border-orange-200/50",
    },
    "300": {
      text: "text-orange-300 dark:text-orange-300",
      icon: "text-orange-300 dark:text-orange-300",
      dot: "bg-orange-300 dark:bg-orange-300",
      border: "border-l-orange-300/40 dark:border-l-orange-300/40",
      cardBorder: "border-orange-300/50 dark:border-orange-300/50",
    },
    "400": {
      text: "text-orange-400 dark:text-orange-400",
      icon: "text-orange-400 dark:text-orange-400",
      dot: "bg-orange-400 dark:bg-orange-400",
      border: "border-l-orange-400/40 dark:border-l-orange-400/40",
      cardBorder: "border-orange-400/50 dark:border-orange-400/50",
    },
    "500": {
      text: "text-orange-500 dark:text-orange-500",
      icon: "text-orange-500 dark:text-orange-500",
      dot: "bg-orange-500 dark:bg-orange-500",
      border: "border-l-orange-500/40 dark:border-l-orange-500/40",
      cardBorder: "border-orange-500/50 dark:border-orange-500/50",
    },
    "600": {
      text: "text-orange-600 dark:text-orange-600",
      icon: "text-orange-600 dark:text-orange-600",
      dot: "bg-orange-600 dark:bg-orange-600",
      border: "border-l-orange-600/40 dark:border-l-orange-600/40",
      cardBorder: "border-orange-600/50 dark:border-orange-600/50",
    },
    "700": {
      text: "text-orange-700 dark:text-orange-700",
      icon: "text-orange-700 dark:text-orange-700",
      dot: "bg-orange-700 dark:bg-orange-700",
      border: "border-l-orange-700/40 dark:border-l-orange-700/40",
      cardBorder: "border-orange-700/50 dark:border-orange-700/50",
    },
    "800": {
      text: "text-orange-800 dark:text-orange-800",
      icon: "text-orange-800 dark:text-orange-800",
      dot: "bg-orange-800 dark:bg-orange-800",
      border: "border-l-orange-800/40 dark:border-l-orange-800/40",
      cardBorder: "border-orange-800/50 dark:border-orange-800/50",
    },
    "900": {
      text: "text-orange-900 dark:text-orange-900",
      icon: "text-orange-900 dark:text-orange-900",
      dot: "bg-orange-900 dark:bg-orange-900",
      border: "border-l-orange-900/40 dark:border-l-orange-900/40",
      cardBorder: "border-orange-900/50 dark:border-orange-900/50",
    },
    "950": {
      text: "text-orange-950 dark:text-orange-950",
      icon: "text-orange-950 dark:text-orange-950",
      dot: "bg-orange-950 dark:bg-orange-950",
      border: "border-l-orange-950/40 dark:border-l-orange-950/40",
      cardBorder: "border-orange-950/50 dark:border-orange-950/50",
    },
  },
  amber: {
    "50": {
      text: "text-amber-50 dark:text-amber-50",
      icon: "text-amber-50 dark:text-amber-50",
      dot: "bg-amber-50 dark:bg-amber-50",
      border: "border-l-amber-50/40 dark:border-l-amber-50/40",
      cardBorder: "border-amber-50/50 dark:border-amber-50/50",
    },
    "100": {
      text: "text-amber-100 dark:text-amber-100",
      icon: "text-amber-100 dark:text-amber-100",
      dot: "bg-amber-100 dark:bg-amber-100",
      border: "border-l-amber-100/40 dark:border-l-amber-100/40",
      cardBorder: "border-amber-100/50 dark:border-amber-100/50",
    },
    "200": {
      text: "text-amber-200 dark:text-amber-200",
      icon: "text-amber-200 dark:text-amber-200",
      dot: "bg-amber-200 dark:bg-amber-200",
      border: "border-l-amber-200/40 dark:border-l-amber-200/40",
      cardBorder: "border-amber-200/50 dark:border-amber-200/50",
    },
    "300": {
      text: "text-amber-300 dark:text-amber-300",
      icon: "text-amber-300 dark:text-amber-300",
      dot: "bg-amber-300 dark:bg-amber-300",
      border: "border-l-amber-300/40 dark:border-l-amber-300/40",
      cardBorder: "border-amber-300/50 dark:border-amber-300/50",
    },
    "400": {
      text: "text-amber-400 dark:text-amber-400",
      icon: "text-amber-400 dark:text-amber-400",
      dot: "bg-amber-400 dark:bg-amber-400",
      border: "border-l-amber-400/40 dark:border-l-amber-400/40",
      cardBorder: "border-amber-400/50 dark:border-amber-400/50",
    },
    "500": {
      text: "text-amber-500 dark:text-amber-500",
      icon: "text-amber-500 dark:text-amber-500",
      dot: "bg-amber-500 dark:bg-amber-500",
      border: "border-l-amber-500/40 dark:border-l-amber-500/40",
      cardBorder: "border-amber-500/50 dark:border-amber-500/50",
    },
    "600": {
      text: "text-amber-600 dark:text-amber-600",
      icon: "text-amber-600 dark:text-amber-600",
      dot: "bg-amber-600 dark:bg-amber-600",
      border: "border-l-amber-600/40 dark:border-l-amber-600/40",
      cardBorder: "border-amber-600/50 dark:border-amber-600/50",
    },
    "700": {
      text: "text-amber-700 dark:text-amber-700",
      icon: "text-amber-700 dark:text-amber-700",
      dot: "bg-amber-700 dark:bg-amber-700",
      border: "border-l-amber-700/40 dark:border-l-amber-700/40",
      cardBorder: "border-amber-700/50 dark:border-amber-700/50",
    },
    "800": {
      text: "text-amber-800 dark:text-amber-800",
      icon: "text-amber-800 dark:text-amber-800",
      dot: "bg-amber-800 dark:bg-amber-800",
      border: "border-l-amber-800/40 dark:border-l-amber-800/40",
      cardBorder: "border-amber-800/50 dark:border-amber-800/50",
    },
    "900": {
      text: "text-amber-900 dark:text-amber-900",
      icon: "text-amber-900 dark:text-amber-900",
      dot: "bg-amber-900 dark:bg-amber-900",
      border: "border-l-amber-900/40 dark:border-l-amber-900/40",
      cardBorder: "border-amber-900/50 dark:border-amber-900/50",
    },
    "950": {
      text: "text-amber-950 dark:text-amber-950",
      icon: "text-amber-950 dark:text-amber-950",
      dot: "bg-amber-950 dark:bg-amber-950",
      border: "border-l-amber-950/40 dark:border-l-amber-950/40",
      cardBorder: "border-amber-950/50 dark:border-amber-950/50",
    },
  },
  yellow: {
    "50": {
      text: "text-yellow-50 dark:text-yellow-50",
      icon: "text-yellow-50 dark:text-yellow-50",
      dot: "bg-yellow-50 dark:bg-yellow-50",
      border: "border-l-yellow-50/40 dark:border-l-yellow-50/40",
      cardBorder: "border-yellow-50/50 dark:border-yellow-50/50",
    },
    "100": {
      text: "text-yellow-100 dark:text-yellow-100",
      icon: "text-yellow-100 dark:text-yellow-100",
      dot: "bg-yellow-100 dark:bg-yellow-100",
      border: "border-l-yellow-100/40 dark:border-l-yellow-100/40",
      cardBorder: "border-yellow-100/50 dark:border-yellow-100/50",
    },
    "200": {
      text: "text-yellow-200 dark:text-yellow-200",
      icon: "text-yellow-200 dark:text-yellow-200",
      dot: "bg-yellow-200 dark:bg-yellow-200",
      border: "border-l-yellow-200/40 dark:border-l-yellow-200/40",
      cardBorder: "border-yellow-200/50 dark:border-yellow-200/50",
    },
    "300": {
      text: "text-yellow-300 dark:text-yellow-300",
      icon: "text-yellow-300 dark:text-yellow-300",
      dot: "bg-yellow-300 dark:bg-yellow-300",
      border: "border-l-yellow-300/40 dark:border-l-yellow-300/40",
      cardBorder: "border-yellow-300/50 dark:border-yellow-300/50",
    },
    "400": {
      text: "text-yellow-400 dark:text-yellow-400",
      icon: "text-yellow-400 dark:text-yellow-400",
      dot: "bg-yellow-400 dark:bg-yellow-400",
      border: "border-l-yellow-400/40 dark:border-l-yellow-400/40",
      cardBorder: "border-yellow-400/50 dark:border-yellow-400/50",
    },
    "500": {
      text: "text-yellow-500 dark:text-yellow-500",
      icon: "text-yellow-500 dark:text-yellow-500",
      dot: "bg-yellow-500 dark:bg-yellow-500",
      border: "border-l-yellow-500/40 dark:border-l-yellow-500/40",
      cardBorder: "border-yellow-500/50 dark:border-yellow-500/50",
    },
    "600": {
      text: "text-yellow-600 dark:text-yellow-600",
      icon: "text-yellow-600 dark:text-yellow-600",
      dot: "bg-yellow-600 dark:bg-yellow-600",
      border: "border-l-yellow-600/40 dark:border-l-yellow-600/40",
      cardBorder: "border-yellow-600/50 dark:border-yellow-600/50",
    },
    "700": {
      text: "text-yellow-700 dark:text-yellow-700",
      icon: "text-yellow-700 dark:text-yellow-700",
      dot: "bg-yellow-700 dark:bg-yellow-700",
      border: "border-l-yellow-700/40 dark:border-l-yellow-700/40",
      cardBorder: "border-yellow-700/50 dark:border-yellow-700/50",
    },
    "800": {
      text: "text-yellow-800 dark:text-yellow-800",
      icon: "text-yellow-800 dark:text-yellow-800",
      dot: "bg-yellow-800 dark:bg-yellow-800",
      border: "border-l-yellow-800/40 dark:border-l-yellow-800/40",
      cardBorder: "border-yellow-800/50 dark:border-yellow-800/50",
    },
    "900": {
      text: "text-yellow-900 dark:text-yellow-900",
      icon: "text-yellow-900 dark:text-yellow-900",
      dot: "bg-yellow-900 dark:bg-yellow-900",
      border: "border-l-yellow-900/40 dark:border-l-yellow-900/40",
      cardBorder: "border-yellow-900/50 dark:border-yellow-900/50",
    },
    "950": {
      text: "text-yellow-950 dark:text-yellow-950",
      icon: "text-yellow-950 dark:text-yellow-950",
      dot: "bg-yellow-950 dark:bg-yellow-950",
      border: "border-l-yellow-950/40 dark:border-l-yellow-950/40",
      cardBorder: "border-yellow-950/50 dark:border-yellow-950/50",
    },
  },
  lime: {
    "50": {
      text: "text-lime-50 dark:text-lime-50",
      icon: "text-lime-50 dark:text-lime-50",
      dot: "bg-lime-50 dark:bg-lime-50",
      border: "border-l-lime-50/40 dark:border-l-lime-50/40",
      cardBorder: "border-lime-50/50 dark:border-lime-50/50",
    },
    "100": {
      text: "text-lime-100 dark:text-lime-100",
      icon: "text-lime-100 dark:text-lime-100",
      dot: "bg-lime-100 dark:bg-lime-100",
      border: "border-l-lime-100/40 dark:border-l-lime-100/40",
      cardBorder: "border-lime-100/50 dark:border-lime-100/50",
    },
    "200": {
      text: "text-lime-200 dark:text-lime-200",
      icon: "text-lime-200 dark:text-lime-200",
      dot: "bg-lime-200 dark:bg-lime-200",
      border: "border-l-lime-200/40 dark:border-l-lime-200/40",
      cardBorder: "border-lime-200/50 dark:border-lime-200/50",
    },
    "300": {
      text: "text-lime-300 dark:text-lime-300",
      icon: "text-lime-300 dark:text-lime-300",
      dot: "bg-lime-300 dark:bg-lime-300",
      border: "border-l-lime-300/40 dark:border-l-lime-300/40",
      cardBorder: "border-lime-300/50 dark:border-lime-300/50",
    },
    "400": {
      text: "text-lime-400 dark:text-lime-400",
      icon: "text-lime-400 dark:text-lime-400",
      dot: "bg-lime-400 dark:bg-lime-400",
      border: "border-l-lime-400/40 dark:border-l-lime-400/40",
      cardBorder: "border-lime-400/50 dark:border-lime-400/50",
    },
    "500": {
      text: "text-lime-500 dark:text-lime-500",
      icon: "text-lime-500 dark:text-lime-500",
      dot: "bg-lime-500 dark:bg-lime-500",
      border: "border-l-lime-500/40 dark:border-l-lime-500/40",
      cardBorder: "border-lime-500/50 dark:border-lime-500/50",
    },
    "600": {
      text: "text-lime-600 dark:text-lime-600",
      icon: "text-lime-600 dark:text-lime-600",
      dot: "bg-lime-600 dark:bg-lime-600",
      border: "border-l-lime-600/40 dark:border-l-lime-600/40",
      cardBorder: "border-lime-600/50 dark:border-lime-600/50",
    },
    "700": {
      text: "text-lime-700 dark:text-lime-700",
      icon: "text-lime-700 dark:text-lime-700",
      dot: "bg-lime-700 dark:bg-lime-700",
      border: "border-l-lime-700/40 dark:border-l-lime-700/40",
      cardBorder: "border-lime-700/50 dark:border-lime-700/50",
    },
    "800": {
      text: "text-lime-800 dark:text-lime-800",
      icon: "text-lime-800 dark:text-lime-800",
      dot: "bg-lime-800 dark:bg-lime-800",
      border: "border-l-lime-800/40 dark:border-l-lime-800/40",
      cardBorder: "border-lime-800/50 dark:border-lime-800/50",
    },
    "900": {
      text: "text-lime-900 dark:text-lime-900",
      icon: "text-lime-900 dark:text-lime-900",
      dot: "bg-lime-900 dark:bg-lime-900",
      border: "border-l-lime-900/40 dark:border-l-lime-900/40",
      cardBorder: "border-lime-900/50 dark:border-lime-900/50",
    },
    "950": {
      text: "text-lime-950 dark:text-lime-950",
      icon: "text-lime-950 dark:text-lime-950",
      dot: "bg-lime-950 dark:bg-lime-950",
      border: "border-l-lime-950/40 dark:border-l-lime-950/40",
      cardBorder: "border-lime-950/50 dark:border-lime-950/50",
    },
  },
  green: {
    "50": {
      text: "text-green-50 dark:text-green-50",
      icon: "text-green-50 dark:text-green-50",
      dot: "bg-green-50 dark:bg-green-50",
      border: "border-l-green-50/40 dark:border-l-green-50/40",
      cardBorder: "border-green-50/50 dark:border-green-50/50",
    },
    "100": {
      text: "text-green-100 dark:text-green-100",
      icon: "text-green-100 dark:text-green-100",
      dot: "bg-green-100 dark:bg-green-100",
      border: "border-l-green-100/40 dark:border-l-green-100/40",
      cardBorder: "border-green-100/50 dark:border-green-100/50",
    },
    "200": {
      text: "text-green-200 dark:text-green-200",
      icon: "text-green-200 dark:text-green-200",
      dot: "bg-green-200 dark:bg-green-200",
      border: "border-l-green-200/40 dark:border-l-green-200/40",
      cardBorder: "border-green-200/50 dark:border-green-200/50",
    },
    "300": {
      text: "text-green-300 dark:text-green-300",
      icon: "text-green-300 dark:text-green-300",
      dot: "bg-green-300 dark:bg-green-300",
      border: "border-l-green-300/40 dark:border-l-green-300/40",
      cardBorder: "border-green-300/50 dark:border-green-300/50",
    },
    "400": {
      text: "text-green-400 dark:text-green-400",
      icon: "text-green-400 dark:text-green-400",
      dot: "bg-green-400 dark:bg-green-400",
      border: "border-l-green-400/40 dark:border-l-green-400/40",
      cardBorder: "border-green-400/50 dark:border-green-400/50",
    },
    "500": {
      text: "text-green-500 dark:text-green-500",
      icon: "text-green-500 dark:text-green-500",
      dot: "bg-green-500 dark:bg-green-500",
      border: "border-l-green-500/40 dark:border-l-green-500/40",
      cardBorder: "border-green-500/50 dark:border-green-500/50",
    },
    "600": {
      text: "text-green-600 dark:text-green-600",
      icon: "text-green-600 dark:text-green-600",
      dot: "bg-green-600 dark:bg-green-600",
      border: "border-l-green-600/40 dark:border-l-green-600/40",
      cardBorder: "border-green-600/50 dark:border-green-600/50",
    },
    "700": {
      text: "text-green-700 dark:text-green-700",
      icon: "text-green-700 dark:text-green-700",
      dot: "bg-green-700 dark:bg-green-700",
      border: "border-l-green-700/40 dark:border-l-green-700/40",
      cardBorder: "border-green-700/50 dark:border-green-700/50",
    },
    "800": {
      text: "text-green-800 dark:text-green-800",
      icon: "text-green-800 dark:text-green-800",
      dot: "bg-green-800 dark:bg-green-800",
      border: "border-l-green-800/40 dark:border-l-green-800/40",
      cardBorder: "border-green-800/50 dark:border-green-800/50",
    },
    "900": {
      text: "text-green-900 dark:text-green-900",
      icon: "text-green-900 dark:text-green-900",
      dot: "bg-green-900 dark:bg-green-900",
      border: "border-l-green-900/40 dark:border-l-green-900/40",
      cardBorder: "border-green-900/50 dark:border-green-900/50",
    },
    "950": {
      text: "text-green-950 dark:text-green-950",
      icon: "text-green-950 dark:text-green-950",
      dot: "bg-green-950 dark:bg-green-950",
      border: "border-l-green-950/40 dark:border-l-green-950/40",
      cardBorder: "border-green-950/50 dark:border-green-950/50",
    },
  },
  emerald: {
    "50": {
      text: "text-emerald-50 dark:text-emerald-50",
      icon: "text-emerald-50 dark:text-emerald-50",
      dot: "bg-emerald-50 dark:bg-emerald-50",
      border: "border-l-emerald-50/40 dark:border-l-emerald-50/40",
      cardBorder: "border-emerald-50/50 dark:border-emerald-50/50",
    },
    "100": {
      text: "text-emerald-100 dark:text-emerald-100",
      icon: "text-emerald-100 dark:text-emerald-100",
      dot: "bg-emerald-100 dark:bg-emerald-100",
      border: "border-l-emerald-100/40 dark:border-l-emerald-100/40",
      cardBorder: "border-emerald-100/50 dark:border-emerald-100/50",
    },
    "200": {
      text: "text-emerald-200 dark:text-emerald-200",
      icon: "text-emerald-200 dark:text-emerald-200",
      dot: "bg-emerald-200 dark:bg-emerald-200",
      border: "border-l-emerald-200/40 dark:border-l-emerald-200/40",
      cardBorder: "border-emerald-200/50 dark:border-emerald-200/50",
    },
    "300": {
      text: "text-emerald-300 dark:text-emerald-300",
      icon: "text-emerald-300 dark:text-emerald-300",
      dot: "bg-emerald-300 dark:bg-emerald-300",
      border: "border-l-emerald-300/40 dark:border-l-emerald-300/40",
      cardBorder: "border-emerald-300/50 dark:border-emerald-300/50",
    },
    "400": {
      text: "text-emerald-400 dark:text-emerald-400",
      icon: "text-emerald-400 dark:text-emerald-400",
      dot: "bg-emerald-400 dark:bg-emerald-400",
      border: "border-l-emerald-400/40 dark:border-l-emerald-400/40",
      cardBorder: "border-emerald-400/50 dark:border-emerald-400/50",
    },
    "500": {
      text: "text-emerald-500 dark:text-emerald-500",
      icon: "text-emerald-500 dark:text-emerald-500",
      dot: "bg-emerald-500 dark:bg-emerald-500",
      border: "border-l-emerald-500/40 dark:border-l-emerald-500/40",
      cardBorder: "border-emerald-500/50 dark:border-emerald-500/50",
    },
    "600": {
      text: "text-emerald-600 dark:text-emerald-600",
      icon: "text-emerald-600 dark:text-emerald-600",
      dot: "bg-emerald-600 dark:bg-emerald-600",
      border: "border-l-emerald-600/40 dark:border-l-emerald-600/40",
      cardBorder: "border-emerald-600/50 dark:border-emerald-600/50",
    },
    "700": {
      text: "text-emerald-700 dark:text-emerald-700",
      icon: "text-emerald-700 dark:text-emerald-700",
      dot: "bg-emerald-700 dark:bg-emerald-700",
      border: "border-l-emerald-700/40 dark:border-l-emerald-700/40",
      cardBorder: "border-emerald-700/50 dark:border-emerald-700/50",
    },
    "800": {
      text: "text-emerald-800 dark:text-emerald-800",
      icon: "text-emerald-800 dark:text-emerald-800",
      dot: "bg-emerald-800 dark:bg-emerald-800",
      border: "border-l-emerald-800/40 dark:border-l-emerald-800/40",
      cardBorder: "border-emerald-800/50 dark:border-emerald-800/50",
    },
    "900": {
      text: "text-emerald-900 dark:text-emerald-900",
      icon: "text-emerald-900 dark:text-emerald-900",
      dot: "bg-emerald-900 dark:bg-emerald-900",
      border: "border-l-emerald-900/40 dark:border-l-emerald-900/40",
      cardBorder: "border-emerald-900/50 dark:border-emerald-900/50",
    },
    "950": {
      text: "text-emerald-950 dark:text-emerald-950",
      icon: "text-emerald-950 dark:text-emerald-950",
      dot: "bg-emerald-950 dark:bg-emerald-950",
      border: "border-l-emerald-950/40 dark:border-l-emerald-950/40",
      cardBorder: "border-emerald-950/50 dark:border-emerald-950/50",
    },
  },
  teal: {
    "50": {
      text: "text-teal-50 dark:text-teal-50",
      icon: "text-teal-50 dark:text-teal-50",
      dot: "bg-teal-50 dark:bg-teal-50",
      border: "border-l-teal-50/40 dark:border-l-teal-50/40",
      cardBorder: "border-teal-50/50 dark:border-teal-50/50",
    },
    "100": {
      text: "text-teal-100 dark:text-teal-100",
      icon: "text-teal-100 dark:text-teal-100",
      dot: "bg-teal-100 dark:bg-teal-100",
      border: "border-l-teal-100/40 dark:border-l-teal-100/40",
      cardBorder: "border-teal-100/50 dark:border-teal-100/50",
    },
    "200": {
      text: "text-teal-200 dark:text-teal-200",
      icon: "text-teal-200 dark:text-teal-200",
      dot: "bg-teal-200 dark:bg-teal-200",
      border: "border-l-teal-200/40 dark:border-l-teal-200/40",
      cardBorder: "border-teal-200/50 dark:border-teal-200/50",
    },
    "300": {
      text: "text-teal-300 dark:text-teal-300",
      icon: "text-teal-300 dark:text-teal-300",
      dot: "bg-teal-300 dark:bg-teal-300",
      border: "border-l-teal-300/40 dark:border-l-teal-300/40",
      cardBorder: "border-teal-300/50 dark:border-teal-300/50",
    },
    "400": {
      text: "text-teal-400 dark:text-teal-400",
      icon: "text-teal-400 dark:text-teal-400",
      dot: "bg-teal-400 dark:bg-teal-400",
      border: "border-l-teal-400/40 dark:border-l-teal-400/40",
      cardBorder: "border-teal-400/50 dark:border-teal-400/50",
    },
    "500": {
      text: "text-teal-500 dark:text-teal-500",
      icon: "text-teal-500 dark:text-teal-500",
      dot: "bg-teal-500 dark:bg-teal-500",
      border: "border-l-teal-500/40 dark:border-l-teal-500/40",
      cardBorder: "border-teal-500/50 dark:border-teal-500/50",
    },
    "600": {
      text: "text-teal-600 dark:text-teal-600",
      icon: "text-teal-600 dark:text-teal-600",
      dot: "bg-teal-600 dark:bg-teal-600",
      border: "border-l-teal-600/40 dark:border-l-teal-600/40",
      cardBorder: "border-teal-600/50 dark:border-teal-600/50",
    },
    "700": {
      text: "text-teal-700 dark:text-teal-700",
      icon: "text-teal-700 dark:text-teal-700",
      dot: "bg-teal-700 dark:bg-teal-700",
      border: "border-l-teal-700/40 dark:border-l-teal-700/40",
      cardBorder: "border-teal-700/50 dark:border-teal-700/50",
    },
    "800": {
      text: "text-teal-800 dark:text-teal-800",
      icon: "text-teal-800 dark:text-teal-800",
      dot: "bg-teal-800 dark:bg-teal-800",
      border: "border-l-teal-800/40 dark:border-l-teal-800/40",
      cardBorder: "border-teal-800/50 dark:border-teal-800/50",
    },
    "900": {
      text: "text-teal-900 dark:text-teal-900",
      icon: "text-teal-900 dark:text-teal-900",
      dot: "bg-teal-900 dark:bg-teal-900",
      border: "border-l-teal-900/40 dark:border-l-teal-900/40",
      cardBorder: "border-teal-900/50 dark:border-teal-900/50",
    },
    "950": {
      text: "text-teal-950 dark:text-teal-950",
      icon: "text-teal-950 dark:text-teal-950",
      dot: "bg-teal-950 dark:bg-teal-950",
      border: "border-l-teal-950/40 dark:border-l-teal-950/40",
      cardBorder: "border-teal-950/50 dark:border-teal-950/50",
    },
  },
  cyan: {
    "50": {
      text: "text-cyan-50 dark:text-cyan-50",
      icon: "text-cyan-50 dark:text-cyan-50",
      dot: "bg-cyan-50 dark:bg-cyan-50",
      border: "border-l-cyan-50/40 dark:border-l-cyan-50/40",
      cardBorder: "border-cyan-50/50 dark:border-cyan-50/50",
    },
    "100": {
      text: "text-cyan-100 dark:text-cyan-100",
      icon: "text-cyan-100 dark:text-cyan-100",
      dot: "bg-cyan-100 dark:bg-cyan-100",
      border: "border-l-cyan-100/40 dark:border-l-cyan-100/40",
      cardBorder: "border-cyan-100/50 dark:border-cyan-100/50",
    },
    "200": {
      text: "text-cyan-200 dark:text-cyan-200",
      icon: "text-cyan-200 dark:text-cyan-200",
      dot: "bg-cyan-200 dark:bg-cyan-200",
      border: "border-l-cyan-200/40 dark:border-l-cyan-200/40",
      cardBorder: "border-cyan-200/50 dark:border-cyan-200/50",
    },
    "300": {
      text: "text-cyan-300 dark:text-cyan-300",
      icon: "text-cyan-300 dark:text-cyan-300",
      dot: "bg-cyan-300 dark:bg-cyan-300",
      border: "border-l-cyan-300/40 dark:border-l-cyan-300/40",
      cardBorder: "border-cyan-300/50 dark:border-cyan-300/50",
    },
    "400": {
      text: "text-cyan-400 dark:text-cyan-400",
      icon: "text-cyan-400 dark:text-cyan-400",
      dot: "bg-cyan-400 dark:bg-cyan-400",
      border: "border-l-cyan-400/40 dark:border-l-cyan-400/40",
      cardBorder: "border-cyan-400/50 dark:border-cyan-400/50",
    },
    "500": {
      text: "text-cyan-500 dark:text-cyan-500",
      icon: "text-cyan-500 dark:text-cyan-500",
      dot: "bg-cyan-500 dark:bg-cyan-500",
      border: "border-l-cyan-500/40 dark:border-l-cyan-500/40",
      cardBorder: "border-cyan-500/50 dark:border-cyan-500/50",
    },
    "600": {
      text: "text-cyan-600 dark:text-cyan-600",
      icon: "text-cyan-600 dark:text-cyan-600",
      dot: "bg-cyan-600 dark:bg-cyan-600",
      border: "border-l-cyan-600/40 dark:border-l-cyan-600/40",
      cardBorder: "border-cyan-600/50 dark:border-cyan-600/50",
    },
    "700": {
      text: "text-cyan-700 dark:text-cyan-700",
      icon: "text-cyan-700 dark:text-cyan-700",
      dot: "bg-cyan-700 dark:bg-cyan-700",
      border: "border-l-cyan-700/40 dark:border-l-cyan-700/40",
      cardBorder: "border-cyan-700/50 dark:border-cyan-700/50",
    },
    "800": {
      text: "text-cyan-800 dark:text-cyan-800",
      icon: "text-cyan-800 dark:text-cyan-800",
      dot: "bg-cyan-800 dark:bg-cyan-800",
      border: "border-l-cyan-800/40 dark:border-l-cyan-800/40",
      cardBorder: "border-cyan-800/50 dark:border-cyan-800/50",
    },
    "900": {
      text: "text-cyan-900 dark:text-cyan-900",
      icon: "text-cyan-900 dark:text-cyan-900",
      dot: "bg-cyan-900 dark:bg-cyan-900",
      border: "border-l-cyan-900/40 dark:border-l-cyan-900/40",
      cardBorder: "border-cyan-900/50 dark:border-cyan-900/50",
    },
    "950": {
      text: "text-cyan-950 dark:text-cyan-950",
      icon: "text-cyan-950 dark:text-cyan-950",
      dot: "bg-cyan-950 dark:bg-cyan-950",
      border: "border-l-cyan-950/40 dark:border-l-cyan-950/40",
      cardBorder: "border-cyan-950/50 dark:border-cyan-950/50",
    },
  },
  sky: {
    "50": {
      text: "text-sky-50 dark:text-sky-50",
      icon: "text-sky-50 dark:text-sky-50",
      dot: "bg-sky-50 dark:bg-sky-50",
      border: "border-l-sky-50/40 dark:border-l-sky-50/40",
      cardBorder: "border-sky-50/50 dark:border-sky-50/50",
    },
    "100": {
      text: "text-sky-100 dark:text-sky-100",
      icon: "text-sky-100 dark:text-sky-100",
      dot: "bg-sky-100 dark:bg-sky-100",
      border: "border-l-sky-100/40 dark:border-l-sky-100/40",
      cardBorder: "border-sky-100/50 dark:border-sky-100/50",
    },
    "200": {
      text: "text-sky-200 dark:text-sky-200",
      icon: "text-sky-200 dark:text-sky-200",
      dot: "bg-sky-200 dark:bg-sky-200",
      border: "border-l-sky-200/40 dark:border-l-sky-200/40",
      cardBorder: "border-sky-200/50 dark:border-sky-200/50",
    },
    "300": {
      text: "text-sky-300 dark:text-sky-300",
      icon: "text-sky-300 dark:text-sky-300",
      dot: "bg-sky-300 dark:bg-sky-300",
      border: "border-l-sky-300/40 dark:border-l-sky-300/40",
      cardBorder: "border-sky-300/50 dark:border-sky-300/50",
    },
    "400": {
      text: "text-sky-400 dark:text-sky-400",
      icon: "text-sky-400 dark:text-sky-400",
      dot: "bg-sky-400 dark:bg-sky-400",
      border: "border-l-sky-400/40 dark:border-l-sky-400/40",
      cardBorder: "border-sky-400/50 dark:border-sky-400/50",
    },
    "500": {
      text: "text-sky-500 dark:text-sky-500",
      icon: "text-sky-500 dark:text-sky-500",
      dot: "bg-sky-500 dark:bg-sky-500",
      border: "border-l-sky-500/40 dark:border-l-sky-500/40",
      cardBorder: "border-sky-500/50 dark:border-sky-500/50",
    },
    "600": {
      text: "text-sky-600 dark:text-sky-600",
      icon: "text-sky-600 dark:text-sky-600",
      dot: "bg-sky-600 dark:bg-sky-600",
      border: "border-l-sky-600/40 dark:border-l-sky-600/40",
      cardBorder: "border-sky-600/50 dark:border-sky-600/50",
    },
    "700": {
      text: "text-sky-700 dark:text-sky-700",
      icon: "text-sky-700 dark:text-sky-700",
      dot: "bg-sky-700 dark:bg-sky-700",
      border: "border-l-sky-700/40 dark:border-l-sky-700/40",
      cardBorder: "border-sky-700/50 dark:border-sky-700/50",
    },
    "800": {
      text: "text-sky-800 dark:text-sky-800",
      icon: "text-sky-800 dark:text-sky-800",
      dot: "bg-sky-800 dark:bg-sky-800",
      border: "border-l-sky-800/40 dark:border-l-sky-800/40",
      cardBorder: "border-sky-800/50 dark:border-sky-800/50",
    },
    "900": {
      text: "text-sky-900 dark:text-sky-900",
      icon: "text-sky-900 dark:text-sky-900",
      dot: "bg-sky-900 dark:bg-sky-900",
      border: "border-l-sky-900/40 dark:border-l-sky-900/40",
      cardBorder: "border-sky-900/50 dark:border-sky-900/50",
    },
    "950": {
      text: "text-sky-950 dark:text-sky-950",
      icon: "text-sky-950 dark:text-sky-950",
      dot: "bg-sky-950 dark:bg-sky-950",
      border: "border-l-sky-950/40 dark:border-l-sky-950/40",
      cardBorder: "border-sky-950/50 dark:border-sky-950/50",
    },
  },
  blue: {
    "50": {
      text: "text-blue-50 dark:text-blue-50",
      icon: "text-blue-50 dark:text-blue-50",
      dot: "bg-blue-50 dark:bg-blue-50",
      border: "border-l-blue-50/40 dark:border-l-blue-50/40",
      cardBorder: "border-blue-50/50 dark:border-blue-50/50",
    },
    "100": {
      text: "text-blue-100 dark:text-blue-100",
      icon: "text-blue-100 dark:text-blue-100",
      dot: "bg-blue-100 dark:bg-blue-100",
      border: "border-l-blue-100/40 dark:border-l-blue-100/40",
      cardBorder: "border-blue-100/50 dark:border-blue-100/50",
    },
    "200": {
      text: "text-blue-200 dark:text-blue-200",
      icon: "text-blue-200 dark:text-blue-200",
      dot: "bg-blue-200 dark:bg-blue-200",
      border: "border-l-blue-200/40 dark:border-l-blue-200/40",
      cardBorder: "border-blue-200/50 dark:border-blue-200/50",
    },
    "300": {
      text: "text-blue-300 dark:text-blue-300",
      icon: "text-blue-300 dark:text-blue-300",
      dot: "bg-blue-300 dark:bg-blue-300",
      border: "border-l-blue-300/40 dark:border-l-blue-300/40",
      cardBorder: "border-blue-300/50 dark:border-blue-300/50",
    },
    "400": {
      text: "text-blue-400 dark:text-blue-400",
      icon: "text-blue-400 dark:text-blue-400",
      dot: "bg-blue-400 dark:bg-blue-400",
      border: "border-l-blue-400/40 dark:border-l-blue-400/40",
      cardBorder: "border-blue-400/50 dark:border-blue-400/50",
    },
    "500": {
      text: "text-blue-500 dark:text-blue-500",
      icon: "text-blue-500 dark:text-blue-500",
      dot: "bg-blue-500 dark:bg-blue-500",
      border: "border-l-blue-500/40 dark:border-l-blue-500/40",
      cardBorder: "border-blue-500/50 dark:border-blue-500/50",
    },
    "600": {
      text: "text-blue-600 dark:text-blue-600",
      icon: "text-blue-600 dark:text-blue-600",
      dot: "bg-blue-600 dark:bg-blue-600",
      border: "border-l-blue-600/40 dark:border-l-blue-600/40",
      cardBorder: "border-blue-600/50 dark:border-blue-600/50",
    },
    "700": {
      text: "text-blue-700 dark:text-blue-700",
      icon: "text-blue-700 dark:text-blue-700",
      dot: "bg-blue-700 dark:bg-blue-700",
      border: "border-l-blue-700/40 dark:border-l-blue-700/40",
      cardBorder: "border-blue-700/50 dark:border-blue-700/50",
    },
    "800": {
      text: "text-blue-800 dark:text-blue-800",
      icon: "text-blue-800 dark:text-blue-800",
      dot: "bg-blue-800 dark:bg-blue-800",
      border: "border-l-blue-800/40 dark:border-l-blue-800/40",
      cardBorder: "border-blue-800/50 dark:border-blue-800/50",
    },
    "900": {
      text: "text-blue-900 dark:text-blue-900",
      icon: "text-blue-900 dark:text-blue-900",
      dot: "bg-blue-900 dark:bg-blue-900",
      border: "border-l-blue-900/40 dark:border-l-blue-900/40",
      cardBorder: "border-blue-900/50 dark:border-blue-900/50",
    },
    "950": {
      text: "text-blue-950 dark:text-blue-950",
      icon: "text-blue-950 dark:text-blue-950",
      dot: "bg-blue-950 dark:bg-blue-950",
      border: "border-l-blue-950/40 dark:border-l-blue-950/40",
      cardBorder: "border-blue-950/50 dark:border-blue-950/50",
    },
  },
  indigo: {
    "50": {
      text: "text-indigo-50 dark:text-indigo-50",
      icon: "text-indigo-50 dark:text-indigo-50",
      dot: "bg-indigo-50 dark:bg-indigo-50",
      border: "border-l-indigo-50/40 dark:border-l-indigo-50/40",
      cardBorder: "border-indigo-50/50 dark:border-indigo-50/50",
    },
    "100": {
      text: "text-indigo-100 dark:text-indigo-100",
      icon: "text-indigo-100 dark:text-indigo-100",
      dot: "bg-indigo-100 dark:bg-indigo-100",
      border: "border-l-indigo-100/40 dark:border-l-indigo-100/40",
      cardBorder: "border-indigo-100/50 dark:border-indigo-100/50",
    },
    "200": {
      text: "text-indigo-200 dark:text-indigo-200",
      icon: "text-indigo-200 dark:text-indigo-200",
      dot: "bg-indigo-200 dark:bg-indigo-200",
      border: "border-l-indigo-200/40 dark:border-l-indigo-200/40",
      cardBorder: "border-indigo-200/50 dark:border-indigo-200/50",
    },
    "300": {
      text: "text-indigo-300 dark:text-indigo-300",
      icon: "text-indigo-300 dark:text-indigo-300",
      dot: "bg-indigo-300 dark:bg-indigo-300",
      border: "border-l-indigo-300/40 dark:border-l-indigo-300/40",
      cardBorder: "border-indigo-300/50 dark:border-indigo-300/50",
    },
    "400": {
      text: "text-indigo-400 dark:text-indigo-400",
      icon: "text-indigo-400 dark:text-indigo-400",
      dot: "bg-indigo-400 dark:bg-indigo-400",
      border: "border-l-indigo-400/40 dark:border-l-indigo-400/40",
      cardBorder: "border-indigo-400/50 dark:border-indigo-400/50",
    },
    "500": {
      text: "text-indigo-500 dark:text-indigo-500",
      icon: "text-indigo-500 dark:text-indigo-500",
      dot: "bg-indigo-500 dark:bg-indigo-500",
      border: "border-l-indigo-500/40 dark:border-l-indigo-500/40",
      cardBorder: "border-indigo-500/50 dark:border-indigo-500/50",
    },
    "600": {
      text: "text-indigo-600 dark:text-indigo-600",
      icon: "text-indigo-600 dark:text-indigo-600",
      dot: "bg-indigo-600 dark:bg-indigo-600",
      border: "border-l-indigo-600/40 dark:border-l-indigo-600/40",
      cardBorder: "border-indigo-600/50 dark:border-indigo-600/50",
    },
    "700": {
      text: "text-indigo-700 dark:text-indigo-700",
      icon: "text-indigo-700 dark:text-indigo-700",
      dot: "bg-indigo-700 dark:bg-indigo-700",
      border: "border-l-indigo-700/40 dark:border-l-indigo-700/40",
      cardBorder: "border-indigo-700/50 dark:border-indigo-700/50",
    },
    "800": {
      text: "text-indigo-800 dark:text-indigo-800",
      icon: "text-indigo-800 dark:text-indigo-800",
      dot: "bg-indigo-800 dark:bg-indigo-800",
      border: "border-l-indigo-800/40 dark:border-l-indigo-800/40",
      cardBorder: "border-indigo-800/50 dark:border-indigo-800/50",
    },
    "900": {
      text: "text-indigo-900 dark:text-indigo-900",
      icon: "text-indigo-900 dark:text-indigo-900",
      dot: "bg-indigo-900 dark:bg-indigo-900",
      border: "border-l-indigo-900/40 dark:border-l-indigo-900/40",
      cardBorder: "border-indigo-900/50 dark:border-indigo-900/50",
    },
    "950": {
      text: "text-indigo-950 dark:text-indigo-950",
      icon: "text-indigo-950 dark:text-indigo-950",
      dot: "bg-indigo-950 dark:bg-indigo-950",
      border: "border-l-indigo-950/40 dark:border-l-indigo-950/40",
      cardBorder: "border-indigo-950/50 dark:border-indigo-950/50",
    },
  },
  violet: {
    "50": {
      text: "text-violet-50 dark:text-violet-50",
      icon: "text-violet-50 dark:text-violet-50",
      dot: "bg-violet-50 dark:bg-violet-50",
      border: "border-l-violet-50/40 dark:border-l-violet-50/40",
      cardBorder: "border-violet-50/50 dark:border-violet-50/50",
    },
    "100": {
      text: "text-violet-100 dark:text-violet-100",
      icon: "text-violet-100 dark:text-violet-100",
      dot: "bg-violet-100 dark:bg-violet-100",
      border: "border-l-violet-100/40 dark:border-l-violet-100/40",
      cardBorder: "border-violet-100/50 dark:border-violet-100/50",
    },
    "200": {
      text: "text-violet-200 dark:text-violet-200",
      icon: "text-violet-200 dark:text-violet-200",
      dot: "bg-violet-200 dark:bg-violet-200",
      border: "border-l-violet-200/40 dark:border-l-violet-200/40",
      cardBorder: "border-violet-200/50 dark:border-violet-200/50",
    },
    "300": {
      text: "text-violet-300 dark:text-violet-300",
      icon: "text-violet-300 dark:text-violet-300",
      dot: "bg-violet-300 dark:bg-violet-300",
      border: "border-l-violet-300/40 dark:border-l-violet-300/40",
      cardBorder: "border-violet-300/50 dark:border-violet-300/50",
    },
    "400": {
      text: "text-violet-400 dark:text-violet-400",
      icon: "text-violet-400 dark:text-violet-400",
      dot: "bg-violet-400 dark:bg-violet-400",
      border: "border-l-violet-400/40 dark:border-l-violet-400/40",
      cardBorder: "border-violet-400/50 dark:border-violet-400/50",
    },
    "500": {
      text: "text-violet-500 dark:text-violet-500",
      icon: "text-violet-500 dark:text-violet-500",
      dot: "bg-violet-500 dark:bg-violet-500",
      border: "border-l-violet-500/40 dark:border-l-violet-500/40",
      cardBorder: "border-violet-500/50 dark:border-violet-500/50",
    },
    "600": {
      text: "text-violet-600 dark:text-violet-600",
      icon: "text-violet-600 dark:text-violet-600",
      dot: "bg-violet-600 dark:bg-violet-600",
      border: "border-l-violet-600/40 dark:border-l-violet-600/40",
      cardBorder: "border-violet-600/50 dark:border-violet-600/50",
    },
    "700": {
      text: "text-violet-700 dark:text-violet-700",
      icon: "text-violet-700 dark:text-violet-700",
      dot: "bg-violet-700 dark:bg-violet-700",
      border: "border-l-violet-700/40 dark:border-l-violet-700/40",
      cardBorder: "border-violet-700/50 dark:border-violet-700/50",
    },
    "800": {
      text: "text-violet-800 dark:text-violet-800",
      icon: "text-violet-800 dark:text-violet-800",
      dot: "bg-violet-800 dark:bg-violet-800",
      border: "border-l-violet-800/40 dark:border-l-violet-800/40",
      cardBorder: "border-violet-800/50 dark:border-violet-800/50",
    },
    "900": {
      text: "text-violet-900 dark:text-violet-900",
      icon: "text-violet-900 dark:text-violet-900",
      dot: "bg-violet-900 dark:bg-violet-900",
      border: "border-l-violet-900/40 dark:border-l-violet-900/40",
      cardBorder: "border-violet-900/50 dark:border-violet-900/50",
    },
    "950": {
      text: "text-violet-950 dark:text-violet-950",
      icon: "text-violet-950 dark:text-violet-950",
      dot: "bg-violet-950 dark:bg-violet-950",
      border: "border-l-violet-950/40 dark:border-l-violet-950/40",
      cardBorder: "border-violet-950/50 dark:border-violet-950/50",
    },
  },
  purple: {
    "50": {
      text: "text-purple-50 dark:text-purple-50",
      icon: "text-purple-50 dark:text-purple-50",
      dot: "bg-purple-50 dark:bg-purple-50",
      border: "border-l-purple-50/40 dark:border-l-purple-50/40",
      cardBorder: "border-purple-50/50 dark:border-purple-50/50",
    },
    "100": {
      text: "text-purple-100 dark:text-purple-100",
      icon: "text-purple-100 dark:text-purple-100",
      dot: "bg-purple-100 dark:bg-purple-100",
      border: "border-l-purple-100/40 dark:border-l-purple-100/40",
      cardBorder: "border-purple-100/50 dark:border-purple-100/50",
    },
    "200": {
      text: "text-purple-200 dark:text-purple-200",
      icon: "text-purple-200 dark:text-purple-200",
      dot: "bg-purple-200 dark:bg-purple-200",
      border: "border-l-purple-200/40 dark:border-l-purple-200/40",
      cardBorder: "border-purple-200/50 dark:border-purple-200/50",
    },
    "300": {
      text: "text-purple-300 dark:text-purple-300",
      icon: "text-purple-300 dark:text-purple-300",
      dot: "bg-purple-300 dark:bg-purple-300",
      border: "border-l-purple-300/40 dark:border-l-purple-300/40",
      cardBorder: "border-purple-300/50 dark:border-purple-300/50",
    },
    "400": {
      text: "text-purple-400 dark:text-purple-400",
      icon: "text-purple-400 dark:text-purple-400",
      dot: "bg-purple-400 dark:bg-purple-400",
      border: "border-l-purple-400/40 dark:border-l-purple-400/40",
      cardBorder: "border-purple-400/50 dark:border-purple-400/50",
    },
    "500": {
      text: "text-purple-500 dark:text-purple-500",
      icon: "text-purple-500 dark:text-purple-500",
      dot: "bg-purple-500 dark:bg-purple-500",
      border: "border-l-purple-500/40 dark:border-l-purple-500/40",
      cardBorder: "border-purple-500/50 dark:border-purple-500/50",
    },
    "600": {
      text: "text-purple-600 dark:text-purple-600",
      icon: "text-purple-600 dark:text-purple-600",
      dot: "bg-purple-600 dark:bg-purple-600",
      border: "border-l-purple-600/40 dark:border-l-purple-600/40",
      cardBorder: "border-purple-600/50 dark:border-purple-600/50",
    },
    "700": {
      text: "text-purple-700 dark:text-purple-700",
      icon: "text-purple-700 dark:text-purple-700",
      dot: "bg-purple-700 dark:bg-purple-700",
      border: "border-l-purple-700/40 dark:border-l-purple-700/40",
      cardBorder: "border-purple-700/50 dark:border-purple-700/50",
    },
    "800": {
      text: "text-purple-800 dark:text-purple-800",
      icon: "text-purple-800 dark:text-purple-800",
      dot: "bg-purple-800 dark:bg-purple-800",
      border: "border-l-purple-800/40 dark:border-l-purple-800/40",
      cardBorder: "border-purple-800/50 dark:border-purple-800/50",
    },
    "900": {
      text: "text-purple-900 dark:text-purple-900",
      icon: "text-purple-900 dark:text-purple-900",
      dot: "bg-purple-900 dark:bg-purple-900",
      border: "border-l-purple-900/40 dark:border-l-purple-900/40",
      cardBorder: "border-purple-900/50 dark:border-purple-900/50",
    },
    "950": {
      text: "text-purple-950 dark:text-purple-950",
      icon: "text-purple-950 dark:text-purple-950",
      dot: "bg-purple-950 dark:bg-purple-950",
      border: "border-l-purple-950/40 dark:border-l-purple-950/40",
      cardBorder: "border-purple-950/50 dark:border-purple-950/50",
    },
  },
  fuchsia: {
    "50": {
      text: "text-fuchsia-50 dark:text-fuchsia-50",
      icon: "text-fuchsia-50 dark:text-fuchsia-50",
      dot: "bg-fuchsia-50 dark:bg-fuchsia-50",
      border: "border-l-fuchsia-50/40 dark:border-l-fuchsia-50/40",
      cardBorder: "border-fuchsia-50/50 dark:border-fuchsia-50/50",
    },
    "100": {
      text: "text-fuchsia-100 dark:text-fuchsia-100",
      icon: "text-fuchsia-100 dark:text-fuchsia-100",
      dot: "bg-fuchsia-100 dark:bg-fuchsia-100",
      border: "border-l-fuchsia-100/40 dark:border-l-fuchsia-100/40",
      cardBorder: "border-fuchsia-100/50 dark:border-fuchsia-100/50",
    },
    "200": {
      text: "text-fuchsia-200 dark:text-fuchsia-200",
      icon: "text-fuchsia-200 dark:text-fuchsia-200",
      dot: "bg-fuchsia-200 dark:bg-fuchsia-200",
      border: "border-l-fuchsia-200/40 dark:border-l-fuchsia-200/40",
      cardBorder: "border-fuchsia-200/50 dark:border-fuchsia-200/50",
    },
    "300": {
      text: "text-fuchsia-300 dark:text-fuchsia-300",
      icon: "text-fuchsia-300 dark:text-fuchsia-300",
      dot: "bg-fuchsia-300 dark:bg-fuchsia-300",
      border: "border-l-fuchsia-300/40 dark:border-l-fuchsia-300/40",
      cardBorder: "border-fuchsia-300/50 dark:border-fuchsia-300/50",
    },
    "400": {
      text: "text-fuchsia-400 dark:text-fuchsia-400",
      icon: "text-fuchsia-400 dark:text-fuchsia-400",
      dot: "bg-fuchsia-400 dark:bg-fuchsia-400",
      border: "border-l-fuchsia-400/40 dark:border-l-fuchsia-400/40",
      cardBorder: "border-fuchsia-400/50 dark:border-fuchsia-400/50",
    },
    "500": {
      text: "text-fuchsia-500 dark:text-fuchsia-500",
      icon: "text-fuchsia-500 dark:text-fuchsia-500",
      dot: "bg-fuchsia-500 dark:bg-fuchsia-500",
      border: "border-l-fuchsia-500/40 dark:border-l-fuchsia-500/40",
      cardBorder: "border-fuchsia-500/50 dark:border-fuchsia-500/50",
    },
    "600": {
      text: "text-fuchsia-600 dark:text-fuchsia-600",
      icon: "text-fuchsia-600 dark:text-fuchsia-600",
      dot: "bg-fuchsia-600 dark:bg-fuchsia-600",
      border: "border-l-fuchsia-600/40 dark:border-l-fuchsia-600/40",
      cardBorder: "border-fuchsia-600/50 dark:border-fuchsia-600/50",
    },
    "700": {
      text: "text-fuchsia-700 dark:text-fuchsia-700",
      icon: "text-fuchsia-700 dark:text-fuchsia-700",
      dot: "bg-fuchsia-700 dark:bg-fuchsia-700",
      border: "border-l-fuchsia-700/40 dark:border-l-fuchsia-700/40",
      cardBorder: "border-fuchsia-700/50 dark:border-fuchsia-700/50",
    },
    "800": {
      text: "text-fuchsia-800 dark:text-fuchsia-800",
      icon: "text-fuchsia-800 dark:text-fuchsia-800",
      dot: "bg-fuchsia-800 dark:bg-fuchsia-800",
      border: "border-l-fuchsia-800/40 dark:border-l-fuchsia-800/40",
      cardBorder: "border-fuchsia-800/50 dark:border-fuchsia-800/50",
    },
    "900": {
      text: "text-fuchsia-900 dark:text-fuchsia-900",
      icon: "text-fuchsia-900 dark:text-fuchsia-900",
      dot: "bg-fuchsia-900 dark:bg-fuchsia-900",
      border: "border-l-fuchsia-900/40 dark:border-l-fuchsia-900/40",
      cardBorder: "border-fuchsia-900/50 dark:border-fuchsia-900/50",
    },
    "950": {
      text: "text-fuchsia-950 dark:text-fuchsia-950",
      icon: "text-fuchsia-950 dark:text-fuchsia-950",
      dot: "bg-fuchsia-950 dark:bg-fuchsia-950",
      border: "border-l-fuchsia-950/40 dark:border-l-fuchsia-950/40",
      cardBorder: "border-fuchsia-950/50 dark:border-fuchsia-950/50",
    },
  },
  pink: {
    "50": {
      text: "text-pink-50 dark:text-pink-50",
      icon: "text-pink-50 dark:text-pink-50",
      dot: "bg-pink-50 dark:bg-pink-50",
      border: "border-l-pink-50/40 dark:border-l-pink-50/40",
      cardBorder: "border-pink-50/50 dark:border-pink-50/50",
    },
    "100": {
      text: "text-pink-100 dark:text-pink-100",
      icon: "text-pink-100 dark:text-pink-100",
      dot: "bg-pink-100 dark:bg-pink-100",
      border: "border-l-pink-100/40 dark:border-l-pink-100/40",
      cardBorder: "border-pink-100/50 dark:border-pink-100/50",
    },
    "200": {
      text: "text-pink-200 dark:text-pink-200",
      icon: "text-pink-200 dark:text-pink-200",
      dot: "bg-pink-200 dark:bg-pink-200",
      border: "border-l-pink-200/40 dark:border-l-pink-200/40",
      cardBorder: "border-pink-200/50 dark:border-pink-200/50",
    },
    "300": {
      text: "text-pink-300 dark:text-pink-300",
      icon: "text-pink-300 dark:text-pink-300",
      dot: "bg-pink-300 dark:bg-pink-300",
      border: "border-l-pink-300/40 dark:border-l-pink-300/40",
      cardBorder: "border-pink-300/50 dark:border-pink-300/50",
    },
    "400": {
      text: "text-pink-400 dark:text-pink-400",
      icon: "text-pink-400 dark:text-pink-400",
      dot: "bg-pink-400 dark:bg-pink-400",
      border: "border-l-pink-400/40 dark:border-l-pink-400/40",
      cardBorder: "border-pink-400/50 dark:border-pink-400/50",
    },
    "500": {
      text: "text-pink-500 dark:text-pink-500",
      icon: "text-pink-500 dark:text-pink-500",
      dot: "bg-pink-500 dark:bg-pink-500",
      border: "border-l-pink-500/40 dark:border-l-pink-500/40",
      cardBorder: "border-pink-500/50 dark:border-pink-500/50",
    },
    "600": {
      text: "text-pink-600 dark:text-pink-600",
      icon: "text-pink-600 dark:text-pink-600",
      dot: "bg-pink-600 dark:bg-pink-600",
      border: "border-l-pink-600/40 dark:border-l-pink-600/40",
      cardBorder: "border-pink-600/50 dark:border-pink-600/50",
    },
    "700": {
      text: "text-pink-700 dark:text-pink-700",
      icon: "text-pink-700 dark:text-pink-700",
      dot: "bg-pink-700 dark:bg-pink-700",
      border: "border-l-pink-700/40 dark:border-l-pink-700/40",
      cardBorder: "border-pink-700/50 dark:border-pink-700/50",
    },
    "800": {
      text: "text-pink-800 dark:text-pink-800",
      icon: "text-pink-800 dark:text-pink-800",
      dot: "bg-pink-800 dark:bg-pink-800",
      border: "border-l-pink-800/40 dark:border-l-pink-800/40",
      cardBorder: "border-pink-800/50 dark:border-pink-800/50",
    },
    "900": {
      text: "text-pink-900 dark:text-pink-900",
      icon: "text-pink-900 dark:text-pink-900",
      dot: "bg-pink-900 dark:bg-pink-900",
      border: "border-l-pink-900/40 dark:border-l-pink-900/40",
      cardBorder: "border-pink-900/50 dark:border-pink-900/50",
    },
    "950": {
      text: "text-pink-950 dark:text-pink-950",
      icon: "text-pink-950 dark:text-pink-950",
      dot: "bg-pink-950 dark:bg-pink-950",
      border: "border-l-pink-950/40 dark:border-l-pink-950/40",
      cardBorder: "border-pink-950/50 dark:border-pink-950/50",
    },
  },
  rose: {
    "50": {
      text: "text-rose-50 dark:text-rose-50",
      icon: "text-rose-50 dark:text-rose-50",
      dot: "bg-rose-50 dark:bg-rose-50",
      border: "border-l-rose-50/40 dark:border-l-rose-50/40",
      cardBorder: "border-rose-50/50 dark:border-rose-50/50",
    },
    "100": {
      text: "text-rose-100 dark:text-rose-100",
      icon: "text-rose-100 dark:text-rose-100",
      dot: "bg-rose-100 dark:bg-rose-100",
      border: "border-l-rose-100/40 dark:border-l-rose-100/40",
      cardBorder: "border-rose-100/50 dark:border-rose-100/50",
    },
    "200": {
      text: "text-rose-200 dark:text-rose-200",
      icon: "text-rose-200 dark:text-rose-200",
      dot: "bg-rose-200 dark:bg-rose-200",
      border: "border-l-rose-200/40 dark:border-l-rose-200/40",
      cardBorder: "border-rose-200/50 dark:border-rose-200/50",
    },
    "300": {
      text: "text-rose-300 dark:text-rose-300",
      icon: "text-rose-300 dark:text-rose-300",
      dot: "bg-rose-300 dark:bg-rose-300",
      border: "border-l-rose-300/40 dark:border-l-rose-300/40",
      cardBorder: "border-rose-300/50 dark:border-rose-300/50",
    },
    "400": {
      text: "text-rose-400 dark:text-rose-400",
      icon: "text-rose-400 dark:text-rose-400",
      dot: "bg-rose-400 dark:bg-rose-400",
      border: "border-l-rose-400/40 dark:border-l-rose-400/40",
      cardBorder: "border-rose-400/50 dark:border-rose-400/50",
    },
    "500": {
      text: "text-rose-500 dark:text-rose-500",
      icon: "text-rose-500 dark:text-rose-500",
      dot: "bg-rose-500 dark:bg-rose-500",
      border: "border-l-rose-500/40 dark:border-l-rose-500/40",
      cardBorder: "border-rose-500/50 dark:border-rose-500/50",
    },
    "600": {
      text: "text-rose-600 dark:text-rose-600",
      icon: "text-rose-600 dark:text-rose-600",
      dot: "bg-rose-600 dark:bg-rose-600",
      border: "border-l-rose-600/40 dark:border-l-rose-600/40",
      cardBorder: "border-rose-600/50 dark:border-rose-600/50",
    },
    "700": {
      text: "text-rose-700 dark:text-rose-700",
      icon: "text-rose-700 dark:text-rose-700",
      dot: "bg-rose-700 dark:bg-rose-700",
      border: "border-l-rose-700/40 dark:border-l-rose-700/40",
      cardBorder: "border-rose-700/50 dark:border-rose-700/50",
    },
    "800": {
      text: "text-rose-800 dark:text-rose-800",
      icon: "text-rose-800 dark:text-rose-800",
      dot: "bg-rose-800 dark:bg-rose-800",
      border: "border-l-rose-800/40 dark:border-l-rose-800/40",
      cardBorder: "border-rose-800/50 dark:border-rose-800/50",
    },
    "900": {
      text: "text-rose-900 dark:text-rose-900",
      icon: "text-rose-900 dark:text-rose-900",
      dot: "bg-rose-900 dark:bg-rose-900",
      border: "border-l-rose-900/40 dark:border-l-rose-900/40",
      cardBorder: "border-rose-900/50 dark:border-rose-900/50",
    },
    "950": {
      text: "text-rose-950 dark:text-rose-950",
      icon: "text-rose-950 dark:text-rose-950",
      dot: "bg-rose-950 dark:bg-rose-950",
      border: "border-l-rose-950/40 dark:border-l-rose-950/40",
      cardBorder: "border-rose-950/50 dark:border-rose-950/50",
    },
  },
};

/** All 11 Tailwind shades, in display order. */
export type WidgetAccentShade = PaletteShade;

export const WIDGET_ACCENT_SHADE_VALUES: readonly WidgetAccentShade[] = PALETTE_SHADES;

export const DEFAULT_WIDGET_ACCENT_SHADE: WidgetAccentShade = "500";

/**
 * Resolve the literal Tailwind class strings for a given (color, shade) pair.
 * Falls back to gray-500 if the pair isn't in the table.
 */
export function resolveAccentClasses(
  color: PaletteColor,
  shade: WidgetAccentShade,
): AccentColorClasses {
  return (
    PALETTE_SHADE_CLASSES[color]?.[shade] ??
    PALETTE_SHADE_CLASSES.gray[DEFAULT_WIDGET_ACCENT_SHADE]
  );
}


/** Border-only options — same colors plus an explicit "none" that defers to the
 * widget's default `border-border`. */
export type WidgetBorderColor = WidgetAccentColor | "none";

export function borderClassFor(value: WidgetBorderColor | null | undefined): string {
  if (!value || value === "none") return "border-border";
  return ACCENT_COLOR_CLASSES[value]?.cardBorder ?? "border-border";
}

export const ACCENT_COLOR_LABELS: Record<WidgetAccentColor, string> = {
  // Neutral
  gray: "Cinza (padrão)",
  slate: "Ardósia",
  zinc: "Zinco",
  stone: "Pedra",
  // Warm
  red: "Vermelho",
  orange: "Laranja",
  amber: "Âmbar",
  yellow: "Amarelo",
  // Nature
  lime: "Lima",
  green: "Verde",
  emerald: "Esmeralda",
  teal: "Petróleo",
  // Cool
  cyan: "Ciano",
  sky: "Céu",
  blue: "Azul",
  indigo: "Índigo",
  // Rich
  violet: "Violeta",
  purple: "Roxo",
  fuchsia: "Fúcsia",
  pink: "Rosa",
  rose: "Rosa-vermelho",
};

export const ACCENT_COLOR_GROUP_LABELS: Record<WidgetAccentColorGroup, string> = {
  neutral: "Neutros",
  warm: "Quentes",
  nature: "Natureza",
  cool: "Frios",
  rich: "Vibrantes",
};

export const ACCENT_COLOR_GROUPS: Record<WidgetAccentColorGroup, WidgetAccentColor[]> = {
  neutral: ["gray", "slate", "zinc", "stone"],
  warm: ["red", "orange", "amber", "yellow"],
  nature: ["lime", "green", "emerald", "teal"],
  cool: ["cyan", "sky", "blue", "indigo"],
  rich: ["violet", "purple", "fuchsia", "pink", "rose"],
};

export const ACCENT_COLOR_GROUP_VALUES: WidgetAccentColorGroup[] = [
  "neutral",
  "warm",
  "nature",
  "cool",
  "rich",
];

export const ACCENT_COLOR_VALUES: WidgetAccentColor[] = ACCENT_COLOR_GROUP_VALUES.flatMap(
  (g) => ACCENT_COLOR_GROUPS[g],
);

/**
 * Subset of colors actually shown in the `ColorPaletteDialog` swatch grid.
 * Neutrals (gray/slate/zinc/stone) and the close-relative families
 * (amber/emerald/sky/indigo/rose) are filtered out at display time so the
 * picker stays short and unambiguous. The underlying class table still
 * contains every color so existing widget configs referencing a hidden
 * color continue to render correctly.
 */
export const DISPLAYED_PALETTE_COLORS: readonly WidgetAccentColor[] = [
  "red",
  "orange",
  "yellow",
  "lime",
  "green",
  "teal",
  "cyan",
  "blue",
  "violet",
  "purple",
  "fuchsia",
  "pink",
];

/**
 * Subset of Tailwind shades shown as columns in the `ColorPaletteDialog`.
 * The very-light shades (50–300) are unusable for text/borders against most
 * backgrounds, and the very-dark 950 is rarely picked, so only 400–900 are
 * surfaced. The underlying class table still contains all 11 shades for
 * backward compatibility with existing widget configs.
 */
export const DISPLAYED_SHADES: readonly WidgetAccentShade[] = [
  "400",
  "500",
  "600",
  "700",
  "800",
  "900",
];

/**
 * Identity map of shade tokens to their display label. The picker shows the
 * literal Tailwind shade (e.g. `"500"` displays as `"500"`), so this map is a
 * straight pass-through. Kept as a Record so call-sites that previously read
 * `SHADE_DISPLAY_LABEL[shade]` keep compiling, though new code should just
 * use the shade string directly.
 */
export const SHADE_DISPLAY_LABEL: Record<WidgetAccentShade, string> = {
  "50": "50",
  "100": "100",
  "200": "200",
  "300": "300",
  "400": "400",
  "500": "500",
  "600": "600",
  "700": "700",
  "800": "800",
  "900": "900",
  "950": "950",
};

export const BORDER_COLOR_VALUES: WidgetBorderColor[] = [
  "none",
  ...ACCENT_COLOR_VALUES,
];

export const BORDER_COLOR_LABELS: Record<WidgetBorderColor, string> = {
  none: "Sem cor (padrão)",
  ...ACCENT_COLOR_LABELS,
};

// ============================================================
// Border thickness
// ============================================================

export type WidgetBorderThickness = "none" | "thin" | "medium" | "thick";

/** Maps thickness tokens to the matching Tailwind border-width utility class. */
export const BORDER_THICKNESS_CLASSES: Record<WidgetBorderThickness, string> = {
  none: "border-0",
  thin: "border",
  medium: "border-2",
  thick: "border-4",
};

export const BORDER_THICKNESS_LABELS: Record<WidgetBorderThickness, string> = {
  none: "Sem borda",
  thin: "Fina (1px)",
  medium: "Média (2px)",
  thick: "Grossa (4px)",
};

export const BORDER_THICKNESS_VALUES: WidgetBorderThickness[] = [
  "none",
  "thin",
  "medium",
  "thick",
];

export function borderThicknessClassFor(
  value: WidgetBorderThickness | null | undefined,
): string {
  if (!value) return BORDER_THICKNESS_CLASSES.thin;
  return BORDER_THICKNESS_CLASSES[value] ?? BORDER_THICKNESS_CLASSES.thin;
}

// ============================================================
// Icon set
// ============================================================
//
// Icons are organized into categories that mirror the color groups: each
// category appears as its own section in the icon picker. To add a new icon,
// (a) import it above, (b) extend the `WidgetAccentIcon` union, (c) extend
// the `ACCENT_ICON_TUPLE`, and (d) add an entry to the relevant
// `ACCENT_ICON_GROUPS` array, components map and labels map.

export type WidgetAccentIconGroup =
  | "status"
  | "time"
  | "navigation"
  | "files"
  | "money"
  | "charts"
  | "communication"
  | "people"
  | "buildings"
  | "tools"
  | "security"
  | "locations"
  | "vehicles"
  | "devices"
  | "highlights"
  | "shapes"
  | "weather"
  | "nature"
  | "health"
  | "food"
  | "ui"
  | "actions"
  | "misc";

export const ACCENT_ICON_GROUP_LABELS: Record<WidgetAccentIconGroup, string> = {
  status: "Status",
  time: "Tempo",
  navigation: "Navegação",
  files: "Arquivos",
  money: "Financeiro",
  charts: "Gráficos",
  communication: "Comunicação",
  people: "Pessoas",
  buildings: "Edifícios",
  tools: "Ferramentas",
  security: "Segurança",
  locations: "Locais",
  vehicles: "Veículos",
  devices: "Dispositivos",
  highlights: "Destaques",
  shapes: "Formas",
  weather: "Clima",
  nature: "Natureza",
  health: "Saúde",
  food: "Comida",
  ui: "Interface",
  actions: "Ações",
  misc: "Diversos",
};

export type WidgetAccentIcon =
  // Status
  | "Check"
  | "Checkbox"
  | "CircleCheck"
  | "CircleX"
  | "X"
  | "Ban"
  | "AlertCircle"
  | "AlertTriangle"
  | "AlertOctagon"
  | "InfoCircle"
  | "QuestionMark"
  | "Help"
  | "CircleDot"
  | "Target"
  | "TargetArrow"
  | "Loader"
  | "Loader2"
  // Time
  | "Clock"
  | "Clock24"
  | "ClockHour3"
  | "ClockOff"
  | "Hourglass"
  | "HourglassHigh"
  | "HourglassLow"
  | "HourglassOff"
  | "Calendar"
  | "CalendarDue"
  | "CalendarEvent"
  | "CalendarTime"
  | "CalendarMonth"
  | "CalendarStats"
  | "CalendarPlus"
  | "CalendarOff"
  // Navigation
  | "ArrowRight"
  | "ArrowLeft"
  | "ArrowUp"
  | "ArrowDown"
  | "ArrowUpRight"
  | "ArrowDownRight"
  | "ArrowBackUp"
  | "ArrowForwardUp"
  | "ArrowsExchange"
  | "ChevronRight"
  | "ChevronLeft"
  | "ChevronUp"
  | "ChevronDown"
  | "ChevronsRight"
  | "ChevronsLeft"
  | "Refresh"
  | "Rotate"
  | "PlayerPlay"
  | "PlayerPause"
  | "PlayerStop"
  // Files
  | "File"
  | "FileText"
  | "Files"
  | "Folder"
  | "FolderOpen"
  | "FolderPlus"
  | "FileInvoice"
  | "FileSpreadsheet"
  | "Receipt"
  | "Receipt2"
  | "ReceiptOff"
  | "Clipboard"
  | "ClipboardText"
  | "ClipboardList"
  | "ClipboardCheck"
  | "ClipboardCopy"
  | "CheckupList"
  | "Note"
  | "Notebook"
  | "Book"
  | "Books"
  | "Bookmark"
  | "Bookmarks"
  | "Archive"
  | "ArchiveOff"
  | "Certificate"
  | "License"
  | "Badge"
  | "Signature"
  | "Writing"
  // Money
  | "Cash"
  | "Coin"
  | "Coins"
  | "CurrencyDollar"
  | "CurrencyReal"
  | "CurrencyEuro"
  | "CreditCard"
  | "Wallet"
  | "BuildingBank"
  | "ReportMoney"
  | "ShoppingCart"
  | "ShoppingBag"
  | "Basket"
  // Charts
  | "ChartBar"
  | "ChartLine"
  | "ChartPie"
  | "ChartArea"
  | "ChartDonut"
  | "ChartBubble"
  | "TrendingUp"
  | "TrendingDown"
  | "Activity"
  | "Gauge"
  | "ReportAnalytics"
  // Communication
  | "Mail"
  | "MailOpened"
  | "Message"
  | "Messages"
  | "MessageCircle"
  | "Phone"
  | "PhoneCall"
  | "Bell"
  | "BellRinging"
  | "BellOff"
  | "Notification"
  | "Broadcast"
  | "Send"
  | "Share"
  // People
  | "User"
  | "Users"
  | "UserCircle"
  | "UserPlus"
  | "UserCheck"
  | "UserOff"
  | "UserShield"
  | "Friends"
  | "Briefcase"
  | "AddressBook"
  | "Man"
  | "Woman"
  // Buildings
  | "Building"
  | "Factory"
  | "Factory2"
  | "BuildingStore"
  | "BuildingWarehouse"
  | "BuildingSkyscraper"
  | "BuildingCommunity"
  | "BuildingHospital"
  | "BuildingArch"
  | "BuildingChurch"
  | "BuildingMonument"
  | "Home"
  | "Home2"
  | "School"
  // Tools
  | "Settings"
  | "Adjustments"
  | "Tool"
  | "Tools"
  | "Hammer"
  | "Scale"
  | "Brush"
  | "BrushOff"
  | "Palette"
  | "Paint"
  | "ColorSwatch"
  | "Ruler"
  | "Scissors"
  | "Paperclip"
  | "Pin"
  | "Pinned"
  // Security
  | "Key"
  | "Lock"
  | "LockOpen"
  | "LockSquare"
  | "Shield"
  | "ShieldCheck"
  | "Eye"
  | "EyeOff"
  | "Fingerprint"
  // Locations
  | "World"
  | "MapPin"
  | "Map2"
  | "Navigation"
  | "Compass"
  | "Location"
  | "Route"
  // Vehicles
  | "Car"
  | "Truck"
  | "Bike"
  | "Plane"
  | "Ambulance"
  | "Package"
  | "Packages"
  | "Box"
  // Devices
  | "DeviceDesktop"
  | "DeviceMobile"
  | "DeviceLaptop"
  | "DeviceTablet"
  | "DeviceTv"
  | "Keyboard"
  | "Mouse"
  | "Headphones"
  | "Camera"
  | "Photo"
  | "Video"
  | "Music"
  | "Volume"
  | "Microphone"
  | "Printer"
  | "Cpu"
  | "Database"
  | "Server"
  | "Code"
  | "Terminal2"
  | "Robot"
  | "Qrcode"
  | "Barcode"
  | "Scan"
  | "Wifi"
  | "WifiOff"
  | "Bluetooth"
  | "Battery"
  | "Battery1"
  | "Battery2"
  | "Battery3"
  | "Battery4"
  // Highlights
  | "Bolt"
  | "BoltOff"
  | "Star"
  | "Heart"
  | "Heartbeat"
  | "HeartHandshake"
  | "Flag"
  | "Flame"
  | "Rocket"
  | "Trophy"
  | "Award"
  | "Crown"
  | "Gift"
  | "Balloon"
  | "Cake"
  | "Confetti"
  | "Sparkles"
  | "Wand"
  | "Bulb"
  // Shapes
  | "Circle"
  | "Square"
  | "Triangle"
  | "Hexagon"
  | "Diamond"
  | "Shape"
  // Weather
  | "Cloud"
  | "Sun"
  | "Moon"
  | "CloudRain"
  | "CloudFog"
  | "Snowflake"
  | "Umbrella"
  | "Wind"
  | "Rainbow"
  | "Sunrise"
  | "Sunset"
  // Nature
  | "Leaf"
  | "Tree"
  | "Flower"
  | "Clover"
  | "Cactus"
  | "Mushroom"
  | "Plant"
  | "Paw"
  | "Fish"
  | "Cat"
  | "Dog"
  | "Horse"
  | "Bug"
  | "Butterfly"
  // Health
  | "Stethoscope"
  | "FirstAidKit"
  | "Pill"
  | "Vaccine"
  // Food
  | "Coffee"
  | "Beer"
  | "Pizza"
  | "Cookie"
  | "Carrot"
  | "Apple"
  | "Bread"
  | "Cheese"
  | "Grain"
  // UI
  | "Search"
  | "Filter"
  | "SortAscending"
  | "SortDescending"
  | "LayoutGrid"
  | "LayoutList"
  | "LayoutDashboard"
  | "List"
  | "Columns"
  | "TableImport"
  | "TableExport"
  // Actions
  | "Upload"
  | "Download"
  | "CloudUpload"
  | "CloudDownload"
  | "Link"
  | "Unlink"
  | "ExternalLink"
  | "Copy"
  | "Cut"
  | "Recycle"
  | "RecycleOff"
  | "Trash"
  | "Plus"
  | "Minus"
  | "Edit"
  | "Pencil"
  | "Highlight"
  | "Ballpen"
  | "Eraser"
  | "Backpack"
  // Misc
  | "Flask"
  | "Atom"
  | "Microscope"
  | "Swords"
  | "FireHydrant"
  | "Tie"
  | "Shirt";

export const ACCENT_ICON_COMPONENTS: Record<
  WidgetAccentIcon,
  ComponentType<{ className?: string; size?: number }>
> = {
  // Status
  Check: IconCheck,
  Checkbox: IconCheckbox,
  CircleCheck: IconCircleCheck,
  CircleX: IconCircleX,
  X: IconX,
  Ban: IconBan,
  AlertCircle: IconAlertCircle,
  AlertTriangle: IconAlertTriangle,
  AlertOctagon: IconAlertOctagon,
  InfoCircle: IconInfoCircle,
  QuestionMark: IconQuestionMark,
  Help: IconHelp,
  CircleDot: IconCircleDot,
  Target: IconTarget,
  TargetArrow: IconTargetArrow,
  Loader: IconLoader,
  Loader2: IconLoader2,
  // Time
  Clock: IconClock,
  Clock24: IconClock24,
  ClockHour3: IconClockHour3,
  ClockOff: IconClockOff,
  Hourglass: IconHourglass,
  HourglassHigh: IconHourglassHigh,
  HourglassLow: IconHourglassLow,
  HourglassOff: IconHourglassOff,
  Calendar: IconCalendar,
  CalendarDue: IconCalendarDue,
  CalendarEvent: IconCalendarEvent,
  CalendarTime: IconCalendarTime,
  CalendarMonth: IconCalendarMonth,
  CalendarStats: IconCalendarStats,
  CalendarPlus: IconCalendarPlus,
  CalendarOff: IconCalendarOff,
  // Navigation
  ArrowRight: IconArrowRight,
  ArrowLeft: IconArrowLeft,
  ArrowUp: IconArrowUp,
  ArrowDown: IconArrowDown,
  ArrowUpRight: IconArrowUpRight,
  ArrowDownRight: IconArrowDownRight,
  ArrowBackUp: IconArrowBackUp,
  ArrowForwardUp: IconArrowForwardUp,
  ArrowsExchange: IconArrowsExchange,
  ChevronRight: IconChevronRight,
  ChevronLeft: IconChevronLeft,
  ChevronUp: IconChevronUp,
  ChevronDown: IconChevronDown,
  ChevronsRight: IconChevronsRight,
  ChevronsLeft: IconChevronsLeft,
  Refresh: IconRefresh,
  Rotate: IconRotate,
  PlayerPlay: IconPlayerPlay,
  PlayerPause: IconPlayerPause,
  PlayerStop: IconPlayerStop,
  // Files
  File: IconFile,
  FileText: IconFileText,
  Files: IconFiles,
  Folder: IconFolder,
  FolderOpen: IconFolderOpen,
  FolderPlus: IconFolderPlus,
  FileInvoice: IconFileInvoice,
  FileSpreadsheet: IconFileSpreadsheet,
  Receipt: IconReceipt,
  Receipt2: IconReceipt2,
  ReceiptOff: IconReceiptOff,
  Clipboard: IconClipboard,
  ClipboardText: IconClipboardText,
  ClipboardList: IconClipboardList,
  ClipboardCheck: IconClipboardCheck,
  ClipboardCopy: IconClipboardCopy,
  CheckupList: IconCheckupList,
  Note: IconNote,
  Notebook: IconNotebook,
  Book: IconBook,
  Books: IconBooks,
  Bookmark: IconBookmark,
  Bookmarks: IconBookmarks,
  Archive: IconArchive,
  ArchiveOff: IconArchiveOff,
  Certificate: IconCertificate,
  License: IconLicense,
  Badge: IconBadge,
  Signature: IconSignature,
  Writing: IconWriting,
  // Money
  Cash: IconCash,
  Coin: IconCoin,
  Coins: IconCoins,
  CurrencyDollar: IconCurrencyDollar,
  CurrencyReal: IconCurrencyReal,
  CurrencyEuro: IconCurrencyEuro,
  CreditCard: IconCreditCard,
  Wallet: IconWallet,
  BuildingBank: IconBuildingBank,
  ReportMoney: IconReportMoney,
  ShoppingCart: IconShoppingCart,
  ShoppingBag: IconShoppingBag,
  Basket: IconBasket,
  // Charts
  ChartBar: IconChartBar,
  ChartLine: IconChartLine,
  ChartPie: IconChartPie,
  ChartArea: IconChartArea,
  ChartDonut: IconChartDonut,
  ChartBubble: IconChartBubble,
  TrendingUp: IconTrendingUp,
  TrendingDown: IconTrendingDown,
  Activity: IconActivity,
  Gauge: IconGauge,
  ReportAnalytics: IconReportAnalytics,
  // Communication
  Mail: IconMail,
  MailOpened: IconMailOpened,
  Message: IconMessage,
  Messages: IconMessages,
  MessageCircle: IconMessageCircle,
  Phone: IconPhone,
  PhoneCall: IconPhoneCall,
  Bell: IconBell,
  BellRinging: IconBellRinging,
  BellOff: IconBellOff,
  Notification: IconNotification,
  Broadcast: IconBroadcast,
  Send: IconSend,
  Share: IconShare,
  // People
  User: IconUser,
  Users: IconUsers,
  UserCircle: IconUserCircle,
  UserPlus: IconUserPlus,
  UserCheck: IconUserCheck,
  UserOff: IconUserOff,
  UserShield: IconUserShield,
  Friends: IconFriends,
  Briefcase: IconBriefcase,
  AddressBook: IconAddressBook,
  Man: IconMan,
  Woman: IconWoman,
  // Buildings
  Building: IconBuilding,
  Factory: IconBuildingFactory,
  Factory2: IconBuildingFactory2,
  BuildingStore: IconBuildingStore,
  BuildingWarehouse: IconBuildingWarehouse,
  BuildingSkyscraper: IconBuildingSkyscraper,
  BuildingCommunity: IconBuildingCommunity,
  BuildingHospital: IconBuildingHospital,
  BuildingArch: IconBuildingArch,
  BuildingChurch: IconBuildingChurch,
  BuildingMonument: IconBuildingMonument,
  Home: IconHome,
  Home2: IconHome2,
  School: IconSchool,
  // Tools
  Settings: IconSettings,
  Adjustments: IconAdjustments,
  Tool: IconTool,
  Tools: IconTools,
  Hammer: IconHammer,
  Scale: IconScale,
  Brush: IconBrush,
  BrushOff: IconBrushOff,
  Palette: IconPalette,
  Paint: IconPaint,
  ColorSwatch: IconColorSwatch,
  Ruler: IconRuler,
  Scissors: IconScissors,
  Paperclip: IconPaperclip,
  Pin: IconPin,
  Pinned: IconPinned,
  // Security
  Key: IconKey,
  Lock: IconLock,
  LockOpen: IconLockOpen,
  LockSquare: IconLockSquare,
  Shield: IconShield,
  ShieldCheck: IconShieldCheck,
  Eye: IconEye,
  EyeOff: IconEyeOff,
  Fingerprint: IconFingerprint,
  // Locations
  World: IconWorld,
  MapPin: IconMapPin,
  Map2: IconMap2,
  Navigation: IconNavigation,
  Compass: IconCompass,
  Location: IconLocation,
  Route: IconRoute,
  // Vehicles
  Car: IconCar,
  Truck: IconTruck,
  Bike: IconBike,
  Plane: IconPlane,
  Ambulance: IconAmbulance,
  Package: IconPackage,
  Packages: IconPackages,
  Box: IconBox,
  // Devices
  DeviceDesktop: IconDeviceDesktop,
  DeviceMobile: IconDeviceMobile,
  DeviceLaptop: IconDeviceLaptop,
  DeviceTablet: IconDeviceTablet,
  DeviceTv: IconDeviceTv,
  Keyboard: IconKeyboard,
  Mouse: IconMouse,
  Headphones: IconHeadphones,
  Camera: IconCamera,
  Photo: IconPhoto,
  Video: IconVideo,
  Music: IconMusic,
  Volume: IconVolume,
  Microphone: IconMicrophone,
  Printer: IconPrinter,
  Cpu: IconCpu,
  Database: IconDatabase,
  Server: IconServer,
  Code: IconCode,
  Terminal2: IconTerminal2,
  Robot: IconRobot,
  Qrcode: IconQrcode,
  Barcode: IconBarcode,
  Scan: IconScan,
  Wifi: IconWifi,
  WifiOff: IconWifiOff,
  Bluetooth: IconBluetooth,
  Battery: IconBattery,
  Battery1: IconBattery1,
  Battery2: IconBattery2,
  Battery3: IconBattery3,
  Battery4: IconBattery4,
  // Highlights
  Bolt: IconBolt,
  BoltOff: IconBoltOff,
  Star: IconStar,
  Heart: IconHeart,
  Heartbeat: IconHeartbeat,
  HeartHandshake: IconHeartHandshake,
  Flag: IconFlag,
  Flame: IconFlame,
  Rocket: IconRocket,
  Trophy: IconTrophy,
  Award: IconAward,
  Crown: IconCrown,
  Gift: IconGift,
  Balloon: IconBalloon,
  Cake: IconCake,
  Confetti: IconConfetti,
  Sparkles: IconSparkles,
  Wand: IconWand,
  Bulb: IconBulb,
  // Shapes
  Circle: IconCircle,
  Square: IconSquare,
  Triangle: IconTriangle,
  Hexagon: IconHexagon,
  Diamond: IconDiamond,
  Shape: IconShape,
  // Weather
  Cloud: IconCloud,
  Sun: IconSun,
  Moon: IconMoon,
  CloudRain: IconCloudRain,
  CloudFog: IconCloudFog,
  Snowflake: IconSnowflake,
  Umbrella: IconUmbrella,
  Wind: IconWind,
  Rainbow: IconRainbow,
  Sunrise: IconSunrise,
  Sunset: IconSunset,
  // Nature
  Leaf: IconLeaf,
  Tree: IconTree,
  Flower: IconFlower,
  Clover: IconClover,
  Cactus: IconCactus,
  Mushroom: IconMushroom,
  Plant: IconPlant,
  Paw: IconPaw,
  Fish: IconFish,
  Cat: IconCat,
  Dog: IconDog,
  Horse: IconHorse,
  Bug: IconBug,
  Butterfly: IconButterfly,
  // Health
  Stethoscope: IconStethoscope,
  FirstAidKit: IconFirstAidKit,
  Pill: IconPill,
  Vaccine: IconVaccine,
  // Food
  Coffee: IconCoffee,
  Beer: IconBeer,
  Pizza: IconPizza,
  Cookie: IconCookie,
  Carrot: IconCarrot,
  Apple: IconApple,
  Bread: IconBread,
  Cheese: IconCheese,
  Grain: IconGrain,
  // UI
  Search: IconSearch,
  Filter: IconFilter,
  SortAscending: IconSortAscending,
  SortDescending: IconSortDescending,
  LayoutGrid: IconLayoutGrid,
  LayoutList: IconLayoutList,
  LayoutDashboard: IconLayoutDashboard,
  List: IconList,
  Columns: IconColumns,
  TableImport: IconTableImport,
  TableExport: IconTableExport,
  // Actions
  Upload: IconUpload,
  Download: IconDownload,
  CloudUpload: IconCloudUpload,
  CloudDownload: IconCloudDownload,
  Link: IconLink,
  Unlink: IconUnlink,
  ExternalLink: IconExternalLink,
  Copy: IconCopy,
  Cut: IconCut,
  Recycle: IconRecycle,
  RecycleOff: IconRecycleOff,
  Trash: IconTrash,
  Plus: IconPlus,
  Minus: IconMinus,
  Edit: IconEdit,
  Pencil: IconPencil,
  Highlight: IconHighlight,
  Ballpen: IconBallpen,
  Eraser: IconEraser,
  Backpack: IconBackpack,
  // Misc
  Flask: IconFlask,
  Atom: IconAtom,
  Microscope: IconMicroscope,
  Swords: IconSwords,
  FireHydrant: IconFireHydrant,
  Tie: IconTie,
  Shirt: IconShirt,
};

export const ACCENT_ICON_LABELS: Record<WidgetAccentIcon, string> = {
  // Status
  Check: "Visto",
  Checkbox: "Caixa marcada",
  CircleCheck: "Visto em círculo",
  CircleX: "X em círculo",
  X: "X",
  Ban: "Proibido",
  AlertCircle: "Alerta circular",
  AlertTriangle: "Alerta",
  AlertOctagon: "Alerta octogonal",
  InfoCircle: "Informação",
  QuestionMark: "Interrogação",
  Help: "Ajuda",
  CircleDot: "Ponto em círculo",
  Target: "Alvo",
  TargetArrow: "Alvo com flecha",
  Loader: "Carregando",
  Loader2: "Carregando 2",
  // Time
  Clock: "Relógio",
  Clock24: "Relógio 24h",
  ClockHour3: "Relógio 3h",
  ClockOff: "Relógio desligado",
  Hourglass: "Ampulheta",
  HourglassHigh: "Ampulheta cheia",
  HourglassLow: "Ampulheta vazia",
  HourglassOff: "Ampulheta desligada",
  Calendar: "Calendário",
  CalendarDue: "Calendário (prazo)",
  CalendarEvent: "Calendário (evento)",
  CalendarTime: "Calendário (hora)",
  CalendarMonth: "Calendário mensal",
  CalendarStats: "Calendário (estatísticas)",
  CalendarPlus: "Adicionar ao calendário",
  CalendarOff: "Calendário desligado",
  // Navigation
  ArrowRight: "Seta direita",
  ArrowLeft: "Seta esquerda",
  ArrowUp: "Seta para cima",
  ArrowDown: "Seta para baixo",
  ArrowUpRight: "Seta diagonal cima",
  ArrowDownRight: "Seta diagonal baixo",
  ArrowBackUp: "Voltar",
  ArrowForwardUp: "Avançar",
  ArrowsExchange: "Trocar setas",
  ChevronRight: "Chevron direita",
  ChevronLeft: "Chevron esquerda",
  ChevronUp: "Chevron cima",
  ChevronDown: "Chevron baixo",
  ChevronsRight: "Chevrons direita",
  ChevronsLeft: "Chevrons esquerda",
  Refresh: "Atualizar",
  Rotate: "Girar",
  PlayerPlay: "Reproduzir",
  PlayerPause: "Pausar",
  PlayerStop: "Parar",
  // Files
  File: "Arquivo",
  FileText: "Documento",
  Files: "Arquivos",
  Folder: "Pasta",
  FolderOpen: "Pasta aberta",
  FolderPlus: "Nova pasta",
  FileInvoice: "Nota fiscal",
  FileSpreadsheet: "Planilha",
  Receipt: "Recibo",
  Receipt2: "Recibo 2",
  ReceiptOff: "Sem recibo",
  Clipboard: "Prancheta",
  ClipboardText: "Prancheta com texto",
  ClipboardList: "Prancheta de lista",
  ClipboardCheck: "Prancheta concluída",
  ClipboardCopy: "Copiar prancheta",
  CheckupList: "Checklist",
  Note: "Nota",
  Notebook: "Caderno",
  Book: "Livro",
  Books: "Livros",
  Bookmark: "Marcador",
  Bookmarks: "Marcadores",
  Archive: "Arquivo morto",
  ArchiveOff: "Sem arquivo",
  Certificate: "Certificado",
  License: "Licença",
  Badge: "Crachá",
  Signature: "Assinatura",
  Writing: "Escrita",
  // Money
  Cash: "Dinheiro",
  Coin: "Moeda",
  Coins: "Moedas",
  CurrencyDollar: "Dólar",
  CurrencyReal: "Real",
  CurrencyEuro: "Euro",
  CreditCard: "Cartão de crédito",
  Wallet: "Carteira",
  BuildingBank: "Banco",
  ReportMoney: "Relatório financeiro",
  ShoppingCart: "Carrinho",
  ShoppingBag: "Sacola",
  Basket: "Cesto",
  // Charts
  ChartBar: "Gráfico de barras",
  ChartLine: "Gráfico de linha",
  ChartPie: "Gráfico de pizza",
  ChartArea: "Gráfico de área",
  ChartDonut: "Gráfico rosquinha",
  ChartBubble: "Gráfico de bolhas",
  TrendingUp: "Tendência de alta",
  TrendingDown: "Tendência de baixa",
  Activity: "Atividade",
  Gauge: "Velocímetro",
  ReportAnalytics: "Relatório analítico",
  // Communication
  Mail: "E-mail",
  MailOpened: "E-mail aberto",
  Message: "Mensagem",
  Messages: "Mensagens",
  MessageCircle: "Mensagem (balão)",
  Phone: "Telefone",
  PhoneCall: "Chamada",
  Bell: "Sino",
  BellRinging: "Sino tocando",
  BellOff: "Sino desligado",
  Notification: "Notificação",
  Broadcast: "Transmissão",
  Send: "Enviar",
  Share: "Compartilhar",
  // People
  User: "Usuário",
  Users: "Pessoas",
  UserCircle: "Usuário (círculo)",
  UserPlus: "Adicionar usuário",
  UserCheck: "Usuário verificado",
  UserOff: "Usuário desligado",
  UserShield: "Usuário protegido",
  Friends: "Amigos",
  Briefcase: "Pasta",
  AddressBook: "Agenda",
  Man: "Homem",
  Woman: "Mulher",
  // Buildings
  Building: "Edifício",
  Factory: "Fábrica",
  Factory2: "Fábrica 2",
  BuildingStore: "Loja",
  BuildingWarehouse: "Galpão",
  BuildingSkyscraper: "Arranha-céu",
  BuildingCommunity: "Comunidade",
  BuildingHospital: "Hospital",
  BuildingArch: "Arco",
  BuildingChurch: "Igreja",
  BuildingMonument: "Monumento",
  Home: "Casa",
  Home2: "Casa 2",
  School: "Escola",
  // Tools
  Settings: "Configurações",
  Adjustments: "Ajustes",
  Tool: "Ferramenta",
  Tools: "Ferramentas",
  Hammer: "Martelo",
  Scale: "Balança",
  Brush: "Pincel",
  BrushOff: "Pincel desligado",
  Palette: "Paleta",
  Paint: "Tinta",
  ColorSwatch: "Amostra de cor",
  Ruler: "Régua",
  Scissors: "Tesoura",
  Paperclip: "Clipe",
  Pin: "Alfinete",
  Pinned: "Fixado",
  // Security
  Key: "Chave",
  Lock: "Cadeado",
  LockOpen: "Cadeado aberto",
  LockSquare: "Cadeado quadrado",
  Shield: "Escudo",
  ShieldCheck: "Escudo verificado",
  Eye: "Olho",
  EyeOff: "Olho fechado",
  Fingerprint: "Digital",
  // Locations
  World: "Mundo",
  MapPin: "Marcador no mapa",
  Map2: "Mapa",
  Navigation: "Navegação",
  Compass: "Bússola",
  Location: "Localização",
  Route: "Rota",
  // Vehicles
  Car: "Carro",
  Truck: "Caminhão",
  Bike: "Bicicleta",
  Plane: "Avião",
  Ambulance: "Ambulância",
  Package: "Pacote",
  Packages: "Pacotes",
  Box: "Caixa",
  // Devices
  DeviceDesktop: "Desktop",
  DeviceMobile: "Celular",
  DeviceLaptop: "Notebook",
  DeviceTablet: "Tablet",
  DeviceTv: "TV",
  Keyboard: "Teclado",
  Mouse: "Mouse",
  Headphones: "Fones",
  Camera: "Câmera",
  Photo: "Foto",
  Video: "Vídeo",
  Music: "Música",
  Volume: "Volume",
  Microphone: "Microfone",
  Printer: "Impressora",
  Cpu: "CPU",
  Database: "Banco de dados",
  Server: "Servidor",
  Code: "Código",
  Terminal2: "Terminal",
  Robot: "Robô",
  Qrcode: "QR Code",
  Barcode: "Código de barras",
  Scan: "Escanear",
  Wifi: "Wi-Fi",
  WifiOff: "Sem Wi-Fi",
  Bluetooth: "Bluetooth",
  Battery: "Bateria",
  Battery1: "Bateria baixa",
  Battery2: "Bateria 25%",
  Battery3: "Bateria 50%",
  Battery4: "Bateria cheia",
  // Highlights
  Bolt: "Raio",
  BoltOff: "Sem raio",
  Star: "Estrela",
  Heart: "Coração",
  Heartbeat: "Batimento",
  HeartHandshake: "Aperto de mãos",
  Flag: "Bandeira",
  Flame: "Chama",
  Rocket: "Foguete",
  Trophy: "Troféu",
  Award: "Prêmio",
  Crown: "Coroa",
  Gift: "Presente",
  Balloon: "Balão",
  Cake: "Bolo",
  Confetti: "Confete",
  Sparkles: "Brilhos",
  Wand: "Varinha",
  Bulb: "Lâmpada",
  // Shapes
  Circle: "Círculo",
  Square: "Quadrado",
  Triangle: "Triângulo",
  Hexagon: "Hexágono",
  Diamond: "Diamante",
  Shape: "Forma",
  // Weather
  Cloud: "Nuvem",
  Sun: "Sol",
  Moon: "Lua",
  CloudRain: "Chuva",
  CloudFog: "Neblina",
  Snowflake: "Floco de neve",
  Umbrella: "Guarda-chuva",
  Wind: "Vento",
  Rainbow: "Arco-íris",
  Sunrise: "Nascer do sol",
  Sunset: "Pôr do sol",
  // Nature
  Leaf: "Folha",
  Tree: "Árvore",
  Flower: "Flor",
  Clover: "Trevo",
  Cactus: "Cacto",
  Mushroom: "Cogumelo",
  Plant: "Planta",
  Paw: "Pata",
  Fish: "Peixe",
  Cat: "Gato",
  Dog: "Cachorro",
  Horse: "Cavalo",
  Bug: "Inseto",
  Butterfly: "Borboleta",
  // Health
  Stethoscope: "Estetoscópio",
  FirstAidKit: "Primeiros socorros",
  Pill: "Comprimido",
  Vaccine: "Vacina",
  // Food
  Coffee: "Café",
  Beer: "Cerveja",
  Pizza: "Pizza",
  Cookie: "Biscoito",
  Carrot: "Cenoura",
  Apple: "Maçã",
  Bread: "Pão",
  Cheese: "Queijo",
  Grain: "Grão",
  // UI
  Search: "Buscar",
  Filter: "Filtrar",
  SortAscending: "Ordem crescente",
  SortDescending: "Ordem decrescente",
  LayoutGrid: "Grade",
  LayoutList: "Lista",
  LayoutDashboard: "Painel",
  List: "Lista (simples)",
  Columns: "Colunas",
  TableImport: "Importar tabela",
  TableExport: "Exportar tabela",
  // Actions
  Upload: "Enviar",
  Download: "Baixar",
  CloudUpload: "Upload nuvem",
  CloudDownload: "Download nuvem",
  Link: "Vínculo",
  Unlink: "Desvincular",
  ExternalLink: "Link externo",
  Copy: "Copiar",
  Cut: "Recortar",
  Recycle: "Reciclar",
  RecycleOff: "Sem reciclagem",
  Trash: "Lixeira",
  Plus: "Adicionar",
  Minus: "Remover",
  Edit: "Editar",
  Pencil: "Lápis",
  Highlight: "Marca-texto",
  Ballpen: "Caneta",
  Eraser: "Borracha",
  Backpack: "Mochila",
  // Misc
  Flask: "Frasco",
  Atom: "Átomo",
  Microscope: "Microscópio",
  Swords: "Espadas",
  FireHydrant: "Hidrante",
  Tie: "Gravata",
  Shirt: "Camisa",
};

export const ACCENT_ICON_GROUPS: Record<WidgetAccentIconGroup, WidgetAccentIcon[]> = {
  status: [
    "Check",
    "Checkbox",
    "CircleCheck",
    "CircleX",
    "X",
    "Ban",
    "AlertCircle",
    "AlertTriangle",
    "AlertOctagon",
    "InfoCircle",
    "QuestionMark",
    "Help",
    "CircleDot",
    "Target",
    "TargetArrow",
    "Loader",
    "Loader2",
  ],
  time: [
    "Clock",
    "Clock24",
    "ClockHour3",
    "ClockOff",
    "Hourglass",
    "HourglassHigh",
    "HourglassLow",
    "HourglassOff",
    "Calendar",
    "CalendarDue",
    "CalendarEvent",
    "CalendarTime",
    "CalendarMonth",
    "CalendarStats",
    "CalendarPlus",
    "CalendarOff",
  ],
  navigation: [
    "ArrowRight",
    "ArrowLeft",
    "ArrowUp",
    "ArrowDown",
    "ArrowUpRight",
    "ArrowDownRight",
    "ArrowBackUp",
    "ArrowForwardUp",
    "ArrowsExchange",
    "ChevronRight",
    "ChevronLeft",
    "ChevronUp",
    "ChevronDown",
    "ChevronsRight",
    "ChevronsLeft",
    "Refresh",
    "Rotate",
    "PlayerPlay",
    "PlayerPause",
    "PlayerStop",
  ],
  files: [
    "File",
    "FileText",
    "Files",
    "Folder",
    "FolderOpen",
    "FolderPlus",
    "FileInvoice",
    "FileSpreadsheet",
    "Receipt",
    "Receipt2",
    "ReceiptOff",
    "Clipboard",
    "ClipboardText",
    "ClipboardList",
    "ClipboardCheck",
    "ClipboardCopy",
    "CheckupList",
    "Note",
    "Notebook",
    "Book",
    "Books",
    "Bookmark",
    "Bookmarks",
    "Archive",
    "ArchiveOff",
    "Certificate",
    "License",
    "Badge",
    "Signature",
    "Writing",
  ],
  money: [
    "Cash",
    "Coin",
    "Coins",
    "CurrencyDollar",
    "CurrencyReal",
    "CurrencyEuro",
    "CreditCard",
    "Wallet",
    "BuildingBank",
    "ReportMoney",
    "ShoppingCart",
    "ShoppingBag",
    "Basket",
  ],
  charts: [
    "ChartBar",
    "ChartLine",
    "ChartPie",
    "ChartArea",
    "ChartDonut",
    "ChartBubble",
    "TrendingUp",
    "TrendingDown",
    "Activity",
    "Gauge",
    "ReportAnalytics",
  ],
  communication: [
    "Mail",
    "MailOpened",
    "Message",
    "Messages",
    "MessageCircle",
    "Phone",
    "PhoneCall",
    "Bell",
    "BellRinging",
    "BellOff",
    "Notification",
    "Broadcast",
    "Send",
    "Share",
  ],
  people: [
    "User",
    "Users",
    "UserCircle",
    "UserPlus",
    "UserCheck",
    "UserOff",
    "UserShield",
    "Friends",
    "Briefcase",
    "AddressBook",
    "Man",
    "Woman",
  ],
  buildings: [
    "Building",
    "Factory",
    "Factory2",
    "BuildingStore",
    "BuildingWarehouse",
    "BuildingSkyscraper",
    "BuildingCommunity",
    "BuildingHospital",
    "BuildingArch",
    "BuildingChurch",
    "BuildingMonument",
    "Home",
    "Home2",
    "School",
  ],
  tools: [
    "Settings",
    "Adjustments",
    "Tool",
    "Tools",
    "Hammer",
    "Scale",
    "Brush",
    "BrushOff",
    "Palette",
    "Paint",
    "ColorSwatch",
    "Ruler",
    "Scissors",
    "Paperclip",
    "Pin",
    "Pinned",
  ],
  security: [
    "Key",
    "Lock",
    "LockOpen",
    "LockSquare",
    "Shield",
    "ShieldCheck",
    "Eye",
    "EyeOff",
    "Fingerprint",
  ],
  locations: [
    "World",
    "MapPin",
    "Map2",
    "Navigation",
    "Compass",
    "Location",
    "Route",
  ],
  vehicles: [
    "Car",
    "Truck",
    "Bike",
    "Plane",
    "Ambulance",
    "Package",
    "Packages",
    "Box",
  ],
  devices: [
    "DeviceDesktop",
    "DeviceMobile",
    "DeviceLaptop",
    "DeviceTablet",
    "DeviceTv",
    "Keyboard",
    "Mouse",
    "Headphones",
    "Camera",
    "Photo",
    "Video",
    "Music",
    "Volume",
    "Microphone",
    "Printer",
    "Cpu",
    "Database",
    "Server",
    "Code",
    "Terminal2",
    "Robot",
    "Qrcode",
    "Barcode",
    "Scan",
    "Wifi",
    "WifiOff",
    "Bluetooth",
    "Battery",
    "Battery1",
    "Battery2",
    "Battery3",
    "Battery4",
  ],
  highlights: [
    "Bolt",
    "BoltOff",
    "Star",
    "Heart",
    "Heartbeat",
    "HeartHandshake",
    "Flag",
    "Flame",
    "Rocket",
    "Trophy",
    "Award",
    "Crown",
    "Gift",
    "Balloon",
    "Cake",
    "Confetti",
    "Sparkles",
    "Wand",
    "Bulb",
  ],
  shapes: ["Circle", "Square", "Triangle", "Hexagon", "Diamond", "Shape"],
  weather: [
    "Cloud",
    "Sun",
    "Moon",
    "CloudRain",
    "CloudFog",
    "Snowflake",
    "Umbrella",
    "Wind",
    "Rainbow",
    "Sunrise",
    "Sunset",
  ],
  nature: [
    "Leaf",
    "Tree",
    "Flower",
    "Clover",
    "Cactus",
    "Mushroom",
    "Plant",
    "Paw",
    "Fish",
    "Cat",
    "Dog",
    "Horse",
    "Bug",
    "Butterfly",
  ],
  health: ["Stethoscope", "FirstAidKit", "Pill", "Vaccine"],
  food: [
    "Coffee",
    "Beer",
    "Pizza",
    "Cookie",
    "Carrot",
    "Apple",
    "Bread",
    "Cheese",
    "Grain",
  ],
  ui: [
    "Search",
    "Filter",
    "SortAscending",
    "SortDescending",
    "LayoutGrid",
    "LayoutList",
    "LayoutDashboard",
    "List",
    "Columns",
    "TableImport",
    "TableExport",
  ],
  actions: [
    "Upload",
    "Download",
    "CloudUpload",
    "CloudDownload",
    "Link",
    "Unlink",
    "ExternalLink",
    "Copy",
    "Cut",
    "Recycle",
    "RecycleOff",
    "Trash",
    "Plus",
    "Minus",
    "Edit",
    "Pencil",
    "Highlight",
    "Ballpen",
    "Eraser",
    "Backpack",
  ],
  misc: [
    "Flask",
    "Atom",
    "Microscope",
    "Swords",
    "FireHydrant",
    "Tie",
    "Shirt",
  ],
};

export const ACCENT_ICON_GROUP_VALUES: WidgetAccentIconGroup[] = [
  "status",
  "time",
  "navigation",
  "files",
  "money",
  "charts",
  "communication",
  "people",
  "buildings",
  "tools",
  "security",
  "locations",
  "vehicles",
  "devices",
  "highlights",
  "shapes",
  "weather",
  "nature",
  "health",
  "food",
  "ui",
  "actions",
  "misc",
];

export const ACCENT_ICON_VALUES: WidgetAccentIcon[] = ACCENT_ICON_GROUP_VALUES.flatMap(
  (g) => ACCENT_ICON_GROUPS[g],
);

// ============================================================
// Shared Zod schema factory — every widget that wants the accent system
// builds its config off this so we don't duplicate the enum lists.
// ============================================================

const ACCENT_COLOR_TUPLE = [
  "gray",
  "slate",
  "zinc",
  "stone",
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "emerald",
  "teal",
  "cyan",
  "sky",
  "blue",
  "indigo",
  "violet",
  "purple",
  "fuchsia",
  "pink",
  "rose",
] as const;

const ACCENT_ICON_TUPLE = [
  // Status
  "Check",
  "Checkbox",
  "CircleCheck",
  "CircleX",
  "X",
  "Ban",
  "AlertCircle",
  "AlertTriangle",
  "AlertOctagon",
  "InfoCircle",
  "QuestionMark",
  "Help",
  "CircleDot",
  "Target",
  "TargetArrow",
  "Loader",
  "Loader2",
  // Time
  "Clock",
  "Clock24",
  "ClockHour3",
  "ClockOff",
  "Hourglass",
  "HourglassHigh",
  "HourglassLow",
  "HourglassOff",
  "Calendar",
  "CalendarDue",
  "CalendarEvent",
  "CalendarTime",
  "CalendarMonth",
  "CalendarStats",
  "CalendarPlus",
  "CalendarOff",
  // Navigation
  "ArrowRight",
  "ArrowLeft",
  "ArrowUp",
  "ArrowDown",
  "ArrowUpRight",
  "ArrowDownRight",
  "ArrowBackUp",
  "ArrowForwardUp",
  "ArrowsExchange",
  "ChevronRight",
  "ChevronLeft",
  "ChevronUp",
  "ChevronDown",
  "ChevronsRight",
  "ChevronsLeft",
  "Refresh",
  "Rotate",
  "PlayerPlay",
  "PlayerPause",
  "PlayerStop",
  // Files
  "File",
  "FileText",
  "Files",
  "Folder",
  "FolderOpen",
  "FolderPlus",
  "FileInvoice",
  "FileSpreadsheet",
  "Receipt",
  "Receipt2",
  "ReceiptOff",
  "Clipboard",
  "ClipboardText",
  "ClipboardList",
  "ClipboardCheck",
  "ClipboardCopy",
  "CheckupList",
  "Note",
  "Notebook",
  "Book",
  "Books",
  "Bookmark",
  "Bookmarks",
  "Archive",
  "ArchiveOff",
  "Certificate",
  "License",
  "Badge",
  "Signature",
  "Writing",
  // Money
  "Cash",
  "Coin",
  "Coins",
  "CurrencyDollar",
  "CurrencyReal",
  "CurrencyEuro",
  "CreditCard",
  "Wallet",
  "BuildingBank",
  "ReportMoney",
  "ShoppingCart",
  "ShoppingBag",
  "Basket",
  // Charts
  "ChartBar",
  "ChartLine",
  "ChartPie",
  "ChartArea",
  "ChartDonut",
  "ChartBubble",
  "TrendingUp",
  "TrendingDown",
  "Activity",
  "Gauge",
  "ReportAnalytics",
  // Communication
  "Mail",
  "MailOpened",
  "Message",
  "Messages",
  "MessageCircle",
  "Phone",
  "PhoneCall",
  "Bell",
  "BellRinging",
  "BellOff",
  "Notification",
  "Broadcast",
  "Send",
  "Share",
  // People
  "User",
  "Users",
  "UserCircle",
  "UserPlus",
  "UserCheck",
  "UserOff",
  "UserShield",
  "Friends",
  "Briefcase",
  "AddressBook",
  "Man",
  "Woman",
  // Buildings
  "Building",
  "Factory",
  "Factory2",
  "BuildingStore",
  "BuildingWarehouse",
  "BuildingSkyscraper",
  "BuildingCommunity",
  "BuildingHospital",
  "BuildingArch",
  "BuildingChurch",
  "BuildingMonument",
  "Home",
  "Home2",
  "School",
  // Tools
  "Settings",
  "Adjustments",
  "Tool",
  "Tools",
  "Hammer",
  "Scale",
  "Brush",
  "BrushOff",
  "Palette",
  "Paint",
  "ColorSwatch",
  "Ruler",
  "Scissors",
  "Paperclip",
  "Pin",
  "Pinned",
  // Security
  "Key",
  "Lock",
  "LockOpen",
  "LockSquare",
  "Shield",
  "ShieldCheck",
  "Eye",
  "EyeOff",
  "Fingerprint",
  // Locations
  "World",
  "MapPin",
  "Map2",
  "Navigation",
  "Compass",
  "Location",
  "Route",
  // Vehicles
  "Car",
  "Truck",
  "Bike",
  "Plane",
  "Ambulance",
  "Package",
  "Packages",
  "Box",
  // Devices
  "DeviceDesktop",
  "DeviceMobile",
  "DeviceLaptop",
  "DeviceTablet",
  "DeviceTv",
  "Keyboard",
  "Mouse",
  "Headphones",
  "Camera",
  "Photo",
  "Video",
  "Music",
  "Volume",
  "Microphone",
  "Printer",
  "Cpu",
  "Database",
  "Server",
  "Code",
  "Terminal2",
  "Robot",
  "Qrcode",
  "Barcode",
  "Scan",
  "Wifi",
  "WifiOff",
  "Bluetooth",
  "Battery",
  "Battery1",
  "Battery2",
  "Battery3",
  "Battery4",
  // Highlights
  "Bolt",
  "BoltOff",
  "Star",
  "Heart",
  "Heartbeat",
  "HeartHandshake",
  "Flag",
  "Flame",
  "Rocket",
  "Trophy",
  "Award",
  "Crown",
  "Gift",
  "Balloon",
  "Cake",
  "Confetti",
  "Sparkles",
  "Wand",
  "Bulb",
  // Shapes
  "Circle",
  "Square",
  "Triangle",
  "Hexagon",
  "Diamond",
  "Shape",
  // Weather
  "Cloud",
  "Sun",
  "Moon",
  "CloudRain",
  "CloudFog",
  "Snowflake",
  "Umbrella",
  "Wind",
  "Rainbow",
  "Sunrise",
  "Sunset",
  // Nature
  "Leaf",
  "Tree",
  "Flower",
  "Clover",
  "Cactus",
  "Mushroom",
  "Plant",
  "Paw",
  "Fish",
  "Cat",
  "Dog",
  "Horse",
  "Bug",
  "Butterfly",
  // Health
  "Stethoscope",
  "FirstAidKit",
  "Pill",
  "Vaccine",
  // Food
  "Coffee",
  "Beer",
  "Pizza",
  "Cookie",
  "Carrot",
  "Apple",
  "Bread",
  "Cheese",
  "Grain",
  // UI
  "Search",
  "Filter",
  "SortAscending",
  "SortDescending",
  "LayoutGrid",
  "LayoutList",
  "LayoutDashboard",
  "List",
  "Columns",
  "TableImport",
  "TableExport",
  // Actions
  "Upload",
  "Download",
  "CloudUpload",
  "CloudDownload",
  "Link",
  "Unlink",
  "ExternalLink",
  "Copy",
  "Cut",
  "Recycle",
  "RecycleOff",
  "Trash",
  "Plus",
  "Minus",
  "Edit",
  "Pencil",
  "Highlight",
  "Ballpen",
  "Eraser",
  "Backpack",
  // Misc
  "Flask",
  "Atom",
  "Microscope",
  "Swords",
  "FireHydrant",
  "Tie",
  "Shirt",
] as const;

const BORDER_COLOR_TUPLE = ["none", ...ACCENT_COLOR_TUPLE] as const;

const BORDER_THICKNESS_TUPLE = ["none", "thin", "medium", "thick"] as const;

const ACCENT_SHADE_TUPLE = [
  "50",
  "100",
  "200",
  "300",
  "400",
  "500",
  "600",
  "700",
  "800",
  "900",
  "950",
] as const;

/**
 * Build the accent sub-schema for a widget config. Each widget can pass its
 * own semantic defaults (e.g., favorites = yellow + Star, time-entries =
 * teal + Clock).
 */
export function makeAccentSchema(defaults: {
  color: WidgetAccentColor;
  icon: WidgetAccentIcon;
  borderColor?: WidgetBorderColor;
  borderThickness?: WidgetBorderThickness;
}) {
  const fallback = {
    color: defaults.color,
    icon: defaults.icon,
  };
  return z
    .object({
      color: z.enum(ACCENT_COLOR_TUPLE).default(defaults.color),
      icon: z.enum(ACCENT_ICON_TUPLE).default(defaults.icon),
      // `borderColor`/`borderThickness` are vestigial — kept as `.optional()`
      // so stored configs that include them still parse, but no widget UI
      // surfaces them anymore (the card border auto-derives from the accent
      // color/shade in `widget-card.tsx`). Default configs no longer need to
      // set them.
      borderColor: z.enum(BORDER_COLOR_TUPLE).optional(),
      borderThickness: z.enum(BORDER_THICKNESS_TUPLE).optional(),
      // `shade` lets each widget instance pick a Tailwind shade (e.g.
      // "red-500" → "red-800"). Optional so legacy configs default to "500"
      // via `resolveAccent` / `resolveAccentClasses` runtime fallback.
      shade: z.enum(ACCENT_SHADE_TUPLE).optional(),
    })
    .default(fallback);
}

export interface ResolvedAccent {
  color: WidgetAccentColor;
  shade: WidgetAccentShade;
  icon: WidgetAccentIcon;
  classes: AccentColorClasses;
  Icon: ComponentType<{ className?: string; size?: number }>;
}

export function resolveAccent(input?: {
  color?: WidgetAccentColor | null;
  shade?: WidgetAccentShade | null;
  icon?: WidgetAccentIcon | null;
}): ResolvedAccent {
  const color = (input?.color ?? "gray") as WidgetAccentColor;
  const shade = (input?.shade ?? DEFAULT_WIDGET_ACCENT_SHADE) as WidgetAccentShade;
  const icon = (input?.icon ?? "ClipboardText") as WidgetAccentIcon;
  return {
    color,
    shade,
    icon,
    // Per-shade lookup; falls back to the legacy fixed-shade table if the
    // (color, shade) pair somehow isn't in the generated literal table.
    classes:
      resolveAccentClasses(color as PaletteColor, shade) ??
      ACCENT_COLOR_CLASSES[color] ??
      ACCENT_COLOR_CLASSES.gray,
    Icon: ACCENT_ICON_COMPONENTS[icon] ?? ACCENT_ICON_COMPONENTS.ClipboardText,
  };
}

/** Render the accent icon with the matching color class applied. */
export function AccentIconNode({
  accent,
  className,
}: {
  accent: ResolvedAccent;
  className?: string;
}): ReactNode {
  const Cmp = accent.Icon;
  return <Cmp className={`${className ?? "h-4 w-4"} ${accent.classes.icon}`} />;
}

// ============================================================
// AccentPicker — two summary cards (color + icon) plus modal dialogs.
// The widget's visual differentiation now comes from the title text color,
// the header icon color, and a colored top stripe drawn by `widget-card`
// based on the same accent color. Border thickness and border color are no
// longer surfaced in the UI but stay in `makeAccentSchema` as optional
// fields for backward compatibility with stored configs.
// ============================================================

interface AccentPickerProps {
  value: {
    color: WidgetAccentColor;
    icon: WidgetAccentIcon;
    shade?: WidgetAccentShade;
  };
  onChange: (next: {
    color: WidgetAccentColor;
    icon: WidgetAccentIcon;
    shade: WidgetAccentShade;
  }) => void;
}

export function AccentPicker({ value, onChange }: AccentPickerProps) {
  const [colorOpen, setColorOpen] = useState(false);
  const [iconOpen, setIconOpen] = useState(false);

  const shade: WidgetAccentShade = value.shade ?? DEFAULT_WIDGET_ACCENT_SHADE;
  const accent = resolveAccent({ ...value, shade });
  const Icon = accent.Icon;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {/* Color card */}
        <button
          type="button"
          onClick={() => setColorOpen(true)}
          className="flex items-center gap-3 rounded-md border border-border bg-card hover:bg-accent/30 hover:border-primary/40 transition-colors px-3 py-2.5 text-left min-w-0"
        >
          <span
            className={`h-6 w-6 rounded-md shrink-0 ${accent.classes.dot} ring-2 ring-border`}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Cor
            </div>
            <div className={`text-sm font-medium truncate ${accent.classes.text}`}>
              {ACCENT_COLOR_LABELS[value.color]}
              <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                · {shade}
              </span>
            </div>
          </div>
        </button>

        {/* Icon card */}
        <button
          type="button"
          onClick={() => setIconOpen(true)}
          className="flex items-center gap-3 rounded-md border border-border bg-card hover:bg-accent/30 hover:border-primary/40 transition-colors px-3 py-2.5 text-left min-w-0"
        >
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${accent.classes.icon}`}
          >
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Ícone
            </div>
            <div className="text-sm font-medium truncate">
              {ACCENT_ICON_LABELS[value.icon]}
            </div>
          </div>
        </button>
      </div>

      <AccentColorDialog
        open={colorOpen}
        onClose={() => setColorOpen(false)}
        value={value.color}
        shade={shade}
        onSelect={(color, nextShade) =>
          // Explicit fields — never spread. Color/icon/shade ALL come from
          // unambiguous sources so a stale closure or missing field can't
          // drop one of them.
          onChange({ color, icon: value.icon, shade: nextShade })
        }
      />
      <AccentIconDialog
        open={iconOpen}
        onClose={() => setIconOpen(false)}
        value={value.icon}
        accentColor={value.color}
        onSelect={(icon) =>
          // Explicit fields — never spread. Color is always carried over
          // from `value.color` so picking an icon never resets the color.
          onChange({ color: value.color, icon, shade })
        }
      />
    </>
  );
}

// ============================================================
// ColorPaletteDialog — Tailwind-style palette grid (rows = colors,
// columns = shades). Reusable for any palette: pass the list of color names
// and (optionally) the list of shades to render.
// ============================================================
//
// Token format: "<color>-<shade>" e.g. "emerald-500". The dialog stores no
// shade state of its own; the caller provides the current selection and
// receives a new token on click.

/** Capitalise the first letter — used as a fallback label when no
 * `paletteLabels` map covers a color. */
function defaultColorLabel(color: string): string {
  return color.charAt(0).toUpperCase() + color.slice(1);
}

/** Parse a "color-shade" token back into its parts. Tolerates missing
 * shade — falls back to the default 500. */
export function parseColorToken(
  token: string | null | undefined,
): { color: string; shade: WidgetAccentShade } {
  if (!token) return { color: "gray", shade: DEFAULT_WIDGET_ACCENT_SHADE };
  const last = token.lastIndexOf("-");
  if (last < 0) return { color: token, shade: DEFAULT_WIDGET_ACCENT_SHADE };
  const color = token.slice(0, last);
  const shade = token.slice(last + 1) as WidgetAccentShade;
  if (!ACCENT_SHADE_TUPLE.includes(shade)) {
    return { color, shade: DEFAULT_WIDGET_ACCENT_SHADE };
  }
  return { color, shade };
}

export function formatColorToken(color: string, shade: WidgetAccentShade): string {
  return `${color}-${shade}`;
}

export interface ColorPaletteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Currently selected token, e.g. "emerald-500". When `null`, no swatch
   * shows the active ring. */
  value: string | null;
  /** Called with the new token, e.g. "rose-700". */
  onSelect: (token: string) => void;
  /** Color rows to render, top to bottom. The dialog filters this list to
   * only render colors in `DISPLAYED_PALETTE_COLORS` (neutrals are hidden
   * from the picker but remain valid in the underlying class table). Pass
   * `ACCENT_COLOR_VALUES` here and the dialog handles the trimming. */
  palette: readonly string[];
  /** Optional override of which shades to render across each row. Defaults
   * to `DISPLAYED_SHADES` (the 400–900 subset). The underlying class table
   * still has all 11 shades for runtime resolution. */
  shades?: readonly WidgetAccentShade[];
  /** Optional Portuguese labels for the row name. Falls back to a
   * Title-cased color slug if missing. */
  paletteLabels?: Record<string, string>;
  /** Dialog title shown in the header. */
  title: string;
  /** Optional helper text under the title. */
  description?: string;
}

/**
 * Tailwind-style color picker. Renders one row per color with a horizontal
 * strip of shade swatches. Active swatch gets a primary ring + check mark.
 *
 * Display rules:
 * - Only colors in `DISPLAYED_PALETTE_COLORS` are rendered (neutrals and
 *   close-relative families hidden).
 * - Only `DISPLAYED_SHADES` columns are rendered (50–300 and 950 hidden).
 * - Shade headers show the literal Tailwind shade (e.g., "500"). Tokens
 *   stored/emitted use the same Tailwind shade.
 * - Swatches never scale on hover or selection. Hover adds a subtle ring;
 *   the active swatch gets a primary ring plus a check icon.
 * - No hover tooltip is rendered; `aria-label` carries the swatch identity
 *   for screen readers.
 */
export function ColorPaletteDialog({
  open,
  onOpenChange,
  value,
  onSelect,
  palette,
  shades = DISPLAYED_SHADES,
  paletteLabels,
  title,
  description,
}: ColorPaletteDialogProps) {
  const selected = value ? parseColorToken(value) : null;
  // Trim the palette to the displayed subset. Anything not in the allowlist
  // is dropped at render time only — runtime resolution still accepts it.
  const visiblePalette = palette.filter((c) =>
    (DISPLAYED_PALETTE_COLORS as readonly string[]).includes(c),
  );
  // Inline style: `grid-template-columns: 90px repeat(N, minmax(0, 1fr))`.
  // Tailwind would also accept this as an arbitrary class but inlining keeps
  // it dynamic-shade-count safe (the consumer can pass any shades subset).
  const gridStyle: CSSProperties = {
    gridTemplateColumns: `90px repeat(${shades.length}, minmax(0, 1fr))`,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[720px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconPaletteHeader className="h-4 w-4" />
            {title}
          </DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] pr-2">
          {/* Column-header row: shade numbers above each swatch column.
           * The first cell is empty (it sits above the row labels). */}
          <div className="grid items-center gap-1.5 mb-1.5" style={gridStyle}>
            <div />
            {shades.map((shade) => (
              <div
                key={shade}
                className="text-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground select-none"
              >
                {shade}
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            {visiblePalette.map((color) => {
              const label = paletteLabels?.[color] ?? defaultColorLabel(color);
              return (
                <div
                  key={color}
                  className="grid items-center gap-1.5"
                  style={gridStyle}
                >
                  <div className="text-sm font-medium text-foreground truncate pr-2">
                    {label}
                  </div>
                  {shades.map((shade) => {
                    const classes = resolveAccentClasses(
                      color as PaletteColor,
                      shade,
                    );
                    const token = formatColorToken(color, shade);
                    const ariaLabel = `${label} ${shade}`;
                    const active =
                      selected !== null &&
                      selected.color === color &&
                      selected.shade === shade;
                    return (
                      <button
                        key={shade}
                        type="button"
                        onClick={() => {
                          onSelect(token);
                          onOpenChange(false);
                        }}
                        aria-label={ariaLabel}
                        className={`relative h-8 w-full rounded-sm transition-shadow ${classes.dot} ${
                          active
                            ? "ring-2 ring-primary ring-offset-2 ring-offset-card z-10"
                            : "ring-1 ring-border hover:ring-2 hover:ring-foreground/40 hover:z-10"
                        }`}
                      >
                        {active ? (
                          <IconCheck className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ----- Color dialog (widget-accent palette wrapper) -----

function AccentColorDialog({
  open,
  onClose,
  value,
  shade,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  value: WidgetAccentColor;
  shade: WidgetAccentShade;
  onSelect: (color: WidgetAccentColor, shade: WidgetAccentShade) => void;
}) {
  const token = formatColorToken(value, shade);
  return (
    <ColorPaletteDialog
      open={open}
      onOpenChange={(o) => (!o ? onClose() : undefined)}
      value={token}
      onSelect={(next) => {
        const parsed = parseColorToken(next);
        onSelect(parsed.color as WidgetAccentColor, parsed.shade);
      }}
      palette={ACCENT_COLOR_VALUES}
      paletteLabels={ACCENT_COLOR_LABELS}
      title="Selecione uma cor"
      description="A cor é aplicada ao título do widget, ao ícone do cabeçalho e ao indicador colorido em cada linha. Cada coluna abaixo é um tom mais claro (400) a mais escuro (900)."
    />
  );
}

// ----- Icon dialog -----

function AccentIconDialog({
  open,
  onClose,
  value,
  accentColor,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  value: WidgetAccentIcon;
  accentColor: WidgetAccentColor;
  onSelect: (icon: WidgetAccentIcon) => void;
}) {
  const [search, setSearch] = useState("");
  const accentClasses = ACCENT_COLOR_CLASSES[accentColor];

  const query = search.trim().toLowerCase();
  const matches = (iconKey: WidgetAccentIcon) => {
    if (!query) return true;
    return (
      iconKey.toLowerCase().includes(query) ||
      ACCENT_ICON_LABELS[iconKey].toLowerCase().includes(query)
    );
  };

  // For each group, keep only icons that match the current search.
  const visibleGroups = ACCENT_ICON_GROUP_VALUES.map((group) => ({
    group,
    icons: ACCENT_ICON_GROUPS[group].filter(matches),
  })).filter(({ icons }) => icons.length > 0);

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : undefined)}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Selecione um ícone</DialogTitle>
          <DialogDescription>
            O ícone aparece no cabeçalho do widget, com a cor de destaque escolhida.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(v) => setSearch(typeof v === "string" ? v : "")}
              placeholder="Buscar ícone..."
              className="pl-9"
              autoFocus
            />
          </div>
          <ScrollArea className="h-[420px] rounded-md border border-border p-3">
            {visibleGroups.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-12">
                Nenhum ícone encontrado.
              </div>
            ) : (
              <div className="space-y-4">
                {visibleGroups.map(({ group, icons }) => (
                  <div key={group}>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                      {ACCENT_ICON_GROUP_LABELS[group]}
                    </div>
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                      {icons.map((iconKey) => {
                        const Cmp = ACCENT_ICON_COMPONENTS[iconKey];
                        const active = iconKey === value;
                        return (
                          <button
                            key={iconKey}
                            type="button"
                            onClick={() => {
                              onSelect(iconKey);
                              onClose();
                            }}
                            className={`relative flex flex-col items-center gap-1 rounded-md border-[1.5px] px-2 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                              active
                                ? `border-primary ring-2 ring-primary/30 bg-primary/5 ${accentClasses.icon}`
                                : "border-border text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-accent/40"
                            }`}
                            title={ACCENT_ICON_LABELS[iconKey]}
                          >
                            {active && (
                              <span className="absolute right-0.5 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                <IconCheck className="h-2.5 w-2.5" strokeWidth={3} />
                              </span>
                            )}
                            <Cmp className="h-5 w-5" />
                            <span className="text-[10px] truncate w-full text-center">
                              {ACCENT_ICON_LABELS[iconKey]}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
