from sqlalchemy import create_engine, text


DATABASE_URL = "postgresql+psycopg://raguser:ragpassword@localhost:5432/ragdb"

engine = create_engine(DATABASE_URL)


def save_chunk(filename, page, content, embedding=None):

    with engine.connect() as connection:

        connection.execute(
            text("""
                INSERT INTO documents
                (filename, page, content, embedding)
                VALUES (:filename, :page, :content, :embedding)
            """),
            {
                "filename": filename,
                "page": page,
                "content": content,
                "embedding": embedding
            }
        )

        connection.commit()


def get_chunks_without_embeddings():

    with engine.connect() as connection:

        result = connection.execute(
            text("""
                SELECT id, content
                FROM documents
                WHERE embedding IS NULL
                ORDER BY id
            """)
        )

        return result.fetchall()


def update_embedding(document_id, embedding):

    with engine.connect() as connection:

        connection.execute(
            text("""
                UPDATE documents
                SET embedding = CAST(:embedding AS vector)
                WHERE id = :document_id
            """),
            {
                "document_id": document_id,
                "embedding": str(embedding)
            }
        )

        connection.commit()


def create_conversation(title="New Chat"):

    with engine.connect() as connection:

        result = connection.execute(
            text("""
                INSERT INTO conversations (title)
                VALUES (:title)
                RETURNING id
            """),
            {
                "title": title
            }
        )

        conversation_id = result.fetchone().id

        connection.commit()

        return conversation_id


def update_conversation_title(conversation_id, title):

    with engine.connect() as connection:

        connection.execute(
            text("""
                UPDATE conversations
                SET title = :title
                WHERE id = :conversation_id
            """),
            {
                "conversation_id": conversation_id,
                "title": title
            }
        )

        connection.commit()


def save_message(conversation_id, role, content):

    with engine.connect() as connection:

        connection.execute(
            text("""
                INSERT INTO messages
                (conversation_id, role, content)
                VALUES (:conversation_id, :role, :content)
            """),
            {
                "conversation_id": conversation_id,
                "role": role,
                "content": content
            }
        )

        connection.commit()


def get_conversation_messages(conversation_id):

    with engine.connect() as connection:

        result = connection.execute(
            text("""
                SELECT role, content
                FROM messages
                WHERE conversation_id = :conversation_id
                ORDER BY created_at ASC, id ASC
            """),
            {
                "conversation_id": conversation_id
            }
        )

        return result.fetchall()


def get_messages(conversation_id):

    return get_conversation_messages(conversation_id)