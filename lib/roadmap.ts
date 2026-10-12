// The roadmap data. Sections split the spine; topics are clickable nodes.
// Tile = string | { t, sub?, cls? }  (cls: "full" | "nice")

export type Tile = string | { t: string; sub?: string; cls?: "full" | "nice" };
export type Group = { h: string; tiles: Tile[] };
export type Topic = { node: string; tag?: string; lead?: string; groups: Group[] };
export type Section = { sec: string };
export type Entry = Section | Topic;

export const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const roadmap: Entry[] = [
  { sec: "Phase 1 · Foundations" },
  { node: "Python for AI", tag: "prerequisite", lead: "The language everything is built in", groups: [
    { h: "Core language", tiles: ["Data types & structures", "Comprehensions", "Generators & iterators", "Decorators", "Context managers", "Type hints", { t: "Async / await", cls: "full" }] },
    { h: "OOP", tiles: ["Classes & objects", "Dataclasses", "Inheritance", "Dunder methods"] },
    { h: "Packaging & quality", tiles: ["venv & pip", "pyproject / requirements", "pytest", "Logging", "Error handling", "Ruff / Black lint"] },
    { h: "Data libraries", tiles: ["NumPy", "Pandas", { t: "requests / httpx", cls: "full" }] },
  ] },
  { node: "Dev Tooling", tag: "prerequisite", lead: "Ship like an engineer, not a notebook", groups: [
    { h: "Version control", tiles: ["Git basics", "Branches", "Pull requests", "GitHub"] },
    { h: "Claude Code", tiles: ["Daily workflows", "Controlling context", "Hooks & SDK", { t: "MCP integration", cls: "full" }] },
    { h: "Environment", tiles: ["CLI", "Env vars & .env", { t: "Secrets management", cls: "full" }] },
  ] },
  { node: "Data Pipelines & Foundations", tag: "should", lead: "Garbage in = garbage out — the data layer feeding every AI system", groups: [
    { h: "Pipelines", tiles: ["Batch vs streaming ingestion", "Orchestration basics", { t: "Incremental updates & CDC", cls: "full" }] },
    { h: "Data quality", tiles: ["Validation & schemas", "Deduplication", "PII detection & redaction", { t: "Cleaning for RAG corpora", cls: "full" }] },
    { h: "Stores & access", tiles: ["SQL fluency", "Document / feature stores", { t: "Metadata catalogs", cls: "full" }] },
  ] },

  { sec: "Phase 2 · How LLMs Work" },
  { node: "ML Foundations", tag: "theory · light", lead: "Just enough to talk theory in interviews", groups: [
    { h: "Learning basics", tiles: ["What is machine learning?", "Supervised vs unsupervised", "Train / validation / test", "Features & labels", { t: "Loss functions", cls: "" as any }] },
    { h: "Neural nets", tiles: ["Neurons & layers", "Activation functions", "Forward pass", "Gradient descent", { t: "Backprop (concept)", cls: "full" }] },
    { h: "Generalization", tiles: ["Overfitting / underfitting", "Regularization", { t: "Bias-variance", cls: "full" }] },
  ] },
  { node: "LLM Internals", tag: "theory", lead: "Enough to reason about any model", groups: [
    { h: "Architecture", tiles: [{ t: "Transformer", sub: "decoder-only", cls: "full" }, "Hidden states", "Logits", { t: "Autoregressive decoding", cls: "full" }] },
    { h: "Tokenization", tiles: ["BPE / WordPiece", "Vocabulary", "Token limits", "Special tokens"] },
    { h: "Attention", tiles: ["Self-attention", "Query / Key / Value", "Multi-head", "Positional encoding", { t: "Context window", cls: "full" }] },
    { h: "Training lifecycle", tiles: ["Pre-training", "Supervised fine-tune (SFT)", "RLHF", "DPO", { t: "Instruction tuning", cls: "full" }] },
  ] },
  { node: "Working with LLM APIs", tag: "hands-on", lead: "Talk to models in code — learn this BEFORE tuning knobs", groups: [
    { h: "Chat APIs", tiles: ["SDK setup & call pattern", "Messages & roles", "System / user / assistant", "Streaming", { t: "Usage & token counting", cls: "full" }] },
    { h: "Structured output", tiles: ["JSON mode"] },
  ] },
  { node: "Build: The Capstone App", tag: "capstone · phase 1", lead: "Build and ship the HelpDesk foundation — basic chat, memory, streaming, cost, structured tickets, users, persistence, and deployment.", groups: [
    { h: "Part A · Grow it one feature at a time", tiles: ["v1 · Basic Q&A call", "v2 · Conversation memory", "v3 · Streaming + persona", "v4 · Token & cost tracking", "v5 · Structured output"] },
    { h: "Part B · Make it multi-user & production-ready", tiles: ["v6 · Auth & per-user history", "v7 · Redis & concurrency", "v8 · Deploy to production"] },
  ] },
  { node: "Sampling & Generation", tag: "hands-on", lead: "The knobs that control every output", groups: [
    { h: "Decoding parameters", tiles: ["Temperature", "Top-K", "Top-P (nucleus)", "Repetition penalty", "Max tokens", "Stop sequences", "Seed", { t: "Logprobs", cls: "full" }] },
  ] },
  { node: "LLM APIs — Advanced", tag: "hands-on", lead: "The rest of the API surface — reach for these as your app needs them", groups: [
    { h: "Tools & multimodal", tiles: ["Function / tool schemas", "Vision inputs", "Audio"] },
    { h: "Other endpoints", tiles: ["Embeddings API", "Batch API", "Files API", "SSE streaming"] },
    { h: "Hugging Face", tiles: ["transformers", "pipelines", "tokenizers", { t: "Inference API & Hub", cls: "full" }] },
    { h: "Production concerns", tiles: ["Rate limits", "Retries & backoff", "Async batching", { t: "Prompt caching", cls: "full" }] },
  ] },
  { node: "Build: The Capstone App — Phase 2", tag: "project · integration", lead: "Apply every advanced API lesson to the deployed HelpDesk app — tools, multimodal intake, semantic search, reliability, batch work, and open-model fallback.", groups: [
    { h: "Establish the production contract", tiles: [{ t: "v8.1 · Production foundation", cls: "full" }] },
    { h: "Add advanced capabilities", tiles: ["v9 · Tool calling & live order lookup", "v10 · Multimodal ticket intake", "v11 · Embeddings-powered similar tickets"] },
    { h: "Harden and scale", tiles: ["v12 · Resilient provider client", "v13 · Async & batch processing", "v14 · Open-model fallback"] },
    { h: "Ship the integrated release", tiles: [{ t: "v15 · Phase 2 integration & demo", cls: "full" }] },
  ] },
  { node: "Model Landscape", tag: "decision", lead: "Which model, and why", groups: [
    { h: "Foundation models", tiles: ["Closed vs open", "Model sizes", "Context length", "Multimodal"] },
    { h: "Providers", tiles: ["Anthropic Claude", "OpenAI GPT", "Google Gemini", "Meta Llama", "Mistral", "Cohere", { t: "Falcon · Jais 🇦🇪", cls: "full" }] },
    { h: "Selection & cost", tiles: ["Capability vs task", "Latency", "Licensing", "Token pricing", "Cost estimation", { t: "Cost vs performance tradeoff", cls: "full" }] },
    { h: "Choosing at scale", tiles: ["Model routing / cascades", "Model tiering by task", { t: "Managed vs self-hosted (build vs buy)", cls: "full" }] },
  ] },

  { sec: "Phase 3 · Prompt & Context" },
  { node: "Prompt Engineering", tag: "core skill", lead: "Get reliable behaviour out of any LLM", groups: [
    { h: "Techniques", tiles: ["Zero-shot", "Few-shot", "Chain-of-Thought", "ReAct", "Self-consistency", { t: "Tree-of-Thought", cls: "nice" }] },
    { h: "Structure & control", tiles: ["System prompting", "Role assignment", "Delimiters", "Structured output", { t: "Prompt chaining & decomposition", cls: "full" }] },
    { h: "Reliability", tiles: ["Grounding & citations", "Avoiding hallucination", "Prompt-injection defense", "Jailbreak awareness", { t: "Guardrails & moderation", cls: "full" }] },
    { h: "Ops", tiles: ["Prompt templates", "Versioning", { t: "Experiment tracking & A/B", cls: "full" }] },
  ] },
  { node: "Context Engineering", tag: "core skill", lead: "Manage what the model sees — the 2025-26 skill", groups: [
    { h: "Context sources", tiles: ["System instructions", "External memory", "RAG & dynamic filters", { t: "Tool results as context", cls: "full" }] },
    { h: "Managing the window", tiles: ["Long-context handling", "Context compaction", "Context isolation", "Summarization / pruning", { t: "Prompt & KV caching", cls: "full" }] },
  ] },
  { node: "Build: The Capstone App — Phase 3", tag: "project · prompt & context", lead: "Turn prompt and context engineering into a reliable HelpDesk control layer — versioned prompts, safe workflows, memory, compaction, and measured releases.", groups: [
    { h: "Engineer the behavior", tiles: ["v16 · Versioned prompt library", "v17 · Few-shot structured triage", "v18 · Grounding, citations & guardrails", "v19 · Chained support workflow"] },
    { h: "Engineer the context", tiles: ["v20 · External customer memory", "v21 · Context budget & compaction"] },
    { h: "Ship the measured release", tiles: [{ t: "v22 · Prompt experiments & Phase 3 demo", cls: "full" }] },
  ] },

  { sec: "Phase 3 · RAG (deep dive)" },
  { node: "RAG Architecture", tag: "core skill", lead: "How grounded generation actually works", groups: [
    { h: "Pipelines", tiles: [{ t: "Naive RAG", sub: "ingest→chunk→embed→store→retrieve→generate", cls: "full" }, "Advanced RAG", "Modular RAG", "Agentic RAG"] },
  ] },
  { node: "Ingestion & Parsing", tag: "hands-on", lead: "Turn messy docs into clean text", groups: [
    { h: "Document loading", tiles: ["PDF", "HTML", "DOCX / MD", "CSV / tables"] },
    { h: "Parsing", tiles: ["OCR", "Table & layout extraction", "unstructured.io", "PyMuPDF"] },
    { h: "Preparation", tiles: ["Cleaning & normalization", { t: "Metadata extraction", cls: "full" }] },
  ] },
  { node: "Chunking", tag: "hands-on", lead: "How you split docs decides retrieval quality", groups: [
    { h: "Strategies", tiles: ["Fixed-size", "Sliding window / overlap", "Recursive", "Semantic chunking", "Sentence / token-based", { t: "Hierarchical (parent-child)", cls: "full" }] },
    { h: "Tradeoffs", tiles: ["Chunk size vs recall", { t: "Metadata per chunk", cls: "full" }] },
  ] },
  { node: "Embeddings & Indexing", tag: "hands-on", lead: "Meaning as vectors, stored for fast search", groups: [
    { h: "Embedding models", tiles: ["OpenAI text-embedding-3", "e5 / BGE", "Cohere multilingual", { t: "Multilingual & domain-specific", cls: "full" }, { t: "Query vs passage embeddings", cls: "full" }] },
    { h: "Vector stores", tiles: ["Pinecone", "FAISS", "Chroma", "pgvector", "Weaviate"] },
    { h: "Indexing & similarity", tiles: ["Flat / IVF / HNSW", "ANN search", "Cosine / dot / L2"] },
  ] },
  { node: "Retrieval", tag: "core skill", lead: "Finding the right context, ranked well", groups: [
    { h: "Search methods", tiles: ["Dense retrieval", "Sparse (BM25 / TF-IDF)", { t: "Hybrid search", cls: "full" }, { t: "Vector vs keyword vs SQL vs graph — when to use which", cls: "full" }] },
    { h: "Selection", tiles: ["Top-K", "Metadata filtering", "MMR (diversity)", { t: "Reranking (cross-encoder / Cohere)", cls: "full" }] },
    { h: "Query transformation", tiles: ["Multi-query", "HyDE", "Query expansion", "Decomposition", { t: "Contextual compression", cls: "full" }] },
  ] },
  { node: "Advanced RAG", tag: "advanced", lead: "Beyond the basics", groups: [
    { h: "Patterns", tiles: ["Graph RAG", "Knowledge graphs", "Multimodal RAG", { t: "Self-RAG / Corrective RAG", cls: "full" }, { t: "Caching & streaming", cls: "full" }] },
  ] },
  { node: "RAG in Production", tag: "must · real-world", lead: "How RAG behaves at company scale — millions of docs, latency, cost, debugging", groups: [
    { h: "Scaling", tiles: ["Millions of documents", "Sharding & partitioning", "Incremental indexing & updates", { t: "Index tuning at scale (HNSW params)", cls: "full" }] },
    { h: "Latency & cost", tiles: ["Latency budgeting", "Semantic & prompt caching", "Async & batching", { t: "Cost at scale", cls: "full" }] },
    { h: "Reliability & ops", tiles: ["Debugging retrieval failures", "Monitoring & online eval", "Data freshness & re-embedding", { t: "High availability & fallbacks", cls: "full" }] },
  ] },

  { sec: "Phase 3 · Evaluation & Multimodal" },
  { node: "Evaluation", tag: "core skill", lead: "Prove your system works — measurably", groups: [
    { h: "Intrinsic metrics", tiles: ["ROUGE", "BLEU", "Perplexity", "BERTScore", { t: "METEOR", cls: "nice" }] },
    { h: "LLM-based", tiles: ["LLM-as-judge", "Pairwise", { t: "Rubric scoring", cls: "full" }] },
    { h: "RAG metrics (RAGAS)", tiles: ["Faithfulness", "Answer relevancy", "Context precision", "Context recall", "Precision@K / MRR / NDCG", { t: "Hallucination rate", cls: "full" }] },
    { h: "Process", tiles: ["Golden datasets", "Human-in-the-loop", "Regression / CI eval", { t: "LangSmith / Langfuse", cls: "full" }, { t: "Bias & red-teaming", cls: "full" }] },
  ] },
  { node: "Multimodal AI", tag: "should", lead: "Beyond text — your projects use these", groups: [
    { h: "Speech", tiles: ["Speech-to-text (Whisper)", "Text-to-speech", { t: "Audio transcription pipelines", cls: "full" }] },
    { h: "Vision", tiles: ["Image understanding", "Vision LLMs / VLMs", "OCR", "Document AI"] },
    { h: "Generation", tiles: ["Image generation", { t: "Multimodal models (text+image+audio)", cls: "full" }] },
  ] },

  { sec: "Phase 4 · Agents & Advanced" },
  { node: "Agent Fundamentals", tag: "core skill", lead: "Make the LLM act, plan, remember", groups: [
    { h: "Reasoning loop", tiles: ["Agent loop", "ReAct", "Planning", { t: "Reasoning + acting", cls: "full" }] },
    { h: "Memory", tiles: ["Short-term", "Long-term", "Episodic", "Semantic memory", "Procedural memory", "Vector memory", "Which memory type when", "Memory eviction / forgetting", { t: "State management", cls: "full" }] },
  ] },
  { node: "Agent Design Patterns", tag: "core skill", lead: "Anthropic's building-effective-agents patterns", groups: [
    { h: "Workflows", tiles: ["Prompt chaining", "Routing", "Parallelization", { t: "Orchestrator-workers", cls: "full" }, { t: "Evaluator-optimizer", cls: "full" }] },
    { h: "Autonomy", tiles: ["Reflection", "Planning", { t: "Workflow vs autonomous agent", cls: "full" }] },
  ] },
  { node: "Tools & Frameworks", tag: "hands-on", lead: "Give agents hands and a team", groups: [
    { h: "Tool use", tiles: ["Function calling", "Tool schemas", "API tools", "Code execution", { t: "Retrieval / MCP tools", cls: "full" }] },
    { h: "Frameworks", tiles: ["LangChain agents", { t: "LangGraph (nodes/edges/state)", cls: "full" }, "CrewAI", "AutoGen"] },
  ] },
  { node: "Multi-Agent Systems", tag: "must", lead: "Many specialist agents working as a team", groups: [
    { h: "Architectures", tiles: ["Single vs multi-agent", "Supervisor / orchestrator", "Hierarchical", "Network / peer-to-peer", "Sequential pipeline", { t: "Concurrent / parallel", cls: "full" }] },
    { h: "Coordination", tiles: ["Task decomposition", "Delegation & handoffs", "Routing", "Planning", { t: "Manager + worker roles", cls: "full" }] },
    { h: "Communication", tiles: ["Message passing", "Shared state / memory", "Shared scratchpad", { t: "Agent-to-agent (A2A) protocol", cls: "full" }] },
    { h: "Collaboration patterns", tiles: ["Debate", "Voting / consensus", "Generator-critic", { t: "Reflection loop", cls: "full" }] },
    { h: "Frameworks", tiles: ["CrewAI (crews / flows)", "AutoGen (group chat)", "LangGraph multi-agent", { t: "OpenAI Agents SDK / Swarm", cls: "full" }] },
    { h: "Hard problems", tiles: ["Error propagation", "Cost explosion", "Coordination overhead", "Infinite loops", { t: "Multi-agent evaluation & observability", cls: "full" }] },
  ] },
  { node: "Agent Reliability", tag: "must", lead: "Agents that don't go rogue", groups: [
    { h: "Evaluation", tiles: ["Trajectory eval", { t: "Task-completion eval", cls: "full" }] },
    { h: "Safety", tiles: ["Guardrails", "Human approval", "Retry / backoff", "Error recovery", { t: "Sandboxing & agent security", cls: "full" }] },
    { h: "Cost & determinism", tiles: ["Step / spend budget caps", "Loop / iteration limits", "Determinism & reproducibility", { t: "Replayable traces", cls: "full" }] },
  ] },
  { node: "Agent Cost & Context Control", tag: "should · real-world", lead: "The failure mode that kills agent projects — runaway loops, context overflow, exploding token bills", groups: [
    { h: "Context management", tiles: ["Context-window overflow on long runs", "Compaction & summary checkpoints", "Sub-agent context isolation", { t: "Tool-result trimming", cls: "full" }] },
    { h: "Cost control", tiles: ["Per-run token & spend budgets", "Step caps & kill-switches", { t: "Loop detection", cls: "full" }] },
    { h: "Correctness over long runs", tiles: ["Determinism & seeds", "Permission checks before high-impact tools", { t: "Replayable / debuggable trajectories", cls: "full" }] },
  ] },
  { node: "MCP (Model Context Protocol)", tag: "must", lead: "The USB-C of AI tools — standard model↔tool wiring", groups: [
    { h: "Why MCP", tiles: ["The M×N integration problem", "Open standard", "Host / client / server", { t: "MCP vs plain function calling", cls: "full" }] },
    { h: "Primitives", tiles: ["Tools", "Resources", "Prompts", "Roots", "Sampling", { t: "Elicitation", cls: "nice" }] },
    { h: "Transports", tiles: ["STDIO (local)", { t: "Streamable HTTP", sub: "replaces deprecated HTTP+SSE", cls: "full" }, "JSON-RPC", { t: "Stateless servers (modern default)", sub: "self-contained requests → scale horizontally", cls: "full" }, { t: "Stateful / SSE (legacy)", cls: "nice" }] },
    { h: "Building servers", tiles: ["FastMCP", "Define tools & schemas", "Expose resources", { t: "Log / progress notifications", cls: "full" }] },
    { h: "Clients & hosts", tiles: ["Claude Desktop", "IDE / Claude Code", "Custom clients", { t: "Connecting servers", cls: "full" }] },
    { h: "Production", tiles: ["Auth", "Roots enforcement (security)", "Remote / load-balanced", { t: "MCP tools inside LangGraph agents", cls: "full" }] },
  ] },
  { node: "Fine-tuning", tag: "should", lead: "When prompting & RAG aren't enough", groups: [
    { h: "Decide", tiles: ["Long-context vs RAG vs fine-tune", "When fine-tuning is the wrong answer", { t: "Data-volume thresholds", cls: "full" }] },
    { h: "PEFT", tiles: ["LoRA", "QLoRA", "Adapters", "Quantization"] },
    { h: "Workflow", tiles: ["Data prep & formatting", "Unsloth", "HF PEFT / TRL", { t: "Train & evaluate", cls: "full" }] },
    { h: "Advanced", tiles: [{ t: "RLHF / DPO", cls: "nice" }, { t: "Distillation & merging", cls: "nice" }] },
  ] },
  { node: "LLM Security & Guardrails", tag: "must", lead: "Enterprise/finance Dubai roles demand this", groups: [
    { h: "Threats (OWASP LLM Top-10)", tiles: ["Prompt injection", "Jailbreaks", "Data leakage / PII", "Insecure output handling", { t: "Excessive agency", cls: "full" }] },
    { h: "Defenses", tiles: ["Input / output validation", "Guardrails frameworks", "Llama Guard", "NeMo Guardrails", { t: "Sandboxing & least privilege", cls: "full" }] },
  ] },
  { node: "Responsible AI", tag: "should", lead: "Ship safely and legally", groups: [
    { h: "Governance", tiles: ["EU AI Act", "PII & data privacy", { t: "Content safety", cls: "full" }, { t: "Adversarial robustness", cls: "nice" }] },
  ] },

  { sec: "Phase 4½ · Architecture & Optimization" },
  { node: "Architecting AI Solutions", tag: "must · senior signal", lead: "The #1 senior skill — pick the cheapest approach that meets the requirement, and defend it", groups: [
    { h: "The decision ladder", tiles: [{ t: "Prompt → few-shot → RAG → tools → fine-tune → pretrain", cls: "full" }, { t: "Climb only when the rung below fails", cls: "full" }] },
    { h: "Core trade-offs", tiles: ["RAG vs fine-tune vs long-context vs prompt", "When to add memory, and which type", "Single call vs workflow vs agent vs multi-agent", { t: "Vector vs keyword vs SQL vs graph", cls: "full" }] },
    { h: "System choices", tiles: ["Which model tier per task", "Build vs buy (managed vs self-hosted)", "Sync vs streaming vs async vs batch", { t: "Structured output vs tool-calling vs text", cls: "full" }] },
  ] },
  { node: "Cost & Token Optimization", tag: "must", lead: "The token bill is the P&L line every AI feature lives or dies on", groups: [
    { h: "Measure", tiles: ["Token accounting per request", { t: "Cost attribution", cls: "full" }] },
    { h: "Cut input cost", tiles: ["Prompt compression", "Context trimming", "Prompt & KV caching", { t: "Cache-friendly prompt structure", cls: "full" }] },
    { h: "Cut model cost", tiles: ["Model routing / cascades", "Right-sizing & distillation", "Batching", { t: "Output-token control", cls: "full" }] },
  ] },
  { node: "Latency & Reliability Engineering", tag: "must", lead: "User-facing AI has hard latency budgets; agents that hang are unshippable", groups: [
    { h: "Latency", tiles: ["Latency budgeting", "Streaming & first-token time", { t: "Parallel / speculative execution", cls: "full" }] },
    { h: "Reliability", tiles: ["Timeouts", "Retries & backoff", "Circuit breakers", { t: "Fallback chains", cls: "full" }] },
    { h: "Scale", tiles: ["Concurrency & pooling", "Async serving", { t: "Graceful degradation under load", cls: "full" }] },
  ] },
  { node: "Accuracy & Correctness Optimization", tag: "should", lead: "Techniques to RAISE accuracy and kill hallucination — not just measure it", groups: [
    { h: "Grounding", tiles: ["Grounding & citation-forcing", "\"I don't know\" calibration", { t: "Constrained / structured decoding", cls: "full" }] },
    { h: "Self-correction", tiles: ["Generate → critique → revise", "Verification & validators", { t: "Voting / self-consistency", cls: "full" }] },
    { h: "Judgment", tiles: ["Confidence & abstention", "Escalation to human", { t: "Error-analysis workflow", cls: "full" }] },
  ] },

  { sec: "Phase 5 · Production & Deployment" },
  { node: "API & Serving", tag: "must", lead: "Wrap your model in a real service", groups: [
    { h: "FastAPI", tiles: ["Endpoints", "Pydantic schemas", "Async", "Streaming responses"] },
    { h: "Serving", tiles: ["Uvicorn / Gunicorn", "CORS", "Auth (API key / JWT)", { t: "Rate limiting", cls: "full" }] },
  ] },
  { node: "Containers & Cloud", tag: "must", lead: "The 82%-of-Dubai-JDs gap", groups: [
    { h: "Docker", tiles: ["Dockerfile", "Images", "Compose", "Multi-stage", { t: "Env & secrets", cls: "full" }] },
    { h: "AWS", tiles: ["Bedrock", "ECS / App Runner", "Lambda", { t: "S3 · IAM", cls: "full" }] },
    { h: "Other clouds", tiles: ["Azure / AzureML", "GCP", { t: "MS Fabric", cls: "full" }] },
  ] },
  { node: "Inference & Serving", tag: "must", lead: "Serve models fast and cheap", groups: [
    { h: "Serving frameworks", tiles: ["vLLM", "TGI", "Ollama", { t: "LiteLLM gateway", cls: "full" }] },
    { h: "Optimization", tiles: ["Continuous batching", "KV cache", "Flash attention", "Speculative decoding", { t: "GPU utilization", cls: "full" }] },
    { h: "Quantization", tiles: ["GGUF", "AWQ", "GPTQ", "bitsandbytes"] },
    { h: "Cost & routing", tiles: ["Prompt / semantic cache", "Model routing", { t: "Fallbacks & load balancing", cls: "full" }] },
  ] },
  { node: "LLMOps & Observability", tag: "must", lead: "Watch it, measure it, keep it healthy", groups: [
    { h: "Observability (Langfuse)", tiles: ["Tracing", "Monitoring & logging", "Cost / latency dashboards"] },
    { h: "Quality in prod", tiles: ["Online evaluation", "Feedback loops", "Drift detection", { t: "Prompt management & versioning", cls: "full" }] },
    { h: "Delivery", tiles: ["CI/CD", "Automated eval gates", { t: "Testing frameworks", cls: "full" }] },
  ] },

  { sec: "Phase 6 · Capstone" },
  { node: "Ship the Flagship", tag: "portfolio", lead: "One deployed project that proves it all", groups: [
    { h: "Steps", tiles: [{ t: "Wrap in FastAPI service", cls: "full" }, { t: "Containerize + deploy to AWS", cls: "full" }, { t: "Wire Langfuse tracing + eval", cls: "full" }, { t: "Load test + harden (auth, rate limits)", cls: "full" }] },
  ] },

  { sec: "Phase 7 · Get Hired" },
  { node: "AI System Design Interview", tag: "should · interview", lead: "The classic interview format — requirements → components → trade-offs → bottlenecks", groups: [
    { h: "The framework", tiles: ["Clarify requirements", "Define SLAs (latency/cost/accuracy)", "Sketch components", { t: "Find bottlenecks & iterate", cls: "full" }] },
    { h: "Worked examples", tiles: [{ t: "Design a support RAG assistant", cls: "full" }, { t: "Design a doc-processing pipeline at scale", cls: "full" }, { t: "Design a coding / research agent", cls: "full" }] },
    { h: "Estimation", tiles: ["Capacity & cost (QPS, tokens, $)", "Failure-mode analysis", { t: "Data pipeline design", cls: "full" }] },
  ] },
  { node: "AI Product Engineering", tag: "nice", lead: "Own outcomes, not just pipelines — scope, UX, and when NOT to use an LLM", groups: [
    { h: "Scoping", tiles: ["Is this even an AI problem?", "Success metrics before building", { t: "When deterministic code wins", cls: "full" }] },
    { h: "Product", tiles: ["Human-in-the-loop UX", "Handling non-determinism", "Feedback capture & the data flywheel", { t: "Trust & transparency", cls: "full" }] },
  ] },
  { node: "Interview-Ready (Dubai)", tag: "goal", lead: "Turn skills into offers", groups: [
    { h: "Drills", tiles: ["RAG & retrieval eval", "Agents / tools / MCP", "Deploy / LLMOps / cost", "System design", "Cost / latency estimation", "Trade-off defense", { t: "Failure-mode analysis", cls: "full" }] },
    { h: "Practice", tiles: ["Live coding", "Behavioral + career-gap story", { t: "Project deep-dive defense", cls: "full" }] },
    { h: "Apply", tiles: [{ t: "Portfolio write-ups + READMEs", cls: "full" }, { t: "Apply to Dubai roles + mentor outreach", cls: "full" }] },
  ] },
];

export function isSection(e: Entry): e is Section {
  return (e as Section).sec !== undefined;
}
