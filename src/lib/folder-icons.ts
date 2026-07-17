import {
  Folder as FolderIcon,
  Home,
  Briefcase,
  ShoppingCart,
  Heart,
  Star,
  Flower2,
  User,
  BookOpen,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  folder: FolderIcon,
  home: Home,
  briefcase: Briefcase,
  cart: ShoppingCart,
  heart: Heart,
  star: Star,
  flower: Flower2,
  user: User,
  book: BookOpen,
  wrench: Wrench,
};

/** Returns the icon component for a stored key, defaulting to a plain folder. */
export function resolveFolderIcon(icon: string | null | undefined): LucideIcon {
  if (!icon) return FolderIcon;
  return MAP[icon] ?? FolderIcon;
}
