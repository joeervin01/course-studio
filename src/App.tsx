import { useState, useRef, useEffect, CSSProperties, ReactNode } from "react";

// ── Design Tokens ─────────────────────────────────────────────────────────────
const C = {
  slate: "#1E2A3A",
  slateLight: "#2C3E52",
  slateDark: "#131C28",
  ivory: "#F7F4EF",
  ivoryDark: "#EDE9E1",
  gold: "#E8A830",
  white: "#FFFFFF",
  text: "#1A1A1A",
  muted: "#6B7280",
  border: "#D4CFC6",
  success: "#2D6A4F",
  successBg: "#D8F3DC",
  error: "#B91C1C",
  errorBg: "#FEE2E2",
} as const;

// ── Types ─────────────────────────────────────────────────────────────────────
interface Assessment {
  title: string;
  description: string;
  points: number;
  measureGoal?: string;
}

interface Week {
  topic: string;
  overview: string;
  reading?: string;
  lectureIdeas?: string[];
  assessment?: Assessment | null;
}

interface GradingItem {
  category: string;
  weight: number;
}

interface Generated {
  goals: string[];
  gradingBreakdown: GradingItem[];
  weeks: Week[];
}

interface CourseState {
  title: string;
  subject: string;
  level: string;
  credits: string;
  weeks: string;
  meetingPattern: string;
  textbook: string;
  description: string;
  learningGoals: string;
  existingSyllabus: string;
  assessmentGoals: string;
}

type BtnVariant = "primary" | "secondary" | "dark" | "ghost";

// ── Constants ─────────────────────────────────────────────────────────────────
const STEPS = ["Course Info", "Curriculum", "Generate", "Blueprint"];
const LEVELS = ["100-level (Intro)", "200-level (Survey)", "300-level (Upper Division)", "400-level (Advanced)", "Graduate", "K-12 (Coming Soon)"];
const CREDITS = ["1 credit", "2 credits", "3 credits", "4 credits", "5 credits"];
const DURATIONS = ["8 weeks", "10 weeks", "12 weeks", "14 weeks", "15 weeks", "16 weeks"];
const PATTERNS = ["Once/week (3 hrs)", "Twice/week", "MWF (3x/week)", "Online Async", "Hybrid"];

const STATUS_MESSAGES = [
  "Connecting to Claude…",
  "Analyzing your course goals…",
  "Mapping the weekly arc…",
  "Designing lecture topics…",
  "Building assessment scaffolding…",
  "Aligning goals to assessments…",
  "Finalizing your blueprint…",
];

// ── Shared Styles ─────────────────────────────────────────────────────────────
const inputStyle: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: `1.5px solid ${C.border}`,
  borderRadius: 8,
  fontFamily: "Inter,sans-serif",
  fontSize: 14,
  color: C.text,
  background: C.white,
  outline: "none",
  boxSizing: "border-box",
  lineHeight: 1.5,
};

