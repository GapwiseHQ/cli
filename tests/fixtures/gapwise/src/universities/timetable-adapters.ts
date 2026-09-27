import type { Meeting, ParsedTimetable } from "@/lib/timetable-types";

/** University integration registry. Shared product surfaces consume ParsedTimetable only. */
export const timetableAdapters: Record<string, (text: string) => Promise<ParsedTimetable>> = {
  "acorn-ics": async (text) => {
    const { parseIcs } = await import("@/lib/ics-parser");
    const { enrichCourseTitles } = await import("@/lib/course-title-catalog");
    const parsed = parseIcs(text);
    return { ...parsed, meetings: await enrichCourseTitles(parsed.meetings) };
  },
  "carleton-ics": async (text) => {
    const { parseCarletonTimetable } = await import("./carleton/adapter");
    return parseCarletonTimetable(text);
  },
  "tmu-schedule": async (text) => {
    const { parseTimetable } = await import("./tmu/adapter");
    return parseTimetable(text);
  },
  "queens-schedule": async (text) => {
    const { parseTimetable } = await import("./queens/adapter");
    return parseTimetable(text);
  },
  "laurier-schedule": async (text) => {
    const { parseTimetable } = await import("./laurier/adapter");
    return parseTimetable(text);
  },
  "york-schedule": async (text) => {
    const { parseTimetable } = await import("./york/adapter");
    return parseTimetable(text);
  },
  "mcmaster-schedule": async (text) => {
    const { parseTimetable } = await import("./mcmaster/adapter");
    return parseTimetable(text);
  },
  "western-schedule": async (text) => {
    const { parseTimetable } = await import("./western/adapter");
    return parseTimetable(text);
  },
  "guelph-schedule": async (text) => {
    const { parseTimetable } = await import("./guelph/adapter");
    return parseTimetable(text);
  },
  "uottawa-schedule": async (text) => {
    const { parseTimetable } = await import("./uottawa/adapter");
    return parseTimetable(text);
  },
  "brock-schedule": async (text) => {
    const { parseTimetable } = await import("./brock/adapter");
    return parseTimetable(text);
  },
  // GAPWISE_ADAPTER_REGISTRY: the CLI inserts new timetable adapters here.
};

export const demoTimetableLoaders: Record<string, () => Promise<Meeting[]>> = {
  "acorn-ics": async () => (await import("@/lib/demo-timetable")).DEMO_MEETINGS,
  "carleton-ics": async () => {
    const [{ DEMO_CARLETON_MEETINGS }, { normalizeCarletonMeeting }] = await Promise.all([
      import("./carleton/demo-timetable"),
      import("./carleton/adapter"),
    ]);
    return DEMO_CARLETON_MEETINGS.flatMap(normalizeCarletonMeeting);
  },
  "tmu-schedule": async () => {
    const [{ DEMO_TMU_MEETINGS }, { normalizeTmuMeeting }] = await Promise.all([
      import("./tmu/demo-timetable"),
      import("./tmu/adapter"),
    ]);
    return DEMO_TMU_MEETINGS.flatMap(normalizeTmuMeeting);
  },
  "queens-schedule": async () => {
    const [{ DEMO_QUEENS_MEETINGS }, { normalizeQueensMeeting }] = await Promise.all([
      import("./queens/demo-timetable"),
      import("./queens/adapter"),
    ]);
    return DEMO_QUEENS_MEETINGS.flatMap(normalizeQueensMeeting);
  },
  "laurier-schedule": async () => {
    const [{ DEMO_LAURIER_MEETINGS }, { normalizeLaurierMeeting }] = await Promise.all([
      import("./laurier/demo-timetable"),
      import("./laurier/adapter"),
    ]);
    return DEMO_LAURIER_MEETINGS.flatMap(normalizeLaurierMeeting);
  },
  "york-schedule": async () => {
    const [{ DEMO_YORK_MEETINGS }, { normalizeYorkMeeting }] = await Promise.all([
      import("./york/demo-timetable"),
      import("./york/adapter"),
    ]);
    return DEMO_YORK_MEETINGS.flatMap(normalizeYorkMeeting);
  },
  "mcmaster-schedule": async () => {
    const [{ DEMO_MCMASTER_MEETINGS }, { normalizeMcMasterMeeting }] = await Promise.all([
      import("./mcmaster/demo-timetable"),
      import("./mcmaster/adapter"),
    ]);
    return DEMO_MCMASTER_MEETINGS.flatMap(normalizeMcMasterMeeting);
  },
  "western-schedule": async () => {
    const [{ DEMO_WESTERN_MEETINGS }, { normalizeWesternMeeting }] = await Promise.all([
      import("./western/demo-timetable"),
      import("./western/adapter"),
    ]);
    return DEMO_WESTERN_MEETINGS.flatMap(normalizeWesternMeeting);
  },
  "guelph-schedule": async () => {
    const [{ DEMO_GUELPH_MEETINGS }, { normalizeGuelphMeeting }] = await Promise.all([
      import("./guelph/demo-timetable"),
      import("./guelph/adapter"),
    ]);
    return DEMO_GUELPH_MEETINGS.flatMap(normalizeGuelphMeeting);
  },
  "uottawa-schedule": async () => {
    const [{ DEMO_UOTTAWA_MEETINGS }, { normalizeUOttawaMeeting }] = await Promise.all([
      import("./uottawa/demo-timetable"),
      import("./uottawa/adapter"),
    ]);
    return DEMO_UOTTAWA_MEETINGS.flatMap(normalizeUOttawaMeeting);
  },
  "brock-schedule": async () => {
    const [{ DEMO_BROCK_MEETINGS }, { normalizeBrockMeeting }] = await Promise.all([
      import("./brock/demo-timetable"),
      import("./brock/adapter"),
    ]);
    return DEMO_BROCK_MEETINGS.flatMap(normalizeBrockMeeting);
  },
  // GAPWISE_DEMO_LOADER_REGISTRY: the CLI inserts new demo loaders here.
};

export async function loadDemoTimetable(adapterId?: string): Promise<Meeting[]> {
  const loader = adapterId ? demoTimetableLoaders[adapterId] : undefined;
  if (loader) return loader();
  return (await import("@/lib/demo-timetable")).DEMO_MEETINGS;
}
