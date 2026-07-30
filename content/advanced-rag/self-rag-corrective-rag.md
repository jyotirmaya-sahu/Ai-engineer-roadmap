# Self-RAG / Corrective RAG

**What it is:** A RAG pipeline that **checks its own work** — before answering, it grades whether the retrieved chunks are actually relevant, and if they're not, it retries, searches the web, or admits "I don't know" instead of confidently making something up.

## Why it matters for an AI Engineer

Naive RAG has a dangerous flaw: **it always answers.** Vector search *always* returns a top-k, even when nothing relevant exists in your corpus. The model then dutifully generates an answer grounded in irrelevant text — a hallucination *with a citation attached*, which is worse than an obvious guess because it looks trustworthy.

For anything that matters — legal, medical, financial, compliance — this is the #1 reason RAG systems get pulled from production. A self-correcting loop turns "always answers, sometimes wrong" into "answers when it can, abstains or escalates when it can't." That single behavior is often what separates a demo from a deployable system, and it's exactly what enterprise buyers ask about.

## The mechanism / how it works

Both **Self-RAG** and **Corrective RAG (CRAG)** add a *grading step* between retrieval and generation. The difference is what triggers correction:

- **Self-RAG:** the model reflects at multiple points — *do I even need to retrieve? are these docs relevant? is my draft answer supported by them?* — and can loop back.
- **Corrective RAG (CRAG):** a lightweight grader scores retrieved docs as *correct / ambiguous / incorrect*. If they're not good enough, it triggers a **fallback** — rewrite the query and retry, or do a **web search** — before generating.

The shared pattern is a loop, not a straight line:

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">❓ Question</span>
    <span class="darr">↓</span>
    <span class="dbox blue">🗄️ Retrieve top-k</span>
    <span class="darr">↓</span>
    <span class="dbox purple">⚖️ Grade: are these relevant?</span>
    <div class="flow">
      <span class="dbox green">✅ yes → generate</span>
      <span class="dbox orange">↺ no → rewrite query / web search</span>
      <span class="dbox yellow">🙅 nothing → "not in my sources"</span>
    </div>
    <span class="darr">↓<span class="lbl">check answer is grounded</span></span>
    <span class="dbox green">✅ Grounded answer (or honest abstain)</span>
  </div>
  <div class="dcap">A grader sits between retrieval and generation; bad retrieval routes to retry, web fallback, or abstain — never a blind answer.</div>
</div>

In 2026 the standard way to build these loops is **LangGraph** (a graph of nodes and conditional edges), because the control flow has branches and cycles that a linear chain can't express.

## A concrete example

A minimal Corrective-RAG loop in LangGraph: retrieve, grade relevance, and route to either generation or a query-rewrite fallback.

```python
from langgraph.graph import StateGraph, END
from langchain_openai import ChatOpenAI
from typing import TypedDict, List

llm = ChatOpenAI(model="gpt-4o", temperature=0)

class State(TypedDict):
    question: str
    docs: List[str]
    answer: str

def retrieve(s):        # your vector search here
    return {"docs": vector_search(s["question"], k=4)}

def grade(s):           # LLM grades: is the context relevant?
    verdict = llm.invoke(
        f"Docs:\n{s['docs']}\n\nQuestion: {s['question']}\n"
        "Do these docs contain the answer? Reply only YES or NO."
    ).content.strip().upper()
    return "generate" if "YES" in verdict else "rewrite"

def rewrite(s):         # fallback: improve the query, then re-retrieve
    better = llm.invoke(f"Rewrite for better search: {s['question']}").content
    return {"question": better}

def generate(s):
    ans = llm.invoke(
        f"Answer ONLY from these docs, else say you don't know.\n"
        f"{s['docs']}\n\nQ: {s['question']}"
    ).content
    return {"answer": ans}

g = StateGraph(State)
g.add_node("retrieve", retrieve)
g.add_node("rewrite", rewrite)
g.add_node("generate", generate)
g.set_entry_point("retrieve")
g.add_conditional_edges("retrieve", grade,
                        {"generate": "generate", "rewrite": "rewrite"})
g.add_edge("rewrite", "retrieve")   # loop back and try again
g.add_edge("generate", END)

app = g.compile()
print(app.invoke({"question": "What's our refund window?"})["answer"])
```

The `add_conditional_edges` call is the whole point: retrieval is *graded*, and bad retrieval loops back through `rewrite` instead of steamrolling into a hallucinated answer. The `generate` prompt also forces an honest "I don't know" when the docs genuinely lack the answer.

## How a company uses this

A **Dubai insurance company's** policy-Q&A assistant kept inventing coverage limits when a policy detail wasn't in the retrieved documents — a compliance nightmare. They wrapped retrieval in a Corrective-RAG grader: if the docs don't clearly contain the answer, it rewrites the query once, and if still nothing, it replies *"That detail isn't in the policy documents I have — please check with an agent."* Hallucinated coverage claims dropped to near zero, which was the literal condition for legal sign-off to ship.

## Common mistakes / misconceptions

- **Grading with the same forgiving prompt that generates.** The grader must be *strict* and output a clean signal (YES/NO or a score). A wishy-washy grader passes bad context through.
- **Infinite loops.** Always cap retries (e.g. rewrite at most twice) or the graph can cycle forever on an unanswerable question.
- **Thinking it removes the need for good retrieval.** It's a safety net, not a fix — it catches failures, but you still want strong base retrieval (see [../retrieval/](../retrieval/) and [../rag-architecture.md](../rag-architecture.md)). Correction is cheaper if it rarely fires.

## Interview tip
Say: *"Naive RAG always answers, even on irrelevant retrieval — that's how you get confident hallucinations with citations. Self-RAG and Corrective RAG add a grading step: score the retrieved context, and if it's weak, rewrite the query, fall back to web search, or abstain. I build the loop in LangGraph because it needs conditional branches and cycles, and I cap retries. The win is the system knowing when to say 'I don't know.'"* That directly addresses the trust problem enterprises care about most.
