from pathlib import Path

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pypdf import PdfReader
from sqlalchemy import text

from .database import (
    engine,
    create_conversation,
    update_conversation_title,
    save_message,
    get_conversation_messages,
    save_chunk,
)
from .embeddings import create_embedding
from .rag import generate_answer



app = FastAPI(
    title="AI Knowledge Assistant",
    description="LLM + Basic RAG Knowledge Assistant",
)



app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)



class ChatRequest(BaseModel):
    conversation_id: int | None = None
    message: str
    use_pdf: bool = False
    pdf_filename: str | None = None


class ConversationCreate(BaseModel):
    title: str = "New Chat"


class ConversationTitleUpdate(BaseModel):
    title: str



@app.get("/")
def home():
    return {
        "message": "AI Knowledge Assistant is running!"
    }



@app.get("/documents")
def get_documents():

    with engine.connect() as connection:

        result = connection.execute(
            text("""
                SELECT
                    filename,
                    COUNT(*) AS chunks,
                    MAX(page) AS pages
                FROM documents
                GROUP BY filename
                ORDER BY filename
            """)
        )

        rows = result.fetchall()

    return [
        {
            "filename": row.filename,
            "pages": int(row.pages or 0),
            "chunks": int(row.chunks or 0),
        }
        for row in rows
    ]



@app.get("/conversations")
def get_conversations():

    with engine.connect() as connection:

        result = connection.execute(
            text("""
                SELECT
                    id,
                    title,
                    created_at
                FROM conversations
                ORDER BY created_at DESC, id DESC
            """)
        )

        rows = result.fetchall()

    return [
        {
            "id": row.id,
            "title": row.title or "New Chat",
        }
        for row in rows
    ]


@app.post("/conversations")
def create_new_conversation(
    request: ConversationCreate
):

    conversation_id = create_conversation(
        request.title
    )

    return {
        "id": conversation_id,
        "title": request.title,
    }


@app.patch("/conversations/{conversation_id}")
def rename_conversation(
    conversation_id: int,
    request: ConversationTitleUpdate,
):

    update_conversation_title(
        conversation_id,
        request.title,
    )

    return {
        "message": "Conversation title updated successfully."
    }


@app.get("/conversations/{conversation_id}/messages")
def get_messages(
    conversation_id: int
):

    messages = get_conversation_messages(
        conversation_id
    )

    return [
        {
            "role": row.role,
            "content": row.content,
        }
        for row in messages
    ]



@app.post("/chat")
def chat(
    request: ChatRequest
):

    question = request.message.strip()

    if not question:
        raise HTTPException(
            status_code=400,
            detail="Message cannot be empty.",
        )

    try:

        result = generate_answer(
            question=question,
            conversation_id=request.conversation_id,
            force_pdf=request.use_pdf,
            pdf_filename=request.pdf_filename,
        )

        return result

    except Exception as e:

        print("\n" + "=" * 60)
        print("[CHAT ERROR]")
        print(str(e))
        print("=" * 60)

        raise HTTPException(
            status_code=500,
            detail=str(e),
        )



@app.post("/upload")
async def upload_pdf(
    file: UploadFile = File(...),
    conversation_id: int | None = None,
):


    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="No file selected.",
        )

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are supported.",
        )


    file_bytes = await file.read()

    if not file_bytes:
        raise HTTPException(
            status_code=400,
            detail="The uploaded PDF is empty.",
        )


    safe_filename = Path(file.filename).name

    file_path = UPLOAD_DIR / safe_filename


    with open(file_path, "wb") as output_file:
        output_file.write(file_bytes)

    print("\n" + "=" * 60)
    print("[UPLOAD] PDF UPLOAD")
    print("=" * 60)
    print("[UPLOAD] Filename:", safe_filename)
    print("[UPLOAD] File size:", len(file_bytes), "bytes")


    try:

        reader = PdfReader(str(file_path))

    except Exception as e:

        raise HTTPException(
            status_code=400,
            detail=f"Could not read PDF: {str(e)}",
        )

    total_pages = len(reader.pages)

    print("[UPLOAD] Pages:", total_pages)


    chunk_size = 1000
    overlap = 200

    total_chunks = 0

    for page_number, page in enumerate(
        reader.pages,
        start=1
    ):

        try:
            page_text = page.extract_text() or ""

        except Exception as e:

            print(
                f"[UPLOAD] Could not extract page "
                f"{page_number}: {e}"
            )

            continue

        page_text = page_text.strip()

        if not page_text:
            print(
                f"[UPLOAD] Page {page_number} "
                f"contains no extractable text."
            )
            continue


        start = 0

        while start < len(page_text):

            end = start + chunk_size

            chunk = page_text[start:end].strip()

            if chunk:

                print(
                    f"[UPLOAD] Processing "
                    f"page={page_number}, "
                    f"chunk={total_chunks + 1}"
                )


                embedding = create_embedding(chunk)


                save_chunk(
                    filename=safe_filename,
                    page=page_number,
                    content=chunk,
                    embedding=embedding,
                )

                total_chunks += 1


            start += chunk_size - overlap

    print("[UPLOAD] Total chunks:", total_chunks)
    print("=" * 60)

    
    return {
        "message": "PDF processed successfully.",
        "filename": safe_filename,
        "file_size": len(file_bytes),
        "pages": total_pages,
        "chunks": total_chunks,
        "conversation_id": conversation_id,
    }
