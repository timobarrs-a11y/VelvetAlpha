import type { ActivityGives } from '../state/activities';

/**
 * The office's stations and the actions each one offers (docs/velvet-house/locations/meridian-tech.md, "How a day plays: discovery").
 * Data only: a new action is one row here. Each becomes an activity (state/activities.ts) with a set time, run through the game's own
 * walk, pose and timer. `secs` is real seconds at the normal speed (a game minute is a second there). Tags are what today's list will
 * match against once it is built; nothing reads them yet.
 */
export type StationId = 'desk' | 'sink' | 'boss' | 'printer' | 'whiteboard' | 'door' | 'filing' | 'cooler' | 'vending' | 'coffee' | 'fridge' | 'plant';

export interface StationInfo {
  title: string;
  /** The spot tag a piece of furniture carries for this station (what the slot search looks for). */
  tag: string;
  /** Pieces that open this station's menu when tapped (the action itself happens at the piece that holds the spot). */
  taps: string[];
  /** Tabs the menu splits its actions into, in order. */
  groups?: string[];
}

export const STATIONS: Record<StationId, StationInfo> = {
  desk: { title: 'At the desk', tag: 'officework', taps: ['officedesk', 'officechair'], groups: ['Computer', 'Phone'] },
  boss: { title: 'Talk to Dale', tag: 'bossvisit', taps: ['bossdesk', 'bosschair', 'visitorchair'] },
  printer: { title: 'Printer', tag: 'o_printer', taps: ['officeprinter'] },
  whiteboard: { title: 'Whiteboard', tag: 'o_board', taps: [] },
  door: { title: 'Meeting room', tag: 'o_door', taps: [] },
  filing: { title: 'Filing cabinet', tag: 'o_files', taps: ['officecabinet'] },
  cooler: { title: 'Water cooler', tag: 'o_cooler', taps: ['officecooler'] },
  vending: { title: 'Vending machine', tag: 'o_vending', taps: ['officevending'] },
  coffee: { title: 'Coffee machine', tag: 'o_coffee', taps: ['officecoffee'] },
  fridge: { title: 'Fridge', tag: 'o_fridge', taps: ['officefridge'] },
  plant: { title: 'Office plant', tag: 'o_plant', taps: ['officeplant'] },
  sink: { title: 'Sink', tag: 'o_sink', taps: ['officecounter'] },
};

export interface OfficeAction {
  /** Becomes the activity id: `o_<id>`. */
  id: string;
  station: StationId;
  group?: string;
  label: string;
  secs: number;
  tags: string[];
  pose: string;
  verb: string;
  gives?: ActivityGives;
  /** Something it leaves behind for later actions (a finished report can be printed, and so on). */
  leaves?: string;
  /** Takes the person out of sight (the meeting room is behind the door and never drawn). */
  unseen?: boolean;
}

const pc = (id: string, label: string, secs: number, tags: string[], verb: string, extra: Partial<OfficeAction> = {}): OfficeAction =>
  ({ id: `pc_${id}`, station: 'desk', group: 'Computer', label, secs, tags, pose: 'desk', verb, ...extra });
const ph = (id: string, label: string, secs: number, tags: string[], verb: string, extra: Partial<OfficeAction> = {}): OfficeAction =>
  ({ id: `call_${id}`, station: 'desk', group: 'Phone', label, secs, tags: ['call', ...tags], pose: 'deskcall', verb, ...extra });

