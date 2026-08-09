"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowDown01Icon,
  ArrowLeft02Icon,
  ArrowUpRight01Icon,
  Cancel01Icon,
  Bookmark02Icon,
  Comment01Icon,
  Delete02Icon,
  Edit02Icon,
  Copy01Icon,
  FavouriteIcon,
  Logout03Icon,
  Menu02Icon,
  Moon02Icon,
  MoreHorizontalIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PlusSignIcon,
  Search01Icon,
  Settings02Icon,
  Sun03Icon,
  Tag01Icon,
  UserAdd01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import type { ComponentProps } from "react";

/**
 * Single place the app pulls icons from, so swapping the set later touches one file
 * and every icon shares the same default size and stroke.
 */
type IconProps = Omit<ComponentProps<typeof HugeiconsIcon>, "icon"> & {
  size?: number;
};

const make =
  (icon: Parameters<typeof HugeiconsIcon>[0]["icon"]) =>
  ({ size = 18, strokeWidth = 1.8, ...rest }: IconProps) => (
    <HugeiconsIcon icon={icon} size={size} strokeWidth={strokeWidth} {...rest} />
  );

export const GroupIcon = make(UserGroupIcon);
export const PlusIcon = make(PlusSignIcon);
export const TagIcon = make(Tag01Icon);
export const SignOutIcon = make(Logout03Icon);
export const BackIcon = make(ArrowLeft02Icon);
export const ChevronDownIcon = make(ArrowDown01Icon);
export const ExternalIcon = make(ArrowUpRight01Icon);
export const ClearIcon = make(Cancel01Icon);
export const CommentIcon = make(Comment01Icon);
export const ReactionIcon = make(FavouriteIcon);
export const CopyIcon = make(Copy01Icon);
export const InviteIcon = make(UserAdd01Icon);
export const SettingsIcon = make(Settings02Icon);
export const MoreIcon = make(MoreHorizontalIcon);
export const MenuIcon = make(Menu02Icon);
// Swapped deliberately: hugeicons names these for the panel's state, not the arrow's
// direction, so PanelLeftOpen is the one whose chevron points LEFT — which is the
// direction the rail actually travels when you collapse it.
export const CollapseSidebarIcon = make(PanelLeftOpenIcon);
export const ExpandSidebarIcon = make(PanelLeftCloseIcon);
export const BookmarkIcon = make(Bookmark02Icon);
export const SearchIcon = make(Search01Icon);
export const EditIcon = make(Edit02Icon);
export const DeleteIcon = make(Delete02Icon);
export const SunIcon = make(Sun03Icon);
export const MoonIcon = make(Moon02Icon);
