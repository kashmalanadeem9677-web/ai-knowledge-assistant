from app.database import get_chunks_without_embeddings, update_embedding
from app.embeddings import create_embedding


chunks = get_chunks_without_embeddings()

print(f"Found {len(chunks)} chunks without embeddings.")

for chunk in chunks:
    document_id = chunk.id
    content = chunk.content

    print(f"Creating embedding for chunk {document_id}...")

    embedding = create_embedding(content)

    update_embedding(document_id, embedding)

    print(f"Saved embedding for chunk {document_id}.")

print("All embeddings generated successfully!")