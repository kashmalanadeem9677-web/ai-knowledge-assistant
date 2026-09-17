# AI Knowledge Assistant

An AI-powered knowledge assistant that combines **LLM-based question answering with Retrieval-Augmented Generation (RAG)** to answer questions from uploaded PDF documents.

## Overview

The AI Knowledge Assistant allows users to interact with an AI assistant through a web interface and ask questions about their uploaded documents.

For document-based questions, the system extracts text from uploaded PDFs, divides it into smaller chunks, generates embeddings, stores them in a PostgreSQL database using **pgvector**, and retrieves the most relevant information before generating an answer.

## Features

* 💬 AI-powered conversational interface
* 📄 PDF document upload and processing
* 🔎 Semantic search using vector embeddings
* 🧠 Retrieval-Augmented Generation (RAG)
* 🗄️ PostgreSQL database with pgvector
* 📚 Source/page information for retrieved document content
* 💾 Conversation history
* ⚡ FastAPI backend
* 🎨 Next.js and Tailwind CSS frontend
* 🔐 Environment-based API key configuration

## Architecture

```text
User
 │
 ▼
Next.js Frontend
 │
 ▼
FastAPI Backend
 │
 ├──────────────► PostgreSQL + pgvector
 │                       │
 │                       └── Document chunks + embeddings
 │
 ├──────────────► PDF Processing
 │                       │
 │                       └── Text extraction + chunking
 │
 └──────────────► OpenAI API
                         │
                         ▼
                    Generated Answer
```

## How RAG Works

The document question-answering flow follows these steps:

1. **Upload PDF**

   * The user uploads a PDF through the web interface.

2. **Extract Text**

   * The backend extracts text from each PDF page.

3. **Create Chunks**

   * Extracted text is divided into smaller overlapping chunks.

4. **Generate Embeddings**

   * Each chunk is converted into a vector embedding.

5. **Store Vectors**

   * Document chunks and their embeddings are stored in PostgreSQL using pgvector.

6. **Semantic Retrieval**

   * When a user asks a question, the question is converted into an embedding.
   * The system searches for the most relevant document chunks using vector similarity.

7. **Generate Answer**

   * The retrieved context is provided to the LLM.
   * The model generates an answer based on the relevant information.

8. **Return Sources**

   * Relevant document information is returned alongside the generated answer.

## Tech Stack

### Backend

* Python
* FastAPI
* PostgreSQL
* pgvector
* SQLAlchemy
* OpenAI API
* PyPDF

### Frontend

* Next.js
* React
* TypeScript
* Tailwind CSS

### Development Tools

* Git & GitHub
* Docker
* VS Code

## Project Structure

```text
ai-knowledge-assistant/
│
├── backend/
│   ├── app/
│   │   ├── database.py
│   │   ├── embeddings.py
│   │   ├── main.py
│   │   ├── rag.py
│   │   └── search.py
│   │
│   ├── generate_embeddings.py
│   └── .gitignore
│
├── frontend/
│   ├── app/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   │
│   ├── package.json
│   └── ...
│
├── README.md
└── .gitignore
```

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/kashmalanadeem9677-web/ai-knowledge-assistant.git
cd ai-knowledge-assistant
```

### 2. Backend Setup

Create and activate a virtual environment:

```bash
cd backend
python -m venv .venv
```

Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

Install the backend dependencies:

```bash
pip install -r requirements.txt
```

### 3. Environment Variables

Create a `.env` file inside the `backend` directory:

```env
OPENAI_API_KEY=your_api_key_here
```

**Never commit your `.env` file or expose your API key publicly.**

### 4. Database

Start PostgreSQL with pgvector using Docker, then configure the database connection according to the application's database configuration.

### 5. Start the Backend

From the `backend` directory:

```bash
uvicorn app.main:app --reload
```

The FastAPI server will run locally on:

```text
http://127.0.0.1:8000
```

### 6. Start the Frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

The Next.js application will run locally on:

```text
http://localhost:3000
```

## Screenshots

Screenshots of the application can be added here to demonstrate:

* Main chat interface
* PDF upload
* Document-based question answering
* Retrieved sources
* Conversation history

## Future Improvements

Potential future improvements include:

* User authentication
* Improved document management
* Support for additional document formats
* More advanced retrieval and ranking
* Streaming AI responses
* Improved citation handling
* Production
