import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  IconCheck,
  IconX,
  IconUser,
  IconMail,
  IconPhone,
  IconMessage,
  IconBell,
  IconAlertCircle,
  IconAlertTriangle,
  IconInfoCircle,
  IconStar,
  IconHeart,
  IconThumbUp,
  IconThumbDown,
  IconEye,
  IconEyeOff,
  IconLock,
  IconLockOpen,
  IconKey,
  IconShield,
  IconShieldCheck,
  IconHome,
  IconBuilding,
  IconMapPin,
  IconMap,
  IconClock,
  IconCalendar,
  IconCalendarEvent,
  IconBriefcase,
  IconFile,
  IconFileText,
  IconFolder,
  IconDownload,
  IconUpload,
  IconTrash,
  IconEdit,
  IconPlus,
  IconMinus,
  IconSearch,
  IconFilter,
  IconSettings,
  IconTool,
  IconPencil,
  IconPaint,
  IconPhoto,
  IconCamera,
  IconVideo,
  IconMusic,
  IconHeadphones,
  IconMicrophone,
  IconVolume,
  IconVolumeOff,
  IconShare,
  IconLink,
  IconExternalLink,
  IconCopy,
  IconClipboard,
  IconPrinter,
  IconDeviceFloppy,
  IconRefresh,
  IconReload,
  IconArrowLeft,
  IconArrowRight,
  IconArrowUp,
  IconArrowDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronUp,
  IconChevronDown,
  IconCircleCheck,
  IconCircleX,
  IconCirclePlus,
  IconCircleMinus,
  IconSquareCheck,
  IconSquareX,
  IconShoppingCart,
  IconCreditCard,
  IconCoin,
  IconCurrencyDollar,
  IconGift,
  IconTag,
  IconTags,
  IconBarcode,
  IconQrcode,
  IconWifi,
  IconWifiOff,
  IconBluetooth,
  IconUsb,
  IconBattery,
  IconBatteryCharging,
  IconPlug,
  IconPower,
  IconPackage,
  IconBox,
  IconInbox,
  IconSend,
  IconMoodSmile,
  IconMoodHappy,
  IconMoodSad,
  IconUsers,
  IconUserPlus,
  IconUserMinus,
  IconUserCheck,
  IconUserX,
  IconWorld,
  IconGlobe,
  IconLanguage,
  IconFlag,
  IconBookmark,
  IconBook,
  IconNotebook,
  IconNews,
  IconAward,
  IconMedal,
  IconTrophy,
  IconTarget,
  IconRocket,
  IconBulb,
  IconFlame,
  IconSun,
  IconMoon,
  IconCloud,
  IconCloudRain,
  IconCloudSnow,
  IconUmbrella,
  IconTemperature,
  IconWind,
  IconDroplet,
  IconLeaf,
  IconTree,
  IconPlant,
  IconFlower,
  IconPaw,
  IconBone,
  IconBug,
  IconButterfly,
  IconFish,
  IconApple,
  IconLemon,
  IconCoffee,
  IconCup,
  IconBeer,
  IconPizza,
  IconIceCream,
  IconCake,
  IconCrown,
  IconDiamond,
} from "@tabler/icons-react";

