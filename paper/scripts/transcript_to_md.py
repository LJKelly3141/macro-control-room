#!/usr/bin/env python3
"""Turn a Claude Code session log (JSON lines) into a readable Markdown transcript.

    python3 paper/scripts/transcript_to_md.py SESSION.jsonl OUT.md

Keeps, in order: the user's messages, the assistant's replies, and one line per tool
call (tool name plus its description, file path, or a short excerpt). Tool results,
system reminders and bookkeeping records are left out. Context summaries written when
the conversation was compacted are kept, marked as such.
"""
import json
import re
import sys

TAGS = re.compile(r"<(system-reminder|local-command-stdout|local-command-caveat|command-message|command-args|"
                  r"task-notification|user-prompt-submit-hook)[^>]*>.*?</\1>", re.S)


def clean_user_text(t):
    t = TAGS.sub("", t)
    t = re.sub(r"<command-name>(.*?)</command-name>", r"\1", t, flags=re.S)
    return t.strip()


def tool_line(block):
    name = block.get("name", "tool")
    inp = block.get("input") or {}
    for key in ("description", "file_path", "url", "query", "prompt", "skill", "action"):
        v = inp.get(key)
        if isinstance(v, str) and v.strip():
            v = " ".join(v.split())
            return f"- *{name}*: {v[:160]}{'...' if len(v) > 160 else ''}"
    if name == "AskUserQuestion":
        qs = [q.get("question", "") for q in inp.get("questions", [])]
        return f"- *AskUserQuestion*: {' | '.join(qs)[:300]}"
    return f"- *{name}*"


def main(src, out):
    lines = []
    count = {"user": 0, "assistant": 0, "tools": 0}
    pending_tools = []

    def flush_tools():
        if pending_tools:
            lines.append("")
            lines.extend(pending_tools)
            lines.append("")
            pending_tools.clear()

    for raw in open(src, encoding="utf-8"):
        try:
            d = json.loads(raw)
        except ValueError:
            continue
        kind = d.get("type")
        if kind not in ("user", "assistant") or d.get("isSidechain"):
            continue
        msg = d.get("message") or {}
        content = msg.get("content")
        stamp = (d.get("timestamp") or "")[:16].replace("T", " ")
        if kind == "user":
            if isinstance(content, list):
                texts = [b.get("text", "") for b in content if isinstance(b, dict) and b.get("type") == "text"]
                if not texts:
                    continue  # tool results
                text = "\n".join(texts)
            else:
                text = content or ""
            if d.get("isMeta"):
                continue
            text = clean_user_text(text)
            if not text:
                continue
            flush_tools()
            if d.get("isCompactSummary") or text.startswith("This session is being continued from a previous conversation"):
                lines.append(f"\n---\n\n## [Context summary, {stamp} UTC]\n")
                lines.append("<details><summary>Summary written when the conversation was compacted</summary>\n")
                lines.append(text)
                lines.append("\n</details>\n")
                continue
            count["user"] += 1
            lines.append(f"\n---\n\n## User, {stamp} UTC\n")
            lines.append(text)
        else:
            if not isinstance(content, list):
                continue
            for b in content:
                if not isinstance(b, dict):
                    continue
                if b.get("type") == "text" and b.get("text", "").strip():
                    flush_tools()
                    count["assistant"] += 1
                    lines.append(f"\n**Assistant, {stamp} UTC**\n")
                    lines.append(b["text"].strip())
                elif b.get("type") == "tool_use":
                    count["tools"] += 1
                    pending_tools.append(tool_line(b))
    flush_tools()

    head = [
        "# Session transcript",
        "",
        f"Source: `{src.split('/')[-1]}`. {count['user']} user messages, {count['assistant']} assistant replies, "
        f"{count['tools']} tool calls (one line each; their results are left out). Times are UTC.",
    ]
    with open(out, "w", encoding="utf-8") as f:
        f.write("\n".join(head + lines) + "\n")
    print(out, count)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
