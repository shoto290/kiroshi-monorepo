import {
	ArrowDownIcon,
	ArrowRightIcon,
	ArrowUpIcon,
	BanIcon,
	BellIcon,
	BookmarkIcon,
	BookOpenTextIcon,
	BracesIcon,
	BrainIcon,
	CalendarIcon,
	CheckIcon,
	ChevronDownIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	CircleCheckIcon,
	CircleIcon,
	CircleXIcon,
	CopyIcon,
	CrownIcon,
	EllipsisIcon,
	ExternalLinkIcon,
	EyeIcon,
	EyeOffIcon,
	FileCodeIcon,
	FileTextIcon,
	FolderIcon,
	FolderOpenIcon,
	Globe2Icon,
	HistoryIcon,
	HouseIcon,
	ImageIcon,
	InfoIcon,
	LanguagesIcon,
	LayersIcon,
	LoaderCircleIcon,
	type LucideIcon,
	type LucideProps,
	MessageSquareIcon,
	MonitorIcon,
	MoonIcon,
	PanelLeftIcon,
	PanelRightIcon,
	PencilIcon,
	PencilLineIcon,
	PinIcon,
	PinOffIcon,
	PlusIcon,
	RefreshCwIcon,
	RepeatIcon,
	ReplyIcon,
	RotateCwIcon,
	SearchIcon,
	ServerIcon,
	SettingsIcon,
	ShieldIcon,
	SparklesIcon,
	SquareIcon,
	SquareTerminalIcon,
	SunIcon,
	TerminalIcon,
	ThumbsDownIcon,
	ThumbsUpIcon,
	Trash2Icon,
	TriangleAlertIcon,
	UserRoundIcon,
	WrenchIcon,
	XIcon,
} from "lucide-react"

type IconProps = LucideProps

type Icon = LucideIcon

const Claude = ({ size = 24, strokeWidth = 2, ...props }: IconProps) => (
	<svg
		aria-hidden="true"
		fill="none"
		height={size}
		stroke="currentColor"
		strokeLinecap="round"
		strokeLinejoin="round"
		strokeWidth={strokeWidth}
		viewBox="0 0 24 24"
		width={size}
		xmlns="http://www.w3.org/2000/svg"
		{...props}
	>
		<path d="M13 12L18.5 5M7.63965 3L12.5 12L13.6865 3M4.48381 6.71679L11.9872 12M3 12L11.9872 12.473M12.2244 13.177L7 20M4.84194 16.8682L11.2824 12.9758M11.5 21L12.665 13.177M21 14L13.1846 12.668M21 10.5788L13 12.3223M16.779 19.646L12.8876 13.3772M19.3566 18.207L13.313 12.9893" />
	</svg>
)

const GitHub = ({ size = 24, ...props }: IconProps) => (
	<svg
		aria-hidden="true"
		fill="currentColor"
		height={size}
		viewBox="0 0 16 16"
		width={size}
		xmlns="http://www.w3.org/2000/svg"
		{...props}
	>
		<path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A7.995 7.995 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
	</svg>
)

const Linear = ({ size = 24, ...props }: IconProps) => (
	<svg
		aria-hidden="true"
		fill="currentColor"
		height={size}
		viewBox="0 0 100 100"
		width={size}
		xmlns="http://www.w3.org/2000/svg"
		{...props}
	>
		<path d="M1.22541 61.5228c-.2-.9086.87652-1.5125 1.53266-.8563l36.5471 36.5471c.6562.6562.0523 1.7327-.8563 1.5327-9.5313-2.098-18.4276-6.6428-25.7566-13.9718-7.32893-7.3289-11.87373-16.2252-13.9718-25.7567zM.00189135 46.8891c-.01764375.2833.08887215.5599.28957165.7606l52.0501 52.0501c.2007.2007.4773.3072.7606.2896 2.3692-.1476 4.6938-.46 6.9624-.9259.7645-.157 1.0301-1.0963.4782-1.6481L2.57343 39.4485c-.55184-.5518-1.49109-.2863-1.648174.4782-.465915 2.2686-.77835 4.5932-.92598465 6.9624zM4.21093 29.7054c-.16649.3738-.08169.8106.20765 1.1l64.77602 64.776c.2894.2894.7262.3742 1.1.2077 1.7861-.7956 3.5171-1.6927 5.1855-2.684.5521-.328.6373-1.0867.1832-1.5407L8.43566 24.3865c-.45409-.4541-1.21271-.3689-1.54074.1832-.99132 1.6684-1.88843 3.3994-2.68399 5.1857zM12.6587 18.074c-.3701-.3701-.393-.9637-.0443-1.3541C21.7795 6.45931 35.1114 0 49.9519 0 77.5927 0 100 22.4073 100 50.0481c0 14.8405-6.4593 28.1724-16.7199 37.3375-.3903.3487-.984.3258-1.354-.0443L12.6587 18.074z" />
	</svg>
)

