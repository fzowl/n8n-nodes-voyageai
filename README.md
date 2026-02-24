# n8n-nodes-voyageai

This is an n8n community node package that provides [VoyageAI](https://voyageai.com) embedding and reranking nodes for use in n8n workflows.

## Installation

In your n8n instance, go to **Settings > Community Nodes** and install:

```
n8n-nodes-voyageai
```

Or install via npm:

```bash
npm install n8n-nodes-voyageai
```

## Nodes

### Embeddings VoyageAI

Generate text embeddings using VoyageAI's embedding models.

**Supported models:**

| Model | Dimensions | Description |
|-------|-----------|-------------|
| voyage-3.5 | 1024 | Latest general-purpose, best quality |
| voyage-3.5-lite | 1024 | Optimized for latency and cost |
| voyage-3-large | 1024 | Previous generation general-purpose |
| voyage-code-3 | 1024 | Optimized for code retrieval |
| voyage-finance-2 | 1024 | Optimized for finance domain |
| voyage-law-2 | 1024 | Optimized for legal domain |
| voyage-multilingual-2 | 1024 | Optimized for multilingual content |

**Options:** batch size, input type (query/document), output dimension (256/512/1024/2048), truncation, encoding format, output data type.

### Embeddings VoyageAI Multimodal

Generate multimodal embeddings from text, images, or both using the `voyage-multimodal-3` model.

**Content types:** Text only, Image URL only, Text + Image URL, Binary image only, Text + Binary image.

### Embeddings VoyageAI Contextualized

Generate context-aware embeddings for document chunks using the `voyage-context-3` model. Chunks with the same document ID are processed together to preserve inter-chunk relationships.

**Required fields:** Document ID field, Text field.

### Reranker VoyageAI

Reorder documents by relevance to a query using VoyageAI's rerank models.

> **Known Limitation:** `NodeConnectionTypes.AiReranker` does not currently work for n8n community nodes. This node is included for completeness but will not function until n8n lifts this restriction.

**Supported models:** rerank-2.5, rerank-2.5-lite, rerank-2, rerank-2-lite.

## Credentials

This package requires a **VoyageAI API** credential with your API key.

1. Sign up at [VoyageAI](https://dash.voyageai.com/)
2. Get your API key from the dashboard
3. In n8n, create a new **VoyageAI API** credential and paste your API key

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run unit tests
npm run test:unit

# Run integration tests (requires VOYAGE_API_KEY)
VOYAGE_API_KEY=your-key npm run test:integration

# Run tests with coverage
npm run test:coverage

# Lint
npm run lint
```

## License

[MIT](LICENSE)