// ── Small UI Components ───────────────────────────────────────────────────────
function Label({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <span style={{ fontFamily: "Inter,sans-serif", fontSize: 13, fontWeight: 600, color: C.slate }}>
        {children}
      </span>
      {hint && (
        <p style={{ fontFamily: "Inter,sans-serif", fontSize: 12, color: C.muted, margin: "2px 0 0" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <Label hint={hint}>{label}</Label>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={inputStyle}
    />
  );
}

function Textarea({ value, onChange, placeholder, rows = 4 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{ ...inputStyle, resize: "vertical" }}
    />
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{ ...inputStyle, appearance: "none" as CSSProperties["appearance"], cursor: "pointer" }}
    >
      <option value="">— Select —</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function Btn({
  onClick,
  children,
  variant = "primary",
  disabled = false,
  style: extra = {},
}: {
  onClick?: () => void;
  children: ReactNode;
  variant?: BtnVariant;
  disabled?: boolean;
  style?: CSSProperties;
}) {
  const variants: Record<BtnVariant, CSSProperties> = {
    primary:   { background: C.gold,        color: C.slate, border: "none" },
    secondary: { background: "transparent", color: C.slate, border: `1.5px solid ${C.border}` },
    dark:      { background: C.slate,       color: C.white, border: "none" },
    ghost:     { background: "transparent", color: C.gold,  border: "none" },
  };
  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={{
        padding: "11px 22px",
        borderRadius: 8,
        fontFamily: "Inter,sans-serif",
        fontWeight: 600,
        fontSize: 14,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        transition: "opacity 0.2s",
        ...variants[variant],
        ...extra,
      }}
    >
      {children}
    </button>
  );
}

// ── Progress Bar ──────────────────────────────────────────────────────────────
function ProgressBar({ step }: { step: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: 40 }}>
      {STEPS.map((label, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : undefined }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
            <div style={{
              width: 30, height: 30, borderRadius: "50%",
              background: i < step ? C.success : i === step ? C.gold : C.border,
              color: i <= step ? C.white : C.muted,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 700, fontSize: 13, flexShrink: 0, transition: "all 0.3s",
            }}>
              {i < step ? "✓" : i + 1}
            </div>
            <span style={{
              fontSize: 11, fontWeight: i === step ? 700 : 400,
              color: i === step ? C.slate : C.muted,
              whiteSpace: "nowrap", fontFamily: "Inter,sans-serif",
            }}>
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div style={{
              flex: 1, height: 2, margin: "0 6px", marginBottom: 18,
              background: i < step ? C.success : C.border, transition: "background 0.3s",
            }} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Week Card ─────────────────────────────────────────────────────────────────
function WeekCard({ week, index }: { week: Week; index: number }) {
  const [open, setOpen] = useState(index === 0);
  return (
    <div style={{ border: `1.5px solid ${C.border}`, borderRadius: 10, marginBottom: 10, overflow: "hidden", background: C.white }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          padding: "13px 16px", display: "flex", alignItems: "center",
          justifyContent: "space-between", cursor: "pointer",
          background: open ? C.ivory : C.white,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 26, height: 26, borderRadius: "50%", background: C.gold,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 700, fontSize: 11, color: C.slate, flexShrink: 0,
          }}>
            {index + 1}
          </div>
          <div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: 14, color: C.slate }}>
              {week.topic}
            </div>
            {week.assessment && (
              <span style={{
                fontSize: 10, background: C.successBg, color: C.success,
                borderRadius: 4, padding: "1px 6px", fontFamily: "Inter,sans-serif", fontWeight: 600,
              }}>
                📋 {week.assessment.title}
              </span>
            )}
          </div>
        </div>
        <span style={{ color: C.muted }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div style={{ padding: "14px 16px", borderTop: `1px solid ${C.border}` }}>
          <p style={{ fontFamily: "Inter,sans-serif", fontSize: 13, color: C.text, margin: "0 0 10px", lineHeight: 1.6 }}>
            {week.overview}
          </p>
          {week.reading && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontFamily: "Inter,sans-serif", fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 3 }}>📖 READING</div>
              <div style={{ fontFamily: "Inter,sans-serif", fontSize: 13, color: C.text }}>{week.reading}</div>
            </div>
          )}
          {week.lectureIdeas && week.lectureIdeas.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontFamily: "Inter,sans-serif", fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 3 }}>💡 LECTURE IDEAS</div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {week.lectureIdeas.map((idea: string, i: number) => (
                  <li key={i} style={{ fontFamily: "Inter,sans-serif", fontSize: 13, color: C.text, marginBottom: 3 }}>{idea}</li>
                ))}
              </ul>
            </div>
          )}
          {week.assessment && (
            <div style={{ background: C.successBg, borderRadius: 8, padding: "10px 14px" }}>
              <div style={{ fontFamily: "Inter,sans-serif", fontSize: 12, fontWeight: 700, color: C.success }}>
                📋 {week.assessment.title} — {week.assessment.points} pts
              </div>
              <p style={{ fontFamily: "Inter,sans-serif", fontSize: 13, color: C.success, margin: "4px 0 0" }}>
                {week.assessment.description}
              </p>
              {week.assessment.measureGoal && (
                <p style={{ fontFamily: "Inter,sans-serif", fontSize: 12, color: C.success, margin: "4px 0 0", fontStyle: "italic" }}>
                  Measures: {week.assessment.measureGoal}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Export Helpers ────────────────────────────────────────────────────────────
function toCanvasCSV(_course: CourseState, weeks: Week[]): string {
  const rows = [["module_name", "item_name", "item_type", "description", "points", "published"]];
  weeks.forEach((w, i) => {
    const mod = `Week ${i + 1}: ${w.topic}`;
    rows.push([mod, `Lecture: ${w.topic}`, "Assignment", w.overview || "", "", "true"]);
    if (w.reading) rows.push([mod, `Reading: ${w.reading}`, "ExternalUrl", "", "", "true"]);
    if (w.assessment) rows.push([mod, w.assessment.title, "Assignment", w.assessment.description || "", String(w.assessment.points ?? 100), "true"]);
  });
  return rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
}

function toMoodleXML(course: CourseState, weeks: Week[]): string {
  const sections = weeks.map((w, i) => `
  <section number="${i + 1}">
    <name><![CDATA[Week ${i + 1}: ${w.topic}]]></name>
    <summary><![CDATA[${w.overview || ""}]]></summary>
  </section>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<moodle_backup>\n  <course>\n    <fullname><![CDATA[${course.title}]]></fullname>\n    <shortname>${(course.subject || "COURSE").substring(0, 10).toUpperCase().replace(/\s/g, "")}</shortname>\n  </course>\n  <sections>${sections}\n  </sections>\n</moodle_backup>`;
}

function toSyllabus(course: CourseState, weeks: Week[], goals: string[]): string {
  return [
    course.title || "Course Syllabus",
    "=".repeat(60),
    `${course.subject} | ${course.level} | ${course.credits}`,
    `Meets: ${course.meetingPattern} | Duration: ${course.weeks}`,
    "",
    "COURSE DESCRIPTION",
    "-".repeat(40),
    course.description || "(See course catalog)",
    "",
    "REQUIRED TEXT",
    "-".repeat(40),
    course.textbook || "TBD",
    "",
    "STUDENT LEARNING OUTCOMES",
    "-".repeat(40),
    ...(goals || []).map((g, i) => `${i + 1}. ${g}`),
    "",
    "WEEKLY SCHEDULE",
    "-".repeat(40),
    ...weeks.map((w, i) => [
      `\nWeek ${i + 1}: ${w.topic}`,
      `  ${w.overview}`,
      w.reading ? `  Reading: ${w.reading}` : "",
      w.assessment ? `  ★ Assessment: ${w.assessment.title} (${w.assessment.points} pts)` : "",
    ].filter(Boolean).join("\n")),
  ].join("\n");
}

function downloadFile(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Streaming Generator ───────────────────────────────────────────────────────
async function streamCourseGeneration({
  course,
  onChunk,
  onDone,
  onError,
}: {
  course: CourseState;
  onChunk: (chunk: string) => void;
  onDone: () => void;
  onError: (msg: string) => void;
}): Promise<void> {
  const numWeeks = parseInt(course.weeks) || 15;

  const prompt = `You are an expert instructional designer for college courses. Design a complete, detailed ${numWeeks}-week course.

Course: ${course.title || course.subject}
Level: ${course.level}
Credits: ${course.credits}
Meets: ${course.meetingPattern}
Textbook: ${course.textbook || "Not specified"}
Description: ${course.description || "Not specified"}
Learning Goals: ${course.learningGoals || "Not specified"}
Existing Syllabus Notes: ${course.existingSyllabus || "None"}
Assessment Goals: ${course.assessmentGoals || "Not specified"}

Return ONLY valid JSON (no markdown, no backticks, no preamble) with this structure:
{
  "goals": ["goal 1", "goal 2", "goal 3", "goal 4", "goal 5"],
  "gradingBreakdown": [
    {"category": "Participation", "weight": 10},
    {"category": "Weekly Responses", "weight": 20},
    {"category": "Midterm Essay", "weight": 25},
    {"category": "Final Project", "weight": 30},
    {"category": "Quizzes", "weight": 15}
  ],
  "weeks": [
    {
      "topic": "Introduction and Course Overview",
      "overview": "2-3 sentence overview of what this week covers and why it matters.",
      "reading": "Chapter 1 (pp. 1-24)",
      "lectureIdeas": ["Discussion starter: ...", "Activity: ...", "Mini-lecture: ..."],
      "assessment": null
    }
  ]
}

Include assessments in roughly weeks ${Math.round(numWeeks * 0.25)}, ${Math.round(numWeeks * 0.5)}, ${Math.round(numWeeks * 0.75)}, and ${numWeeks}.
Assessment format: {"title": "...", "description": "...", "points": 100, "measureGoal": "which learning goal this addresses"}
Make every week substantive, pedagogically sound, and specific to the subject matter.`;

  const proxyUrl = process.env.REACT_APP_API_PROXY_URL;

  if (proxyUrl) {
    try {
      const res = await fetch(`${proxyUrl}/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, model: "claude-sonnet-4-20250514", max_tokens: 6000 }),
      });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;
          try {
            const event = JSON.parse(data);
            const text: string = event?.delta?.text ?? "";
            if (text) onChunk(text);
          } catch { /* skip */ }
        }
      }
      onDone();
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : "Unknown error");
    }
  } else {
    // Fallback: single request with simulated character-by-character reveal
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 6000,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      const full: string = (data.content || []).map((b: { text?: string }) => b.text || "").join("");
      const CHUNK = 40;
      let i = 0;
      await new Promise<void>(resolve => {
        const tick = setInterval(() => {
          const slice = full.slice(i, i + CHUNK);
          if (slice) onChunk(slice);
          i += CHUNK;
          if (i >= full.length) { clearInterval(tick); resolve(); }
        }, 16);
      });
      onDone();
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : "Unknown error");
    }
  }
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function CourseDesignStudio() {
  const [step, setStep] = useState(0);
  const [course, setCourse] = useState<CourseState>({
    title: "", subject: "", level: "", credits: "", weeks: "",
    meetingPattern: "", textbook: "", description: "",
    learningGoals: "", existingSyllabus: "", assessmentGoals: "",
  });
  const [status, setStatus] = useState("");
  const [statusIdx, setStatusIdx] = useState(0);
  const [streamBuffer, setStreamBuffer] = useState("");
  const [generated, setGenerated] = useState<any>(null);
  const [genError, setGenError] = useState("");
  const [exportFlash, setExportFlash] = useState("");
  const statusTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const set = (key: keyof CourseState) => (val: string) =>
    setCourse(c => ({ ...c, [key]: val }));

  useEffect(() => {
    if (status === "generating") {
      let idx = 0;
      setStatusIdx(idx);
      statusTimer.current = setInterval(() => {
        idx = (idx + 1) % STATUS_MESSAGES.length;
        setStatusIdx(idx);
      }, 3500);
    } else {
      if (statusTimer.current) clearInterval(statusTimer.current);
    }
    return () => { if (statusTimer.current) clearInterval(statusTimer.current); };
  }, [status]);

  async function generate() {
    setGenError("");
    setStreamBuffer("");
    setGenerated(null);
    setStatus("generating");

    await streamCourseGeneration({
      course,
      onChunk: chunk => setStreamBuffer(prev => prev + chunk),
      onDone: () => {
        setStreamBuffer(prev => {
          try {
            const clean = prev.replace(/```json|```/g, "").trim();
            const parsed: Generated = JSON.parse(clean);
            setGenerated(parsed);
            setStatus("done");
            setStep(3);
          } catch {
            setGenError("The response couldn't be parsed as JSON. Try generating again.");
            setStatus("");
          }
          return prev;
        });
      },
      onError: msg => {
        setGenError(msg || "Something went wrong. Please try again.");
        setStatus("");
      },
    });
  }

  function exportFile(type: string) {
    if (!generated) return;
    const slug = (course.title || "course").replace(/\s+/g, "_");
    if (type === "canvas")   downloadFile(toCanvasCSV(course, generated.weeks),                     `${slug}_canvas.csv`,   "text/csv");
    else if (type === "moodle")   downloadFile(toMoodleXML(course, generated.weeks),                `${slug}_moodle.xml`,   "application/xml");
    else if (type === "syllabus") downloadFile(toSyllabus(course, generated.weeks, generated.goals), `${slug}_syllabus.txt`, "text/plain");
    else                          downloadFile(JSON.stringify({ course, ...(generated || {}) }, null, 2),    `${slug}_data.json`,    "application/json");
    setExportFlash(type);
    setTimeout(() => setExportFlash(""), 3000);
  }

  const isGenerating = status === "generating";

  return (
    <div style={{ minHeight: "100vh", background: C.ivory, fontFamily: "Inter,sans-serif" }}>

      {/* Header */}
      <div style={{ background: C.slate, padding: "18px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>🎓</span>
            <h1 style={{ fontFamily: "'Playfair Display',serif", color: C.white, fontSize: 21, margin: 0, fontWeight: 700 }}>
              Course Design Studio
            </h1>
          </div>
          <p style={{ color: C.gold, margin: "2px 0 0", fontSize: 12, fontWeight: 500 }}>
            AI-powered curriculum planning · Canvas · Moodle · Blackboard · D2L
          </p>
        </div>
        <div style={{ background: C.gold, color: C.slate, borderRadius: 6, padding: "5px 12px", fontSize: 11, fontWeight: 700 }}>
          BETA
        </div>
      </div>

      <div style={{ maxWidth: 820, margin: "0 auto", padding: "36px 20px" }}>
        <ProgressBar step={step} />

        {/* Step 0 — Course Info */}
        {step === 0 && (
          <div>
            <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 25, color: C.slate, margin: "0 0 6px" }}>
              Tell us about your course
            </h2>
            <p style={{ color: C.muted, fontSize: 14, margin: "0 0 26px" }}>Basic details to anchor your course blueprint.</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <Field label="Course Title" hint="e.g., English Composition I">
                <Input value={course.title} onChange={set("title")} placeholder="Introduction to Composition" />
              </Field>
              <Field label="Subject / Discipline">
                <Input value={course.subject} onChange={set("subject")} placeholder="English, History, Biology…" />
              </Field>
              <Field label="Course Level">
                <Select value={course.level} onChange={set("level")} options={LEVELS} />
              </Field>
              <Field label="Credit Hours">
                <Select value={course.credits} onChange={set("credits")} options={CREDITS} />
              </Field>
              <Field label="Semester Length">
                <Select value={course.weeks} onChange={set("weeks")} options={DURATIONS} />
              </Field>
              <Field label="Meeting Pattern">
                <Select value={course.meetingPattern} onChange={set("meetingPattern")} options={PATTERNS} />
              </Field>
            </div>
            <Field label="Course Description" hint="A brief description of what students will learn.">
              <Textarea value={course.description} onChange={set("description")} placeholder="This course introduces students to…" rows={3} />
            </Field>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
              <Btn onClick={() => setStep(1)} disabled={!course.subject || !course.level || !course.weeks}>
                Continue → Curriculum
              </Btn>
            </div>
          </div>
        )}

        {/* Step 1 — Curriculum */}
        {step === 1 && (
          <div>
            <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 25, color: C.slate, margin: "0 0 6px" }}>
              Curriculum &amp; materials
            </h2>
            <p style={{ color: C.muted, fontSize: 14, margin: "0 0 26px" }}>
              The more detail you provide, the more tailored your blueprint will be.
            </p>
            <Field label="Required Textbook or Primary Text">
              <Input value={course.textbook} onChange={set("textbook")} placeholder="Norton Field Guide to Writing, 5th ed." />
            </Field>
            <Field label="Student Learning Outcomes" hint="What should students be able to do by the end? List 3–6 goals.">
              <Textarea value={course.learningGoals} onChange={set("learningGoals")}
                placeholder={"- Write clear, thesis-driven essays\n- Analyze and evaluate sources critically\n- Develop an academic voice"} rows={5} />
            </Field>
            <Field label="Assessment & Grading Goals" hint="Papers, quizzes, projects, participation — what matters most?">
              <Textarea value={course.assessmentGoals} onChange={set("assessmentGoals")}
                placeholder="3 formal essays, weekly reading responses, midterm, final portfolio…" rows={3} />
            </Field>
            <Field label="Existing Syllabus or Notes (optional)" hint="Paste anything you'd like Claude to incorporate.">
              <Textarea value={course.existingSyllabus} onChange={set("existingSyllabus")}
                placeholder="Paste existing syllabus content, topic lists, or department requirements…" rows={5} />
            </Field>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
              <Btn variant="secondary" onClick={() => setStep(0)}>← Back</Btn>
              <Btn onClick={() => setStep(2)}>Continue → Generate</Btn>
            </div>
          </div>
        )}

        {/* Step 2 — Generate */}
        {step === 2 && (
          <div>
            <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 25, color: C.slate, margin: "0 0 6px" }}>
              Generate your course blueprint
            </h2>
            <p style={{ color: C.muted, fontSize: 14, margin: "0 0 26px" }}>
              Claude will build a full {course.weeks} schedule — weekly topics, lecture ideas, readings, and assessments.
            </p>

            {/* Summary card */}
            <div style={{ background: C.white, border: `1.5px solid ${C.border}`, borderRadius: 12, padding: 22, marginBottom: 24 }}>
              <h3 style={{ fontFamily: "'Playfair Display',serif", color: C.slate, fontSize: 16, margin: "0 0 14px" }}>Course Summary</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 24px" }}>
                {([
                  ["Course",    course.title || course.subject],
                  ["Level",     course.level],
                  ["Credits",   course.credits],
                  ["Duration",  course.weeks],
                  ["Meets",     course.meetingPattern],
                  ["Textbook",  course.textbook || "Not specified"],
                ] as [string, string][]).map(([k, v]) => (
                  <div key={k} style={{ display: "flex", gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.muted, minWidth: 64 }}>{k}</span>
                    <span style={{ fontSize: 13, color: C.text }}>{v || "—"}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Streaming window */}
            {isGenerating && (
              <div style={{ background: C.slateDark, borderRadius: 12, padding: 22, marginBottom: 22 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: C.gold, animation: "blink 1s ease-in-out infinite" }} />
                  <span style={{ color: C.gold, fontWeight: 700, fontSize: 13 }}>{STATUS_MESSAGES[statusIdx]}</span>
                </div>
                <div style={{ background: "#0D1520", borderRadius: 4, height: 4, marginBottom: 16, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", background: C.gold, borderRadius: 4,
                    width: `${Math.min(100, (streamBuffer.length / 5000) * 100)}%`,
                    transition: "width 0.5s ease",
                  }} />
                </div>
                <pre style={{
                  color: "#7FB5FF", fontSize: 11, fontFamily: "monospace",
                  maxHeight: 180, overflow: "hidden", margin: 0, whiteSpace: "pre-wrap",
                  opacity: 0.65, lineHeight: 1.6,
                }}>
                  {streamBuffer.slice(-500)}
                  <span style={{ animation: "blink 0.8s step-end infinite", color: C.gold }}>▌</span>
                </pre>
                <p style={{ color: "#4A6FA5", fontSize: 11, margin: "12px 0 0", fontStyle: "italic" }}>
                  This usually takes 20–40 seconds for a full semester course.
                </p>
              </div>
            )}

            {genError && (
              <div style={{ background: C.errorBg, color: C.error, borderRadius: 8, padding: "12px 16px", marginBottom: 16, fontSize: 13 }}>
                ⚠️ {genError}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <Btn variant="secondary" onClick={() => setStep(1)} disabled={isGenerating}>← Back</Btn>
              <Btn onClick={generate} disabled={isGenerating} style={{ minWidth: 190 }}>
                {isGenerating ? "⏳ Building blueprint…" : "✨ Generate Blueprint"}
              </Btn>
            </div>
            <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
          </div>
        )}

        {/* Step 3 — Blueprint */}
        {step === 3 && generated && (
          <div>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 12 }}>
              <div>
                <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 25, color: C.slate, margin: "0 0 4px" }}>
                  {course.title || course.subject}
                </h2>
                <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>
                  {course.level} · {course.credits} · {course.weeks} · {course.meetingPattern}
                </p>
              </div>
              <Btn variant="secondary" onClick={() => { setStep(0); setGenerated(null); setStreamBuffer(""); }}>
                ↺ Start Over
              </Btn>
            </div>

            {/* Learning Goals */}
            <div style={{ background: C.white, border: `1.5px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
              <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, color: C.slate, margin: "0 0 12px" }}>
                📌 Student Learning Outcomes
              </h3>
              <ol style={{ margin: 0, paddingLeft: 20 }}>
                {generated.goals?.map((g, i) => (
                  <li key={i} style={{ fontFamily: "Inter,sans-serif", fontSize: 13, color: C.text, marginBottom: 6, lineHeight: 1.5 }}>{g}</li>
                ))}
              </ol>
            </div>

            {/* Grading Breakdown */}
            {generated.gradingBreakdown && (
              <div style={{ background: C.white, border: `1.5px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
                <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, color: C.slate, margin: "0 0 14px" }}>
                  📊 Grading Breakdown
                </h3>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  {generated.gradingBreakdown.map((g, i) => (
                    <div key={i} style={{ background: C.ivory, borderRadius: 8, padding: "10px 16px", textAlign: "center" }}>
                      <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, fontWeight: 700, color: C.gold }}>{g.weight}%</div>
                      <div style={{ fontFamily: "Inter,sans-serif", fontSize: 11, color: C.slate, fontWeight: 600 }}>{g.category}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Weekly Schedule */}
            <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: C.slate, margin: "20px 0 12px" }}>
              📅 Weekly Schedule
            </h3>
            {generated.weeks?.map((week, i) => <WeekCard key={i} week={week} index={i} />)}

            {/* Export Panel */}
            <div style={{ background: C.slate, borderRadius: 14, padding: 26, marginTop: 32 }}>
              <h3 style={{ fontFamily: "'Playfair Display',serif", color: C.white, fontSize: 18, margin: "0 0 6px" }}>
                Export to your LMS
              </h3>
              <p style={{ color: "#9BB5CC", fontSize: 13, margin: "0 0 20px" }}>
                Download your course in a format ready to import into your course management system.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 10 }}>
                {([
                  { id: "canvas",   icon: "🎨", label: "Canvas CSV",     sub: "Import via Canvas Modules" },
                  { id: "moodle",   icon: "🌐", label: "Moodle XML",     sub: "Moodle backup format" },
                  { id: "syllabus", icon: "📄", label: "Syllabus (.txt)", sub: "Works with any LMS" },
                  { id: "json",     icon: "⚙️", label: "JSON Data",      sub: "Blackboard, D2L, custom" },
                ] as { id: string; icon: string; label: string; sub: string }[]).map(({ id, icon, label, sub }) => (
                  <div
                    key={id}
                    onClick={() => exportFile(id)}
                    style={{
                      background: exportFlash === id ? "#1A3A2A" : C.slateLight,
                      borderRadius: 10, padding: "14px 16px", cursor: "pointer",
                      border: `1.5px solid ${exportFlash === id ? C.success : "transparent"}`,
                      transition: "all 0.2s",
                    }}
                  >
                    <div style={{ fontSize: 20, marginBottom: 6 }}>{icon}</div>
                    <div style={{ color: C.white, fontWeight: 600, fontSize: 13 }}>{label}</div>
                    <div style={{ color: "#9BB5CC", fontSize: 11, marginTop: 2 }}>{sub}</div>
                    <div style={{ color: C.gold, fontSize: 12, marginTop: 8, fontWeight: 600 }}>
                      {exportFlash === id ? "✓ Downloaded" : "Download ↓"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
