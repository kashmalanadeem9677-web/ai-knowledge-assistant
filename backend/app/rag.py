import os
from dotenv import load_dotenv
from openai import OpenAI

from .database import (
    get_conversation_messages,
    save_message,
    update_conversation_title,
)

from .search import search_similar_chunks

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

if not OPENAI_API_KEY:
    raise RuntimeError(
        "OPENAI_API_KEY is missing. Check your backend .env file."
    )

client = OpenAI(api_key=OPENAI_API_KEY)


def get_pdf_context(question: str, pdf_filename: str):
    """
    Search ONLY inside the PDF selected by the user.
    """

    print("\n" + "=" * 70)
    print("[RAG] PDF SEARCH")
    print("=" * 70)

    print("[RAG] Question:", question)
    print("[RAG] PDF:", pdf_filename)

    if not pdf_filename:
        print("[RAG] ERROR: No PDF filename supplied.")
        return "", []

    rows = search_similar_chunks(
        query=question,
        limit=8,
        filename=pdf_filename,
    )

    print("[RAG] Retrieved chunks:", len(rows))

    if not rows:
        print("[RAG] No matching chunks found.")
        return "", []

    context_parts = []
    sources = []

    for row in rows:

        filename = row.filename
        page = row.page
        content = row.content
        distance = row.distance

        if not content:
            continue

        print(
            f"[RAG] Chunk -> "
            f"{filename} | page {page} | distance {distance:.4f}"
        )

        context_parts.append(
            f"""
SOURCE FILE: {filename}
PAGE: {page}

CONTENT:
{content}
"""
        )

        sources.append(
            {
                "filename": filename,
                "page": page,
                "distance": float(distance),
            }
        )

    context = "\n\n".join(context_parts)

    print("[RAG] Context characters:", len(context))
    print("[RAG] Sources:", len(sources))

    return context, sources


def get_history(conversation_id: int):

    if not conversation_id:
        return []

    try:

        rows = get_conversation_messages(conversation_id)

        history = []

        for row in rows[-10:]:

            history.append(
                {
                    "role": row.role,
                    "content": row.content,
                }
            )

        print(
            f"[RAG] Loaded {len(history)} previous messages."
        )

        return history

    except Exception as e:

        print(
            "[RAG] Could not load conversation history:",
            repr(e),
        )

        return []


def generate_pdf_answer(
    question: str,
    pdf_filename: str,
    conversation_id: int | None = None,
):

    print("\n" + "=" * 70)
    print("GENERATING PDF ANSWER")
    print("=" * 70)

    print("[RAG] Question:", question)
    print("[RAG] PDF:", pdf_filename)

    context, sources = get_pdf_context(
        question=question,
        pdf_filename=pdf_filename,
    )

    if not context:

        answer = (
            f"I couldn't find relevant content in "
            f"'{pdf_filename}' for that question."
        )

        return {
            "answer": answer,
            "sources": [],
            "source_type": "PDF",
        }

    history = get_history(conversation_id)

    system_prompt = f"""
You are an AI Knowledge Assistant.

The user uploaded this PDF:

{pdf_filename}

You MUST answer the user's question using the
retrieved content from that PDF.

IMPORTANT RULES:

1. Use the PDF context provided below.
2. Do NOT say you cannot access the PDF.
3. Do NOT ask the user to upload the PDF again.
4. Do NOT ignore the PDF context.
5. Do NOT make up information.
6. If the answer is present in the context, answer it clearly.
7. If the user asks for a summary, summarize the retrieved material.
8. If the user asks for the main points, explain the important concepts.
9. Mention relevant page numbers when useful.
10. If the answer genuinely cannot be found in the retrieved
    content, clearly say that it was not found in the available
    PDF content.

================ RETRIEVED PDF CONTENT ================

{context}

================ END PDF CONTENT ================
"""

    messages = [
        {
            "role": "system",
            "content": system_prompt,
        }
    ]

    for message in history:

        messages.append(
            {
                "role": message["role"],
                "content": message["content"],
            }
        )

    messages.append(
        {
            "role": "user",
            "content": question,
        }
    )

    print("[RAG] Sending PDF context to OpenAI...")
    print("[RAG] Context length:", len(context))

    response = client.responses.create(
        model="gpt-5.6-luna",
        input=messages,
    )

    answer = response.output_text.strip()

    print("\n[RAG] ANSWER:")
    print(answer)

    if conversation_id:

        try:

            save_message(
                conversation_id,
                "user",
                question,
            )

            save_message(
                conversation_id,
                "assistant",
                answer,
            )

            update_conversation_title(
                conversation_id,
                question[:60],
            )

        except Exception as e:

            print(
                "[RAG] Conversation save failed:",
                repr(e),
            )

    return {
        "answer": answer,
        "sources": sources,
        "source_type": "PDF",
    }


def generate_general_answer(
    question: str,
    conversation_id: int | None = None,
):

    history = get_history(conversation_id)

    system_prompt = """
You are a helpful AI Knowledge Assistant.

Answer the user's question clearly and accurately.

Do not pretend to have information from a PDF when
no PDF context has been provided.
"""

    messages = [
        {
            "role": "system",
            "content": system_prompt,
        }
    ]

    for message in history:

        messages.append(
            {
                "role": message["role"],
                "content": message["content"],
            }
        )

    messages.append(
        {
            "role": "user",
            "content": question,
        }
    )

    response = client.responses.create(
        model="gpt-5.6-luna",
        input=messages,
    )

    answer = response.output_text.strip()

    if conversation_id:

        try:

            save_message(
                conversation_id,
                "user",
                question,
            )

            save_message(
                conversation_id,
                "assistant",
                answer,
            )

            update_conversation_title(
                conversation_id,
                question[:60],
            )

        except Exception as e:

            print(
                "[RAG] Conversation save failed:",
                repr(e),
            )

    return {
        "answer": answer,
        "sources": [],
        "source_type": "GENERAL",
    }


def generate_answer(
    question: str,
    conversation_id: int | None = None,
    force_pdf: bool = False,
    pdf_filename: str | None = None,
):

    print("\n" + "=" * 70)
    print("RAG REQUEST")
    print("=" * 70)

    print("[RAG] Question:", question)
    print("[RAG] Force PDF:", force_pdf)
    print("[RAG] PDF filename:", pdf_filename)

    if force_pdf:

        if not pdf_filename:

            return {
                "answer": (
                    "Please select and process a PDF before "
                    "asking questions about it."
                ),
                "sources": [],
                "source_type": "PDF",
            }

        return generate_pdf_answer(
            question=question,
            pdf_filename=pdf_filename,
            conversation_id=conversation_id,
        )

    return generate_general_answer(
        question=question,
        conversation_id=conversation_id,
    )