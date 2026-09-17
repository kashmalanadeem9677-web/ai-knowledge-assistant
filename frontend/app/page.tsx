"use client";

import {
  ChangeEvent,
  KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";

const API_URL = "http://127.0.0.1:8010";

type Source = {
  id?: number;
  filename: string;
  page: number;
  distance?: number;
};

type Message = {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  source_type?: "PDF" | "GENERAL" | "WEB" | string;
};

type Conversation = {
  id: number;
  title: string;
};

type DocumentInfo = {
  filename: string;
  pages: number;
  chunks: number;
};

export default function Home() {
  // =========================================================
  // CHAT
  // =========================================================

  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] =
    useState<number | null>(null);

  // =========================================================
  // DOCUMENTS
  // =========================================================

  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // =========================================================
  // UI
  // =========================================================

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);

  // =========================================================
  // LOAD INITIAL DATA
  // =========================================================

  useEffect(() => {
    loadConversations();
    loadDocuments();
  }, []);

  // =========================================================
  // AUTO SCROLL
  // =========================================================

  useEffect(() => {
    const container = chatContainerRef.current;

    if (!container) return;

    const lastMessage = container.querySelector(
      '[data-last-message="true"]'
    );

    if (lastMessage) {
      lastMessage.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [messages, loading]);

  // =========================================================
  // API ERROR HELPER
  // =========================================================

  async function getErrorMessage(response: Response) {
    try {
      const data = await response.json();

      if (typeof data?.detail === "string") {
        return data.detail;
      }

      if (typeof data?.message === "string") {
        return data.message;
      }

      if (typeof data?.error === "string") {
        return data.error;
      }

      return `Request failed with status ${response.status}.`;
    } catch {
      return `Request failed with status ${response.status}.`;
    }
  }

  // =========================================================
  // LOAD CONVERSATIONS
  // =========================================================

  async function loadConversations() {
    try {
      const response = await fetch(`${API_URL}/conversations`);

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      const data: Conversation[] = await response.json();

      setConversations(data);

      if (data.length > 0 && activeConversationId === null) {
        setActiveConversationId(data[0].id);
        await loadMessages(data[0].id);
      }
    } catch (err) {
      console.error("Conversation loading error:", err);
    }
  }

  // =========================================================
  // LOAD DOCUMENTS
  // =========================================================

  async function loadDocuments() {
    /*
      The current backend does not yet expose /documents.

      We intentionally keep this function safe so the frontend
      still works with the current backend.

      Once the /documents endpoint is added, this automatically
      populates the document library.
    */

    try {
      const response = await fetch(`${API_URL}/documents`);

      if (!response.ok) {
        return;
      }

      const data = await response.json();

      if (Array.isArray(data)) {
        setDocuments(data);
      }
    } catch {
      // Current backend may not have /documents yet.
    }
  }

  // =========================================================
  // LOAD MESSAGES
  // =========================================================

  async function loadMessages(conversationId: number) {
    try {
      const response = await fetch(
        `${API_URL}/conversations/${conversationId}/messages`
      );

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      const data = await response.json();

      setMessages(
        data.map((message: Message) => ({
          role: message.role,
          content: message.content,
        }))
      );
    } catch (err) {
      console.error("Message loading error:", err);
    }
  }

  // =========================================================
  // CREATE CONVERSATION
  // =========================================================

  async function createConversation() {
    try {
      setError("");

      const response = await fetch(`${API_URL}/conversations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "New Chat",
        }),
      });

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      const data = await response.json();

      setActiveConversationId(data.id);
      setMessages([]);
      setSelectedDocuments([]);

      setConversations((previous) => [
        {
          id: data.id,
          title: data.title || "New Chat",
        },
        ...previous.filter(
          (conversation) => conversation.id !== data.id
        ),
      ]);

      setSidebarOpen(false);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Could not create a new conversation."
      );
    }
  }

  // =========================================================
  // SELECT CONVERSATION
  // =========================================================

  async function selectConversation(id: number) {
    setActiveConversationId(id);
    setMessages([]);
    setSelectedDocuments([]);
    setError("");
    setSidebarOpen(false);

    await loadMessages(id);
  }

  // =========================================================
  // FILE PICKER
  // =========================================================

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function handleFileSelection(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      setError("Please select a PDF file.");
      event.target.value = "";
      return;
    }

    setError("");
    setSelectedFile(file);
    setShowDocuments(true);
  }

  // =========================================================
  // UPLOAD PDF
  // =========================================================

  async function uploadPDF() {
    if (!selectedFile) {
      setError("Please select a PDF first.");
      return;
    }

    setUploading(true);
    setError("");

    try {
      // -----------------------------------------------------
      // CREATE CONVERSATION IF NEEDED
      // -----------------------------------------------------

      let conversationId = activeConversationId;

      if (conversationId === null) {
        const conversationResponse = await fetch(
          `${API_URL}/conversations`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title: "New Chat",
            }),
          }
        );

        if (!conversationResponse.ok) {
          throw new Error(
            await getErrorMessage(conversationResponse)
          );
        }

        const conversationData =
          await conversationResponse.json();

        conversationId = conversationData.id;

        setActiveConversationId(conversationId);

        setConversations((previous) => [
          {
            id: conversationData.id,
            title: conversationData.title || "New Chat",
          },
          ...previous,
        ]);
      }

      // -----------------------------------------------------
      // FORM DATA
      // -----------------------------------------------------

      const formData = new FormData();

      formData.append("file", selectedFile);
      formData.append(
        "conversation_id",
        String(conversationId)
      );

      // -----------------------------------------------------
      // SEND PDF
      // -----------------------------------------------------

      const response = await fetch(`${API_URL}/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(
          await getErrorMessage(response)
        );
      }

      const data = await response.json();

      // -----------------------------------------------------
      // DOCUMENT LIBRARY
      // -----------------------------------------------------

      const newDocument: DocumentInfo = {
        filename: data.filename || selectedFile.name,
        pages: Number(data.pages || 0),
        chunks: Number(data.chunks || 0),
      };

      setDocuments((previous) => {
        const withoutDuplicate = previous.filter(
          (document) =>
            document.filename !== newDocument.filename
        );

        return [newDocument, ...withoutDuplicate];
      });

      // Automatically select the uploaded document.
      setSelectedDocuments((previous) => {
        if (previous.includes(newDocument.filename)) {
          return previous;
        }

        return [...previous, newDocument.filename];
      });

      // -----------------------------------------------------
      // SUCCESS MESSAGE
      // -----------------------------------------------------

      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content:
            `I've processed "${newDocument.filename}" successfully.\n\n` +
            `Pages: ${newDocument.pages}\n` +
            `Chunks created: ${newDocument.chunks}\n\n` +
            `The document is ready. Ask me anything about it.`,
          source_type: "PDF",
        },
      ]);

      // -----------------------------------------------------
      // RESET
      // -----------------------------------------------------

      setSelectedFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      await loadDocuments();
    } catch (err) {
      console.error("PDF upload error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "PDF processing failed."
      );
    } finally {
      setUploading(false);
    }
  }

  // =========================================================
  // REMOVE SELECTED FILE
  // =========================================================

  function removeSelectedFile() {
    setSelectedFile(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    setError("");
  }

  // =========================================================
  // TOGGLE DOCUMENT
  // =========================================================

  function toggleDocument(filename: string) {
    setSelectedDocuments((previous) => {
      if (previous.includes(filename)) {
        return previous.filter(
          (name) => name !== filename
        );
      }

      return [...previous, filename];
    });
  }

  // =========================================================
  // SELECT ALL DOCUMENTS
  // =========================================================

  function selectAllDocuments() {
    setSelectedDocuments(
      documents.map((document) => document.filename)
    );
  }

  // =========================================================
  // CLEAR DOCUMENT SELECTION
  // =========================================================

  function clearDocumentSelection() {
    setSelectedDocuments([]);
  }

  // =========================================================
  // SEND MESSAGE
  // =========================================================

  async function sendMessage() {
    const trimmedQuestion = question.trim();

    if (!trimmedQuestion || loading || uploading) {
      return;
    }

    setError("");

    try {
      // -----------------------------------------------------
      // CREATE CHAT IF NEEDED
      // -----------------------------------------------------

      let conversationId = activeConversationId;

      if (conversationId === null) {
        const conversationResponse = await fetch(
          `${API_URL}/conversations`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title: "New Chat",
            }),
          }
        );

        if (!conversationResponse.ok) {
          throw new Error(
            await getErrorMessage(conversationResponse)
          );
        }

        const conversationData =
          await conversationResponse.json();

        conversationId = conversationData.id;

        setActiveConversationId(conversationId);

        setConversations((previous) => [
          {
            id: conversationData.id,
            title: conversationData.title || "New Chat",
          },
          ...previous,
        ]);
      }

      // -----------------------------------------------------
      // ADD USER MESSAGE
      // -----------------------------------------------------

      setMessages((previous) => [
        ...previous,
        {
          role: "user",
          content: trimmedQuestion,
        },
      ]);

      setQuestion("");
      setLoading(true);

      // -----------------------------------------------------
      // DETERMINE PDF MODE
      // -----------------------------------------------------

      const usingPDF =
        selectedDocuments.length > 0;

      /*
        Current backend supports one pdf_filename.

        Until the backend gets multi-document search,
        use the first selected PDF.

        We'll upgrade this backend next.
      */

      const selectedPDF =
        selectedDocuments.length > 0
          ? selectedDocuments[0]
          : null;

      // -----------------------------------------------------
      // CHAT REQUEST
      // -----------------------------------------------------

      const response = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          message: trimmedQuestion,
          use_pdf: usingPDF,
          pdf_filename: selectedPDF,
        }),
      });

      if (!response.ok) {
        throw new Error(
          await getErrorMessage(response)
        );
      }

      const data = await response.json();

      // -----------------------------------------------------
      // VALIDATE ANSWER
      // -----------------------------------------------------

      const answer =
        typeof data.answer === "string"
          ? data.answer
          : "The assistant returned an empty answer.";

      // -----------------------------------------------------
      // ADD ASSISTANT MESSAGE
      // -----------------------------------------------------

      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: answer,
          sources: Array.isArray(data.sources)
            ? data.sources
            : [],
          source_type:
            data.source_type ||
            (usingPDF ? "PDF" : "GENERAL"),
        },
      ]);

      // Refresh conversations because the title may change.
      await loadConversations();
    } catch (err) {
      console.error("Chat error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while getting the answer."
      );
    } finally {
      setLoading(false);
    }
  }

  // =========================================================
  // KEYBOARD
  // =========================================================

  function handleKeyDown(
    event: KeyboardEvent<HTMLTextAreaElement>
  ) {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();
      sendMessage();
    }
  }

  // =========================================================
  // QUICK QUESTION
  // =========================================================

  function useSuggestion(text: string) {
    setQuestion(text);
  }

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <main className="h-screen overflow-hidden bg-[#0a0a0a] text-white">
      <div className="flex h-full">

        {/* ===================================================
            MOBILE OVERLAY
        =================================================== */}

        {sidebarOpen && (
          <button
            aria-label="Close sidebar"
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-30 bg-black/70 md:hidden"
          />
        )}

        {/* ===================================================
            SIDEBAR
        =================================================== */}

        <aside
          className={`
            fixed inset-y-0 left-0 z-40
            flex w-[285px] flex-col
            border-r border-white/[0.08]
            bg-[#101010]
            transition-transform duration-200
            md:static md:z-auto md:translate-x-0
            ${
              sidebarOpen
                ? "translate-x-0"
                : "-translate-x-full"
            }
          `}
        >
          {/* Logo */}

          <div className="flex h-[72px] items-center border-b border-white/[0.08] px-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-black">
              ✦
            </div>

            <div className="ml-3">
              <div className="text-sm font-semibold">
                Knowledge Assistant
              </div>

              <div className="text-xs text-white/40">
                LLM + Basic RAG
              </div>
            </div>

            <button
              onClick={() => setSidebarOpen(false)}
              className="ml-auto rounded-lg p-2 text-white/40 hover:bg-white/[0.06] hover:text-white md:hidden"
            >
              ✕
            </button>
          </div>

          {/* New Chat */}

          <div className="p-4">
            <button
              onClick={createConversation}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
            >
              <span className="text-lg leading-none">
                +
              </span>
              New Chat
            </button>
          </div>

          {/* Conversations */}

          <div className="min-h-0 flex-1 overflow-y-auto px-3">
            <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-white/30">
              Recent chats
            </div>

            {conversations.length === 0 ? (
              <div className="px-2 py-4 text-sm text-white/30">
                No conversations yet.
              </div>
            ) : (
              <div className="space-y-1">
                {conversations.map(
                  (conversation) => (
                    <button
                      key={conversation.id}
                      onClick={() =>
                        selectConversation(
                          conversation.id
                        )
                      }
                      className={`
                        w-full truncate rounded-xl
                        px-3 py-3 text-left text-sm
                        transition
                        ${
                          activeConversationId ===
                          conversation.id
                            ? "bg-white/[0.09] text-white"
                            : "text-white/50 hover:bg-white/[0.05] hover:text-white"
                        }
                      `}
                    >
                      <div className="truncate">
                        {conversation.title ||
                          "New Chat"}
                      </div>
                    </button>
                  )
                )}
              </div>
            )}
          </div>

          {/* Sidebar Footer */}

          <div className="border-t border-white/[0.08] p-4">
            <button
              onClick={() =>
                setShowDocuments(
                  !showDocuments
                )
              }
              className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-sm text-white/60 transition hover:bg-white/[0.05] hover:text-white"
            >
              <span className="flex items-center gap-2">
                <span>▣</span>
                Documents
              </span>

              <span className="text-xs text-white/30">
                {documents.length}
              </span>
            </button>
          </div>
        </aside>

        {/* ===================================================
            MAIN APPLICATION
        =================================================== */}

        <section className="flex min-w-0 flex-1 flex-col">

          {/* =================================================
              HEADER
          ================================================= */}

          <header className="flex h-[72px] flex-shrink-0 items-center border-b border-white/[0.08] bg-[#0a0a0a] px-4 md:px-7">

            <button
              onClick={() =>
                setSidebarOpen(true)
              }
              className="mr-3 rounded-lg p-2 text-white/50 hover:bg-white/[0.06] hover:text-white md:hidden"
            >
              ☰
            </button>

            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold md:text-base">
                {activeConversationId
                  ? conversations.find(
                      (conversation) =>
                        conversation.id ===
                        activeConversationId
                    )?.title ||
                    "Knowledge Assistant"
                  : "Knowledge Assistant"}
              </h1>

              <p className="text-xs text-white/35">
                {selectedDocuments.length > 0
                  ? `${selectedDocuments.length} document${
                      selectedDocuments.length ===
                      1
                        ? ""
                        : "s"
                    } selected`
                  : "General AI mode"}
              </p>
            </div>

            <div className="ml-auto flex items-center gap-2">

              <button
                onClick={() =>
                  setShowDocuments(
                    !showDocuments
                  )
                }
                className="hidden items-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.03] px-3 py-2 text-xs text-white/60 transition hover:bg-white/[0.07] hover:text-white sm:flex"
              >
                <span>▣</span>
                Documents
                {documents.length > 0 && (
                  <span className="rounded-md bg-white/[0.08] px-1.5 py-0.5 text-[10px]">
                    {documents.length}
                  </span>
                )}
              </button>

              <button
                onClick={createConversation}
                className="rounded-xl border border-white/[0.09] bg-white/[0.03] px-3 py-2 text-xs text-white/60 transition hover:bg-white/[0.07] hover:text-white"
              >
                + New
              </button>

            </div>
          </header>

          {/* =================================================
              CHAT WORKSPACE
          ================================================= */}

          <div className="relative min-h-0 flex-1">

            {/* CHAT SCROLL AREA */}

            <div
              ref={chatContainerRef}
              className="absolute inset-0 overflow-y-auto"
            >
              <div className="mx-auto min-h-full w-full max-w-4xl px-4 pb-48 pt-8 md:px-8">

                {/* ===========================================
                    EMPTY STATE
                =========================================== */}

                {messages.length === 0 && (
                  <div className="flex min-h-[65vh] items-center justify-center">
                    <div className="w-full max-w-2xl text-center">

                      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.1] bg-white/[0.04] text-3xl">
                        ✦
                      </div>

                      <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
                        What can I help you with?
                      </h2>

                      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/40 md:text-base">
                        Ask questions using general AI
                        knowledge or upload your PDFs
                        and let the assistant find the
                        relevant information for you.
                      </p>

                      <div className="mt-8 grid gap-3 sm:grid-cols-3">

                        <button
                          onClick={() =>
                            useSuggestion(
                              "What is SQL?"
                            )
                          }
                          className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 text-left transition hover:border-white/[0.15] hover:bg-white/[0.05]"
                        >
                          <div className="mb-2 text-lg">
                            ✦
                          </div>

                          <div className="text-sm font-medium">
                            General question
                          </div>

                          <div className="mt-1 text-xs text-white/35">
                            Ask about any topic
                          </div>
                        </button>

                        <button
                          onClick={() =>
                            openFilePicker()
                          }
                          className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 text-left transition hover:border-white/[0.15] hover:bg-white/[0.05]"
                        >
                          <div className="mb-2 text-lg">
                            📄
                          </div>

                          <div className="text-sm font-medium">
                            Upload a PDF
                          </div>

                          <div className="mt-1 text-xs text-white/35">
                            Add your study notes
                          </div>
                        </button>

                        <button
                          onClick={() =>
                            useSuggestion(
                              "Summarize the main points."
                            )
                          }
                          className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 text-left transition hover:border-white/[0.15] hover:bg-white/[0.05]"
                        >
                          <div className="mb-2 text-lg">
                            ◌
                          </div>

                          <div className="text-sm font-medium">
                            Summarize
                          </div>

                          <div className="mt-1 text-xs text-white/35">
                            Get key points quickly
                          </div>
                        </button>

                      </div>

                    </div>
                  </div>
                )}

                {/* ===========================================
                    MESSAGES
                =========================================== */}

                <div className="space-y-7">

                  {messages.map(
                    (message, index) => {

                      const isUser =
                        message.role === "user";

                      return (
                        <div
                          key={`${message.role}-${index}`}
                          data-last-message={
                            index === messages.length - 1
                              ? "true"
                              : "false"
                          }
                          className={`flex ${
                            isUser
                              ? "justify-end"
                              : "justify-start"
                          }`}
                        >

                          <div
                            className={`flex max-w-[90%] gap-3 md:max-w-[82%] ${
                              isUser
                                ? "flex-row-reverse"
                                : ""
                            }`}
                          >

                            {/* Avatar */}

                            {!isUser && (
                              <div className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-sm">
                                ✦
                              </div>
                            )}

                            {/* Message */}

                            <div>

                              <div
                                className={`
                                  rounded-2xl px-4 py-3.5
                                  text-sm leading-7
                                  ${
                                    isUser
                                      ? "rounded-br-md bg-white text-black"
                                      : "rounded-bl-md border border-white/[0.08] bg-[#111111] text-white/85"
                                  }
                                `}
                              >
                                <div className="whitespace-pre-wrap">
                                  {message.content}
                                </div>
                              </div>

                              {/* Source Type */}

                              {!isUser &&
                                message.source_type && (
                                  <div className="mt-2 flex items-center gap-2 px-1 text-[11px] text-white/30">
                                    <span>
                                      {message.source_type ===
                                      "PDF"
                                        ? "📄"
                                        : message.source_type ===
                                          "WEB"
                                        ? "🌐"
                                        : "✦"}
                                    </span>

                                    <span>
                                      {message.source_type ===
                                      "PDF"
                                        ? "Based on your documents"
                                        : message.source_type ===
                                          "WEB"
                                        ? "Web information"
                                        : "General AI"}
                                    </span>
                                  </div>
                                )}

                              {/* Sources */}

                              {!isUser &&
                                message.sources &&
                                message.sources.length >
                                  0 && (
                                  <div className="mt-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">

                                    <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">
                                      Sources
                                    </div>

                                    <div className="grid gap-2 sm:grid-cols-2">
                                      {message.sources.map(
                                        (
                                          source,
                                          sourceIndex
                                        ) => (
                                          <div
                                            key={`${source.filename}-${source.page}-${sourceIndex}`}
                                            className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2"
                                          >
                                            <div className="flex items-center gap-2 text-xs font-medium text-white/70">
                                              <span>
                                                📄
                                              </span>

                                              <span className="truncate">
                                                {
                                                  source.filename
                                                }
                                              </span>
                                            </div>

                                            <div className="mt-1 text-[11px] text-white/30">
                                              Page{" "}
                                              {
                                                source.page
                                              }
                                            </div>
                                          </div>
                                        )
                                      )}
                                    </div>

                                  </div>
                                )}

                            </div>

                          </div>

                        </div>
                      );
                    }
                  )}

                  {/* =========================================
                      LOADING
                  ========================================= */}

                  {loading && (
                    <div className="flex justify-start">
                      <div className="flex gap-3">

                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04]">
                          ✦
                        </div>

                        <div className="rounded-2xl rounded-bl-md border border-white/[0.08] bg-[#111111] px-5 py-4">

                          <div className="flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/50" />
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/50 [animation-delay:150ms]" />
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/50 [animation-delay:300ms]" />
                          </div>

                        </div>

                      </div>
                    </div>
                  )}

                </div>

              </div>
            </div>

            {/* =================================================
                DOCUMENT PANEL
            ================================================= */}

            {showDocuments && (
              <div className="absolute right-4 top-4 z-20 w-[min(390px,calc(100%-2rem))] rounded-2xl border border-white/[0.1] bg-[#141414]/95 p-4 shadow-2xl backdrop-blur-xl">

                <div className="flex items-center justify-between">

                  <div>
                    <div className="text-sm font-semibold">
                      Your documents
                    </div>

                    <div className="mt-1 text-xs text-white/35">
                      Select PDFs to use for your
                      questions.
                    </div>
                  </div>

                  <button
                    onClick={() =>
                      setShowDocuments(false)
                    }
                    className="rounded-lg p-2 text-white/40 hover:bg-white/[0.06] hover:text-white"
                  >
                    ✕
                  </button>

                </div>

                <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">

                  {documents.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-white/[0.1] p-5 text-center">
                      <div className="text-2xl">
                        📄
                      </div>

                      <p className="mt-2 text-xs text-white/40">
                        No PDFs uploaded yet.
                      </p>
                    </div>
                  ) : (
                    documents.map(
                      (document) => {

                        const selected =
                          selectedDocuments.includes(
                            document.filename
                          );

                        return (
                          <button
                            key={document.filename}
                            onClick={() =>
                              toggleDocument(
                                document.filename
                              )
                            }
                            className={`
                              flex w-full items-center gap-3 rounded-xl border p-3 text-left transition
                              ${
                                selected
                                  ? "border-white/[0.16] bg-white/[0.07]"
                                  : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05]"
                              }
                            `}
                          >

                            <div
                              className={`
                                flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-sm
                                ${
                                  selected
                                    ? "bg-white text-black"
                                    : "bg-white/[0.06]"
                                }
                              `}
                            >
                              {selected
                                ? "✓"
                                : "📄"}
                            </div>

                            <div className="min-w-0 flex-1">

                              <div className="truncate text-xs font-medium text-white/75">
                                {
                                  document.filename
                                }
                              </div>

                              <div className="mt-1 text-[10px] text-white/30">
                                {
                                  document.pages
                                }{" "}
                                pages •{" "}
                                {
                                  document.chunks
                                }{" "}
                                chunks
                              </div>

                            </div>

                          </button>
                        );
                      }
                    )
                  )}

                </div>

                <div className="mt-3 flex gap-2">

                  <button
                    onClick={selectAllDocuments}
                    disabled={
                      documents.length === 0
                    }
                    className="flex-1 rounded-lg border border-white/[0.08] px-3 py-2 text-[11px] text-white/50 hover:bg-white/[0.05] hover:text-white disabled:opacity-30"
                  >
                    Select all
                  </button>

                  <button
                    onClick={clearDocumentSelection}
                    className="flex-1 rounded-lg border border-white/[0.08] px-3 py-2 text-[11px] text-white/50 hover:bg-white/[0.05] hover:text-white"
                  >
                    Clear
                  </button>

                </div>

              </div>
            )}

          </div>

          {/* =================================================
              FIXED COMPOSER AREA
          ================================================= */}

          <div className="relative z-10 flex-shrink-0 border-t border-white/[0.08] bg-[#0a0a0a] px-4 pb-4 pt-3 md:px-8">

            <div className="mx-auto max-w-4xl">

              {/* ERROR */}

              {error && (
                <div className="mb-3 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-xs text-red-300">

                  <span className="mt-0.5">
                    ⚠
                  </span>

                  <span className="flex-1">
                    {error}
                  </span>

                  <button
                    onClick={() => setError("")}
                    className="text-red-300/50 hover:text-red-200"
                  >
                    ✕
                  </button>

                </div>
              )}

              {/* SELECTED FILE */}

              {selectedFile && (
                <div className="mb-3 flex items-center gap-3 rounded-xl border border-white/[0.09] bg-[#121212] px-3 py-2.5">

                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white/[0.06]">
                    📄
                  </div>

                  <div className="min-w-0 flex-1">

                    <div className="truncate text-xs font-medium text-white/75">
                      {selectedFile.name}
                    </div>

                    <div className="mt-0.5 text-[10px] text-white/30">
                      Ready to process
                    </div>

                  </div>

                  <button
                    onClick={uploadPDF}
                    disabled={uploading}
                    className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black transition hover:bg-white/90 disabled:opacity-50"
                  >
                    {uploading
                      ? "Processing..."
                      : "Process PDF"}
                  </button>

                  <button
                    onClick={
                      removeSelectedFile
                    }
                    disabled={uploading}
                    className="rounded-lg p-2 text-white/35 hover:bg-white/[0.06] hover:text-white disabled:opacity-30"
                  >
                    ✕
                  </button>

                </div>
              )}

              {/* PROCESSING */}

              {uploading && (
                <div className="mb-3 flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-xs text-white/50">

                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/10 border-t-white/70" />

                  <span>
                    Extracting text, creating
                    embeddings and storing your
                    PDF...
                  </span>

                </div>
              )}

              {/* COMPOSER */}

              <div className="rounded-2xl border border-white/[0.1] bg-[#121212] shadow-2xl shadow-black/30 transition focus-within:border-white/[0.18]">

                <textarea
                  value={question}
                  onChange={(event) =>
                    setQuestion(
                      event.target.value
                    )
                  }
                  onKeyDown={handleKeyDown}
                  placeholder={
                    selectedDocuments.length >
                    0
                      ? "Ask about your selected documents..."
                      : "Ask anything..."
                  }
                  rows={1}
                  className="max-h-40 min-h-[52px] w-full resize-none bg-transparent px-4 pt-4 text-sm leading-6 text-white outline-none placeholder:text-white/25"
                />

                <div className="flex items-center justify-between px-2 pb-2 pt-2">

                  <div className="flex items-center gap-1">

                    {/* UPLOAD */}

                    <button
                      onClick={
                        openFilePicker
                      }
                      disabled={uploading}
                      className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-white/40 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-30"
                    >
                      <span className="text-base">
                        +
                      </span>

                      <span className="hidden sm:inline">
                        Upload PDF
                      </span>
                    </button>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,application/pdf"
                      onChange={
                        handleFileSelection
                      }
                      className="hidden"
                    />

                    {/* DOCUMENTS */}

                    <button
                      onClick={() =>
                        setShowDocuments(
                          !showDocuments
                        )
                      }
                      disabled={
                        documents.length === 0
                      }
                      className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-white/40 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-30"
                    >
                      <span>▣</span>

                      <span className="hidden sm:inline">
                        Documents
                      </span>

                      {selectedDocuments.length >
                        0 && (
                        <span className="rounded-md bg-white/[0.08] px-1.5 py-0.5 text-[9px] text-white/60">
                          {
                            selectedDocuments.length
                          }
                        </span>
                      )}
                    </button>

                  </div>

                  {/* SEND */}

                  <button
                    onClick={sendMessage}
                    disabled={
                      loading ||
                      uploading ||
                      !question.trim()
                    }
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-25"
                    aria-label="Send message"
                  >
                    ↑
                  </button>

                </div>

              </div>

              <div className="mt-2 text-center text-[10px] text-white/20">
                Enter to send • Shift + Enter for a
                new line
              </div>

            </div>

          </div>

        </section>
      </div>
    </main>
  );
}