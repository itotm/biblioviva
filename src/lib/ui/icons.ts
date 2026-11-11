// SPDX-License-Identifier: GPL-3.0-or-later
// One icon per concept (PLAN.md §3.18). Import icons only from here so the whole app stays
// consistent; each entry is a per-icon Lucide import, so only used icons are bundled.
import type { Component } from "svelte";
import Accessibility from "@lucide/svelte/icons/accessibility";
import AlarmClock from "@lucide/svelte/icons/alarm-clock";
import Archive from "@lucide/svelte/icons/archive";
import ArchiveRestore from "@lucide/svelte/icons/archive-restore";
import ArrowLeft from "@lucide/svelte/icons/arrow-left";
import ArrowRight from "@lucide/svelte/icons/arrow-right";
import ArrowRightLeft from "@lucide/svelte/icons/arrow-right-left";
import BadgeCheck from "@lucide/svelte/icons/badge-check";
import Ban from "@lucide/svelte/icons/ban";
import Barcode from "@lucide/svelte/icons/barcode";
import Book from "@lucide/svelte/icons/book";
import Braces from "@lucide/svelte/icons/braces";
import FileClock from "@lucide/svelte/icons/file-clock";
import FolderArchive from "@lucide/svelte/icons/folder-archive";
import BookCopy from "@lucide/svelte/icons/book-copy";
import BookDashed from "@lucide/svelte/icons/book-dashed";
import Bookmark from "@lucide/svelte/icons/bookmark";
import CalendarDays from "@lucide/svelte/icons/calendar-days";
import CalendarHeart from "@lucide/svelte/icons/calendar-heart";
import Camera from "@lucide/svelte/icons/camera";
import FileScan from "@lucide/svelte/icons/file-scan";
import CameraOff from "@lucide/svelte/icons/camera-off";
import CircleSlash2 from "@lucide/svelte/icons/circle-slash-2";
import Copy from "@lucide/svelte/icons/copy";
import Crop from "@lucide/svelte/icons/crop";
import Images from "@lucide/svelte/icons/images";
import SquareDashedPlus from "@lucide/svelte/icons/square-dashed-plus";
import CloudCheck from "@lucide/svelte/icons/cloud-check";
import CloudOff from "@lucide/svelte/icons/cloud-off";
import DatabaseBackup from "@lucide/svelte/icons/database-backup";
import Flashlight from "@lucide/svelte/icons/flashlight";
import FlashlightOff from "@lucide/svelte/icons/flashlight-off";
import FlaskConical from "@lucide/svelte/icons/flask-conical";
import SwitchCamera from "@lucide/svelte/icons/switch-camera";
import ChartBar from "@lucide/svelte/icons/chart-bar";
import Check from "@lucide/svelte/icons/check";
import ArrowDown from "@lucide/svelte/icons/arrow-down";
import ArrowUp from "@lucide/svelte/icons/arrow-up";
import ChevronDown from "@lucide/svelte/icons/chevron-down";
import CircleCheck from "@lucide/svelte/icons/circle-check";
import CircleHelp from "@lucide/svelte/icons/circle-help";
import CircleX from "@lucide/svelte/icons/circle-x";
import Clock from "@lucide/svelte/icons/clock";
import Download from "@lucide/svelte/icons/download";
import EllipsisVertical from "@lucide/svelte/icons/ellipsis-vertical";
import EqualApproximately from "@lucide/svelte/icons/equal-approximately";
import Eye from "@lucide/svelte/icons/eye";
import EyeOff from "@lucide/svelte/icons/eye-off";
import FileSpreadsheet from "@lucide/svelte/icons/file-spreadsheet";
import Filter from "@lucide/svelte/icons/filter";
import Globe from "@lucide/svelte/icons/globe";
import GraduationCap from "@lucide/svelte/icons/graduation-cap";
import BookHeart from "@lucide/svelte/icons/book-heart";
import GripVertical from "@lucide/svelte/icons/grip-vertical";
import Hourglass from "@lucide/svelte/icons/hourglass";
import Image from "@lucide/svelte/icons/image";
import ImageOff from "@lucide/svelte/icons/image-off";
import Inbox from "@lucide/svelte/icons/inbox";
import Info from "@lucide/svelte/icons/info";
import LayoutDashboard from "@lucide/svelte/icons/layout-dashboard";
import Library from "@lucide/svelte/icons/library";
import LibraryBig from "@lucide/svelte/icons/library-big";
import ListChecks from "@lucide/svelte/icons/list-checks";
import LoaderCircle from "@lucide/svelte/icons/loader-circle";
import LogOut from "@lucide/svelte/icons/log-out";
import Mail from "@lucide/svelte/icons/mail";
import Menu from "@lucide/svelte/icons/menu";
import Pencil from "@lucide/svelte/icons/pencil";
import Pin from "@lucide/svelte/icons/pin";
import PinOff from "@lucide/svelte/icons/pin-off";
import Plus from "@lucide/svelte/icons/plus";
import Printer from "@lucide/svelte/icons/printer";
import RefreshCw from "@lucide/svelte/icons/refresh-cw";
import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
import RotateCw from "@lucide/svelte/icons/rotate-cw";
import Save from "@lucide/svelte/icons/save";
import School from "@lucide/svelte/icons/school";
import ScanBarcode from "@lucide/svelte/icons/scan-barcode";
import Scan from "@lucide/svelte/icons/scan";
import Search from "@lucide/svelte/icons/search";
import Settings from "@lucide/svelte/icons/settings";
import Shapes from "@lucide/svelte/icons/shapes";
import ShieldCogCorner from "@lucide/svelte/icons/shield-cog-corner";
import SlidersHorizontal from "@lucide/svelte/icons/sliders-horizontal";
import StickyNote from "@lucide/svelte/icons/sticky-note";
import Tag from "@lucide/svelte/icons/tag";
import Trash2 from "@lucide/svelte/icons/trash-2";
import TriangleAlert from "@lucide/svelte/icons/triangle-alert";
import Undo2 from "@lucide/svelte/icons/undo-2";
import Upload from "@lucide/svelte/icons/upload";
import ClipboardCheck from "@lucide/svelte/icons/clipboard-check";
import Smartphone from "@lucide/svelte/icons/smartphone";
import User from "@lucide/svelte/icons/user";
import Users from "@lucide/svelte/icons/users";
import Volume2 from "@lucide/svelte/icons/volume-2";
import Wrench from "@lucide/svelte/icons/wrench";
import X from "@lucide/svelte/icons/x";