export const OFFICE_ACTIONS: OfficeAction[] = [
  // The computer: twenty tasks. The personal ones (shop, news, game, friend) never count as work.
  pc('email', 'Write an email', 45, ['email', 'write'], 'Writing an email'),
  pc('reply', 'Reply to messages', 30, ['email'], 'Answering messages'),
  pc('slides', 'Craft a PowerPoint', 120, ['slides', 'write'], 'Building a slide deck', { leaves: 'slides' }),
  pc('report', 'Write a report', 120, ['report', 'write'], 'Writing a report', { leaves: 'report' }),
  pc('project', 'Work on a project', 150, ['project'], 'Working on a project'),
  pc('sheet', 'Update the spreadsheet', 60, ['numbers'], 'Updating the spreadsheet'),
  pc('resume', 'Work on your resume', 90, ['resume', 'write'], 'Polishing a resume', { leaves: 'resume' }),
  pc('travel', 'Book travel', 60, ['travel'], 'Booking travel'),
  pc('research', 'Research a competitor', 90, ['research'], 'Researching a competitor', { leaves: 'notes' }),
  pc('contract', 'Review a contract', 90, ['contract'], 'Reviewing a contract', { leaves: 'contract' }),
  pc('expenses', 'File an expense report', 60, ['numbers'], 'Filing expenses'),
  pc('training', 'Do an online training course', 120, ['training'], 'Taking a training course'),
  pc('schedule', 'Schedule a meeting', 30, ['meeting-prep'], 'Scheduling a meeting'),
  pc('bill', 'Pay a bill online', 45, ['home-errand'], 'Paying a bill'),
  pc('shop', 'Shop online', 60, ['personal'], 'Shopping online', { gives: { fun: 8 } }),
  pc('news', 'Read the news', 30, ['personal'], 'Reading the news', { gives: { fun: 4 } }),
  pc('game', 'Play a video game', 90, ['game', 'personal'], 'Playing a video game', { gives: { fun: 18 } }),
  pc('friend', 'Chat with a friend', 45, ['personal', 'social'], 'Chatting with a friend', { gives: { social: 8, fun: 3 } }),
  pc('flyer', 'Design a flyer', 90, ['design', 'write'], 'Designing a flyer', { leaves: 'flyer' }),
  pc('debug', 'Debug a problem', 120, ['project', 'fix'], 'Debugging'),
  // The desk phone: ten calls.
  ph('home', 'Call home', 45, ['call-home'], 'Calling home', { gives: { social: 8 } }),
  ph('client', 'Call a client', 60, ['client'], 'On a client call'),
  ph('family', 'Call family', 45, ['personal'], 'Calling family', { gives: { social: 8 } }),
  ph('lunch', 'Order lunch for the team', 30, ['food'], 'Ordering lunch'),
  ph('voicemail', 'Check voicemail', 30, ['messages'], 'Checking voicemail'),
  ph('repair', 'Call a repair person for the house', 60, ['home-errand'], 'Calling a repair person'),
  ph('bank', 'Call the bank', 60, ['numbers'], 'On the phone with the bank'),
  ph('recruiter', "Return a recruiter's call", 60, ['resume'], 'Calling a recruiter back'),
  ph('sales', 'Make a sales call', 90, ['client'], 'Making a sales call'),
  ph('dinner', 'Book a table for dinner', 30, ['personal'], 'Booking a table'),
  // Dale, from the visitor's chair (he has to be at his desk).
  { id: 'boss_pitch', station: 'boss', label: 'Pitch an idea', secs: 90, tags: ['boss', 'idea'], pose: 'sittalk', verb: 'Pitching an idea to Dale' },
  { id: 'boss_update', station: 'boss', label: 'Give a progress update', secs: 60, tags: ['boss', 'update'], pose: 'sittalk', verb: 'Updating Dale' },
  { id: 'boss_raise', station: 'boss', label: 'Ask for a raise or a day off', secs: 90, tags: ['boss', 'ask'], pose: 'sittalk', verb: 'Asking Dale for a favour' },
  { id: 'boss_feedback', station: 'boss', label: 'Ask for feedback', secs: 60, tags: ['boss', 'feedback'], pose: 'sittalk', verb: 'Asking Dale for feedback' },
  { id: 'boss_chat', station: 'boss', label: 'Make small talk', secs: 30, tags: ['boss', 'social'], pose: 'sittalk', verb: 'Chatting with Dale', gives: { social: 6 } },
  // The door under the sign: out of sight for the length of the meeting.
  { id: 'meet_team', station: 'door', label: 'Sit in on the team meeting', secs: 120, tags: ['meeting'], pose: 'stand', verb: 'In the team meeting', unseen: true },
  { id: 'meet_client', station: 'door', label: 'Present to the client', secs: 180, tags: ['meeting', 'client'], pose: 'stand', verb: 'Presenting to the client', unseen: true },
  { id: 'meet_one', station: 'door', label: 'One-on-one', secs: 90, tags: ['meeting'], pose: 'stand', verb: 'In a one-on-one', unseen: true },
  { id: 'meet_review', station: 'door', label: 'Weekly review', secs: 180, tags: ['meeting', 'review'], pose: 'stand', verb: 'In the weekly review', unseen: true },
  // The printer.
  { id: 'print', station: 'printer', label: 'Print', secs: 45, tags: ['paper', 'print'], pose: 'operate', verb: 'Printing' },
  { id: 'scan', station: 'printer', label: 'Scan a paper', secs: 45, tags: ['paper', 'scan'], pose: 'operate', verb: 'Scanning a paper' },
  { id: 'copy', station: 'printer', label: 'Make a copy', secs: 30, tags: ['paper', 'copy'], pose: 'operate', verb: 'Making a copy' },
  { id: 'restock', station: 'printer', label: 'Restock the paper', secs: 30, tags: ['paper', 'restock'], pose: 'reach', verb: 'Loading paper' },
  // The rest of the floor.
  { id: 'brainstorm', station: 'whiteboard', label: 'Brainstorm on the whiteboard', secs: 60, tags: ['plan'], pose: 'board', verb: 'Brainstorming at the whiteboard' },
  { id: 'file', station: 'filing', label: 'Find a document', secs: 45, tags: ['paper', 'file'], pose: 'files', verb: 'Looking through the files' },
  { id: 'water', station: 'cooler', label: 'Get some water', secs: 30, tags: ['break'], pose: 'dispense', verb: 'Getting water', gives: { comfort: 4 } },
  { id: 'coffee', station: 'coffee', label: 'Make a coffee', secs: 30, tags: ['break', 'coffee'], pose: 'dispense', verb: 'Making a coffee', gives: { energy: 10 } },
  { id: 'snack', station: 'vending', label: 'Buy a snack', secs: 30, tags: ['break', 'snack'], pose: 'operate', verb: 'Buying a snack', gives: { food: 14 } },
  { id: 'lunch', station: 'fridge', label: 'Have lunch', secs: 120, tags: ['break', 'lunch'], pose: 'snack', verb: 'Having lunch', gives: { food: 45, comfort: 6 } },
  { id: 'wash', station: 'sink', label: 'Wash up', secs: 30, tags: ['break'], pose: 'cook', verb: 'Washing up', gives: { comfort: 2 } },
  { id: 'plant', station: 'plant', label: 'Water the plant', secs: 30, tags: ['plant'], pose: 'water', verb: 'Watering the office plant', gives: { comfort: 2 } },
];

/** The activity ids that happen behind the meeting-room door, out of sight. */
export const UNSEEN_ACTS = new Set(OFFICE_ACTIONS.filter((a) => a.unseen).map((a) => `o_${a.id}`));

/** The activity id an action runs as. */
export const actionActivity = (a: OfficeAction): string => `o_${a.id}`;
export const actionsAt = (station: StationId): OfficeAction[] => OFFICE_ACTIONS.filter((a) => a.station === station);
export const stationOfType = (type: string): StationId | null => (Object.entries(STATIONS).find(([, s]) => s.taps.includes(type))?.[0] as StationId | undefined) ?? null;
