import os
from fastembed import TextEmbedding
from app.database import AsyncSessionLocal
from app.models import DocumentVector

# Initialize the embedding model globally so it loads into memory once.
# This specific model natively outputs the exact 384 dimensions specified in your DB schema.
embedding_model = TextEmbedding(model_name="sentence-transformers/all-MiniLM-L6-v2")

def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50):
    """Splits text into precise fragments with overlapping windows to preserve context."""
    chunks = []
    start = 0
    text_length = len(text)
    
    while start < text_length:
        end = start + chunk_size
        chunks.append(text[start:end])
        start += chunk_size - overlap
        
    return chunks

async def process_document_task(conversation_id: int, file_path: str):
    """Background worker that processes the document asynchronously."""
    try:
        # 1. Read the raw text
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()

        # 2. Chunk into overlapping fragments
        text_chunks = chunk_text(content)

        # 3. Generate CPU-bound 384-dimensional vectors
        embeddings = list(embedding_model.embed(text_chunks))

        # 4. Save directly into the specialized vector database table
        async with AsyncSessionLocal() as db:
            for chunk, emb in zip(text_chunks, embeddings):
                doc_vec = DocumentVector(
                    conversation_id=conversation_id,
                    text_chunk=chunk,
                    embedding_matrix=emb.tolist()
                )
                db.add(doc_vec)
            
            await db.commit()
    
    finally:
        # 5. Guaranteed cleanup: Delete the ephemeral RAG file to prevent storage bloat
        if os.path.exists(file_path):
            os.remove(file_path)