export type IconComponent = Component<{
	class?: string;
	size?: number | string;
	"aria-hidden"?: boolean | "true" | "false";
}>;

/** Icon sizes in px (§3.18): 16 inline, 20 in buttons and badges, 24 in navigation and headers. */
export const ICON_SIZE = { sm: 16, md: 20, lg: 24, xl: 28, nav: 40, wait: 56 } as const;

export const icons = {
	// Entities
	patron: User,
	teacher: GraduationCap,
	patrons: Users,
	book: Book,
	copy: BookCopy,
	catalog: LibraryBig,
	series: Library,
	/** the books the library would like to have (9.15) */
	wishlist: BookHeart,
	/** an accessible book: high readability, symbols, audiobook… (9.66) */
	accessible: Accessibility,
	barcode: Barcode,
	card: BadgeCheck,
	/** the school's email address of a patron (9.22) */
	email: Mail,
	classification: Shapes,
	/** A record still to classify (step 9.21). */
	toClassify: BookDashed,
	/** the classes of the school and its structure (Phase 12) */
	classes: School,
	image: Image,
	/** a picture with many photos for the census (Phase 13) */
	classPicture: Images,
	// Actions
	scan: ScanBarcode,
	camera: Camera,
	calendar: CalendarDays,
	/** a notable date of the calendar: a reading, a deadline (9.25) */
	calendarDate: CalendarHeart,
	cameraOff: CameraOff,
	switchCamera: SwitchCamera,
	torch: Flashlight,
	torchOff: FlashlightOff,
	/** the beep of a camera read, played to try it (9.40) */
	sound: Volume2,
	print: Printer,
	label: Tag,
	spine: Bookmark,
	loan: ArrowRightLeft,
	return: RotateCw,
	renew: RefreshCw,
	search: Search,
	/** an approximate search result, found by correcting a typing mistake (9.24) */
	similar: EqualApproximately,
	add: Plus,
	edit: Pencil,
	delete: Trash2,
	/** correct the photo frames of a class picture (Phase 13) */
	frames: Crop,
	/** draw a missing frame */
	addFrame: SquareDashedPlus,
	/** straighten a photographed cover from its four corners */
	straighten: Scan,
	/** a class picture made with a scanner (the photo kind is `camera`) */
	scanned: FileScan,
	/** a frame that is no one's photo ("Ignora") */
	ignore: CircleSlash2,
	upload: Upload,
	/** stocktaking campaigns (9.8) */
	inventory: ClipboardCheck,
	install: Smartphone,
	download: Download,
	backup: DatabaseBackup,
	cloudOk: CloudCheck,
	cloudOff: CloudOff,
	export: FileSpreadsheet,
	filter: Filter,
	view: Eye,
	/** hide what is shown (a password) */
	hide: EyeOff,
	close: X,
	back: ArrowLeft,
	/** the next page (pagination) */
	forward: ArrowRight,
	confirm: Check,
	more: ChevronDown,
	/** the other actions of a page, in its header menu (9.13, round 21) */
	moreActions: EllipsisVertical,
	/** one place up or down in an ordered list (the reading levels, Phase 12.6) */
	moveUp: ArrowUp,
	moveDown: ArrowDown,
	menu: Menu,
	logout: LogOut,
	save: Save,
	/** A new item made from an existing one (a report, step 9.20). */
	duplicate: Copy,
	undo: Undo2,
	/** A card turned from landscape to portrait and back (step 11.17). */
	rotate: RotateCcw,
	drag: GripVertical,
	/** the raw text of a setting or a template (JSON, HTML) */
	code: Braces,
	/** a staff note leaves the open ones ("Archivia", 9.18) */
	archive: FolderArchive,
	/** an archived note back among the open ones ("Ripristina") */
	restore: ArchiveRestore,
	/** a note at the top of the dashboard ("In evidenza") */
	pin: Pin,
	unpin: PinOff,
	// Areas
	dashboard: LayoutDashboard,
	/** the staff notes, "Segnalazioni" (9.18) */
	notes: StickyNote,
	reports: ChartBar,
	/** earlier versions (the configuration's history) */
	history: FileClock,
	settings: Settings,
	config: SlidersHorizontal,
	admin: ShieldCogCorner,
	lists: ListChecks,
	// Status
	available: CircleCheck,
	dueSoon: Clock,
	overdue: AlarmClock,
	inactive: Ban,
	lost: CircleX,
	damaged: TriangleAlert,
	repair: Wrench,
	withdrawn: Archive,
	pending: Hourglass,
	info: Info,
	beta: FlaskConical,
	help: CircleHelp,
	language: Globe,
	empty: Inbox,
	noPhoto: ImageOff,
	loading: LoaderCircle,
} as const satisfies Record<string, IconComponent>;

export type IconName = keyof typeof icons;