// Map of icon names to components
export const AVAILABLE_ICONS = {
  // Status & Actions
  IconCheck,
  IconX,
  IconCircleCheck,
  IconCircleX,
  IconSquareCheck,
  IconSquareX,
  IconAlertCircle,
  IconAlertTriangle,
  IconInfoCircle,

  // Users & People
  IconUser,
  IconUsers,
  IconUserPlus,
  IconUserMinus,
  IconUserCheck,
  IconUserX,

  // Communication
  IconMail,
  IconPhone,
  IconMessage,
  IconBell,
  IconSend,

  // Emotions
  IconHeart,
  IconStar,
  IconThumbUp,
  IconThumbDown,
  IconMoodSmile,
  IconMoodHappy,
  IconMoodSad,

  // Security
  IconLock,
  IconLockOpen,
  IconKey,
  IconShield,
  IconShieldCheck,
  IconEye,
  IconEyeOff,

  // Navigation
  IconHome,
  IconBuilding,
  IconMapPin,
  IconMap,
  IconWorld,
  IconGlobe,

  // Time
  IconClock,
  IconCalendar,
  IconCalendarEvent,

  // Files & Folders
  IconFile,
  IconFileText,
  IconFolder,
  IconDownload,
  IconUpload,
  IconBriefcase,

  // Actions
  IconTrash,
  IconEdit,
  IconPlus,
  IconMinus,
  IconCirclePlus,
  IconCircleMinus,
  IconSearch,
  IconFilter,
  IconCopy,
  IconClipboard,

  // Settings & Tools
  IconSettings,
  IconTool,

  // Media
  IconPhoto,
  IconCamera,
  IconVideo,
  IconMusic,
  IconHeadphones,
  IconMicrophone,
  IconVolume,
  IconVolumeOff,
  IconPencil,
  IconPaint,

  // Sharing & Links
  IconShare,
  IconLink,
  IconExternalLink,
  IconPrinter,
  IconDeviceFloppy,
  IconRefresh,
  IconReload,

  // Arrows
  IconArrowLeft,
  IconArrowRight,
  IconArrowUp,
  IconArrowDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronUp,
  IconChevronDown,

  // E-commerce
  IconShoppingCart,
  IconCreditCard,
  IconCoin,
  IconCurrencyDollar,
  IconGift,
  IconTag,
  IconTags,
  IconBarcode,
  IconQrcode,

  // Technology
  IconWifi,
  IconWifiOff,
  IconBluetooth,
  IconUsb,
  IconBattery,
  IconBatteryCharging,
  IconPlug,
  IconPower,

  // Packages
  IconPackage,
  IconBox,
  IconInbox,

  // Content
  IconBookmark,
  IconBook,
  IconNotebook,
  IconNews,
  IconLanguage,
  IconFlag,

  // Achievements
  IconAward,
  IconMedal,
  IconTrophy,
  IconTarget,
  IconCrown,

  // Misc
  IconRocket,
  IconBulb,
  IconFlame,
  IconDiamond,

  // Weather & Nature
  IconSun,
  IconMoon,
  IconCloud,
  IconCloudRain,
  IconCloudSnow,
  IconUmbrella,
  IconTemperature,
  IconWind,
  IconDroplet,
  IconLeaf,
  IconTree,
  IconPlant,
  IconFlower,

  // Animals & Food
  IconPaw,
  IconBone,
  IconBug,
  IconButterfly,
  IconFish,
  IconApple,
  IconLemon,
  IconCoffee,
  IconCup,
  IconBeer,
  IconPizza,
  IconIceCream,
  IconCake,
};

interface IconPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (iconName: string) => void;
  selectedIcon?: string;
}

export const IconPicker = ({ open, onClose, onSelect, selectedIcon }: IconPickerProps) => {
  const [search, setSearch] = useState("");

  const filteredIcons = useMemo(() => {
    if (!search) return Object.keys(AVAILABLE_ICONS);

    const searchLower = search.toLowerCase();
    return Object.keys(AVAILABLE_ICONS).filter((name) =>
      name.toLowerCase().includes(searchLower)
    );
  }, [search]);

  const handleSelect = (iconName: string) => {
    onSelect(iconName);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Selecione um Ícone</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Input
            placeholder="Buscar ícone... (ex: user, mail, check)"
            value={search}
            onChange={(value) => setSearch(value as string)}
            autoFocus
          />

          <ScrollArea className="h-[400px] w-full rounded-md border dark:border-muted p-4">
            <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2">
              {filteredIcons.map((iconName) => {
                const IconComponent = AVAILABLE_ICONS[iconName as keyof typeof AVAILABLE_ICONS];
                const isSelected = iconName === selectedIcon;

                return (
                  <Button
                    key={iconName}
                    variant={isSelected ? "default" : "outline"}
                    className="h-12 w-12 p-2"
                    onClick={() => handleSelect(iconName)}
                    title={iconName}
                  >
                    <IconComponent className="h-6 w-6" />
                  </Button>
                );
              })}
            </div>

            {filteredIcons.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                Nenhum ícone encontrado
              </div>
            )}
          </ScrollArea>

          <p className="text-xs text-muted-foreground">
            {filteredIcons.length} {filteredIcons.length === 1 ? 'ícone disponível' : 'ícones disponíveis'}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
