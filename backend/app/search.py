from sqlalchemy import text

from .database import engine
from .embeddings import create_embedding


def search_similar_chunks(
    query: str,
    limit: int = 8,
    filename: str | None = None,
):

    print("\n" + "=" * 60)
    print("[SEARCH] VECTOR SEARCH")
    print("=" * 60)

    print("[SEARCH] Query:", query)
    print("[SEARCH] Filename:", filename)

    query_embedding = create_embedding(
        query
    )

    print(
        "[SEARCH] Query embedding created."
    )

    with engine.connect() as connection:

        if filename:

            result = connection.execute(
                text("""
                    SELECT
                        id,
                        filename,
                        page,
                        content,
                        embedding <=> CAST(
                            :embedding AS vector
                        ) AS distance

                    FROM documents

                    WHERE embedding IS NOT NULL

                    AND filename = :filename

                    ORDER BY embedding <=> CAST(
                        :embedding AS vector
                    )

                    LIMIT :limit
                """),
                {
                    "embedding": str(
                        query_embedding
                    ),
                    "filename": filename,
                    "limit": limit,
                },
            )

        else:

            result = connection.execute(
                text("""
                    SELECT
                        id,
                        filename,
                        page,
                        content,
                        embedding <=> CAST(
                            :embedding AS vector
                        ) AS distance

                    FROM documents

                    WHERE embedding IS NOT NULL

                    ORDER BY embedding <=> CAST(
                        :embedding AS vector
                    )

                    LIMIT :limit
                """),
                {
                    "embedding": str(
                        query_embedding
                    ),
                    "limit": limit,
                },
            )

        rows = result.fetchall()

    print(
        "[SEARCH] Results:",
        len(rows),
    )

    for row in rows:

        print(
            f"[SEARCH] "
            f"{row.filename} | "
            f"page={row.page} | "
            f"distance={row.distance:.4f}"
        )

    return rows