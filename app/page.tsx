"use client";

import { useEffect, useState } from "react";
import SiteTabs from "@/components/SiteTabs";

type SprintDay = {
  date: string;
  activeDates?: string[];
  label: string;
  focus: string;
  tasks: Array<{ title: string; details?: string[] }>;
  milestone?: string;
};

const sprintDays: SprintDay[] = [
  {
    date: "2026-11-13",
    label: "13 Nov",
    focus: "Prompt and context foundations",
    tasks: [
      { title: "Build a prompt engineering project", details: ["Structure & control", "Reliability", "Operations"] },
      { title: "Build a small context engineering project", details: ["Understand context compaction", "Learn the agent loop and context structure"] },
      { title: "Study RAG architecture" },
      { title: "Start ingestion basics" },
    ],
  },
  {
    date: "2026-11-14",
    label: "14 Nov",
    focus: "The complete retrieval pipeline",
    tasks: [
      { title: "Complete ingestion and parsing" },
      { title: "Learn chunking" },
      { title: "Learn embeddings and indexing" },
      { title: "Learn retrieval" },
    ],
  },
  {
    date: "2026-11-15",
    label: "15 Nov",
    focus: "RAG revision and build day",
    tasks: [{ title: "Revise the RAG pipeline" }, { title: "Build a complete RAG project" }],
  },
  {
    date: "2026-11-16",
    label: "16 Nov",
    focus: "Advanced RAG",
    tasks: [{ title: "Study Advanced RAG and RAG in production" }, { title: "Build an Advanced RAG project" }],
  },
  {
    date: "2026-11-17",
    activeDates: ["2026-11-18"],
    label: "17–18 Nov",
    focus: "Integrated AI applications",
    tasks: [
      { title: "Build two projects, including one with voice models" },
      { title: "Combine RAG, prompt engineering and tools in one end-to-end application" },
    ],
  },
  {
    date: "2026-11-19",
    label: "19 Nov",
    focus: "Model Context Protocol",
    tasks: [{ title: "Learn MCP" }, { title: "Start an MCP project" }],
  },
  {
    date: "2026-11-20",
    label: "20 Nov",
    focus: "MCP completion and orchestration",
    tasks: [{ title: "Complete the MCP project" }, { title: "Learn LangChain and LangGraph" }],
  },
  {
    date: "2026-11-21",
    label: "21 Nov",
    focus: "LangChain and LangGraph build day",
    tasks: [{ title: "Build a project with LangChain and LangGraph" }],
  },
  {
    date: "2026-11-22",
    label: "22 Nov",
    focus: "Evaluation",
    tasks: [{ title: "Learn AI system evaluation" }, { title: "Build an evaluation project using LangSmith" }],
  },
  {
    date: "2026-11-23",
    label: "23 Nov",
    focus: "Multi-Agent systems",
    tasks: [{ title: "Learn Multi-Agent system architecture and coordination" }],
  },
  {
    date: "2026-11-24",
    activeDates: ["2026-11-25"],
    label: "24–25 Nov",
    focus: "Multi-Agent project",
    tasks: [{ title: "Build and complete a Multi-Agent project" }],
  },
  {
    date: "2026-11-25",
    label: "25 Nov",
    focus: "Amazon Bedrock",
    milestone: "Interview-ready checkpoint",
    tasks: [{ title: "Learn Amazon Bedrock for UAE and Dubai AI roles" }],
  },
  {
    date: "2026-11-26",
    label: "26 Nov",
    focus: "Bedrock build day",
    tasks: [{ title: "Build a project with Amazon Bedrock" }],
  },
  {
    date: "2026-11-27",
    label: "27 Nov",
    focus: "CrewAI",
    tasks: [{ title: "Learn CrewAI" }, { title: "Build CrewAI projects" }],
  },
];

export default function Home() {
  const [today, setToday] = useState("");
  const [completed, setCompleted] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setToday(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai" }).format(new Date()));
    try {
      setCompleted(JSON.parse(localStorage.getItem("ai-roadmap-progress") || "{}"));
    } catch {
      setCompleted({});
    }
  }, []);

  const toggleTask = (taskId: string) => {
    setCompleted((current) => {
      const next = { ...current, [taskId]: !current[taskId] };
      localStorage.setItem("ai-roadmap-progress", JSON.stringify(next));
      return next;
    });
  };

  const totalTasks = sprintDays.reduce((total, day) => total + day.tasks.length, 0);
  const completedTasks = Object.values(completed).filter(Boolean).length;

  return (
    <>
      <header className="plan-hero">
        <SiteTabs active="plan" />
        <p className="eyebrow">13–27 November · Dubai</p>
        <h1>AI Engineer daily sprint</h1>
        <p className="plan-intro">
          Follow the work in order. Learn the concept, build the project, then move to the next day.
        </p>
        <div className="plan-goal">
          <div>
            <span>Target</span>
            <strong>Interview-ready by 25 November</strong>
          </div>
          <b>{completedTasks}/{totalTasks} done</b>
        </div>
      </header>

      <main className="plan-shell">
        <div className="plan-timeline">
          {sprintDays.map((day) => {
            const isToday = day.date === today || day.activeDates?.includes(today);
            return (
              <section className={`plan-day${isToday ? " today" : ""}`} key={`${day.date}-${day.label}`}>
                <div className="plan-date">
                  <time dateTime={day.date}>{day.label}</time>
                  {isToday && <span>Today</span>}
                </div>
                <div className="plan-card">
                  {day.milestone && <div className="milestone">{day.milestone}</div>}
                  <h2>{day.focus}</h2>
                  <ul className="plan-tasks">
                    {day.tasks.map((task, taskIndex) => {
                      const taskId = `${day.date}-${taskIndex}`;
                      const isComplete = Boolean(completed[taskId]);
                      return (
                      <li className={isComplete ? "task-complete" : ""} key={task.title}>
                        <input
                          className="task-check"
                          type="checkbox"
                          checked={isComplete}
                          onChange={() => toggleTask(taskId)}
                          aria-label={`Mark ${task.title} as ${isComplete ? "not done" : "done"}`}
                        />
                        <div>
                          <strong>{task.title}</strong>
                          {task.details && (
                            <ul>
                              {task.details.map((detail) => (
                                <li key={detail}>{detail}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </li>
                      );
                    })}
                  </ul>
                </div>
              </section>
            );
          })}
        </div>
      </main>
    </>
  );
}