const Paper = ({ size = 24, ...props }: IconProps) => (
	<svg
		aria-hidden="true"
		fill="currentColor"
		height={size}
		viewBox="0 0 78 78"
		width={size}
		xmlns="http://www.w3.org/2000/svg"
		{...props}
	>
		<path d="M12 0h66v12H12zM0 12h12v36H0zM48 12h30v36H48zM0 48h48v30H0z" />
	</svg>
)

const Superset = ({ size = 24, strokeWidth = 1.5, ...props }: IconProps) => (
	<svg
		aria-hidden="true"
		fill="none"
		height={size}
		stroke="currentColor"
		strokeLinecap="butt"
		strokeLinejoin="miter"
		strokeWidth={strokeWidth}
		viewBox="0 0 24 24"
		width={size}
		xmlns="http://www.w3.org/2000/svg"
		{...props}
	>
		<path d="M5.25 6H3.75V10H1.5V14H3.75V18H5.25M11.25 6H9.75V10H7.5V14H9.75V18H11.25M12.75 6H14.25V10H16.5V14H14.25V18H12.75M18.75 6H20.25V10H22.5V14H20.25V18H18.75" />
	</svg>
)

const Icons = {
	Add: PlusIcon,
	Alert: TriangleAlertIcon,
	ArrowDown: ArrowDownIcon,
	ArrowRight: ArrowRightIcon,
	ArrowUp: ArrowUpIcon,
	Bell: BellIcon,
	Blocked: BanIcon,
	Bookmark: BookmarkIcon,
	Calendar: CalendarIcon,
	Check: CheckIcon,
	Claude,
	Close: XIcon,
	Command: SquareTerminalIcon,
	Conceal: EyeOffIcon,
	Copy: CopyIcon,
	Crown: CrownIcon,
	DarkScheme: MoonIcon,
	Delete: Trash2Icon,
	Docs: BookOpenTextIcon,
	Edit: PencilIcon,
	Error: CircleXIcon,
	Expand: ChevronDownIcon,
	ExternalLink: ExternalLinkIcon,
	File: FileTextIcon,
	FileCode: FileCodeIcon,
	Folder: FolderIcon,
	FolderOpen: FolderOpenIcon,
	GitHub,
	History: HistoryIcon,
	Home: HouseIcon,
	Image: ImageIcon,
	Info: InfoIcon,
	Json: BracesIcon,
	Language: LanguagesIcon,
	LightScheme: SunIcon,
	Linear,
	Loading: LoaderCircleIcon,
	Message: MessageSquareIcon,
	More: EllipsisIcon,
	Next: ChevronRightIcon,
	Paper,
	Pending: CircleIcon,
	Pin: PinIcon,
	Unpin: PinOffIcon,
	Reply: ReplyIcon,
	Previous: ChevronLeftIcon,
	Restart: RotateCwIcon,
	Routine: RepeatIcon,
	Reveal: EyeIcon,
	Retry: RefreshCwIcon,
	Search: SearchIcon,
	Send: ArrowUpIcon,
	Server: ServerIcon,
	Settings: SettingsIcon,
	Shield: ShieldIcon,
	Sidebar: PanelLeftIcon,
	SidePanel: PanelRightIcon,
	Skill: SparklesIcon,
	Spaces: LayersIcon,
	Stop: SquareIcon,
	Success: CircleCheckIcon,
	Superset,
	SystemScheme: MonitorIcon,
	Terminal: TerminalIcon,
	Thinking: BrainIcon,
	ThumbsDown: ThumbsDownIcon,
	ThumbsUp: ThumbsUpIcon,
	Tool: WrenchIcon,
	User: UserRoundIcon,
	Web: Globe2Icon,
	Write: PencilLineIcon,
}

export { type Icon, type IconProps, Icons }
