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

Generate text embeddings using VoyageAI's embedding models. Uses the official `voyageai` SDK directly.

**Supported models:**

| Model | Default Dimensions | Flexible Dimensions | Description |
|-------|-------------------|---------------------|-------------|
| voyage-4-large | 1024 | 256, 512, 1024, 2048 | Flagship model, best general-purpose and multilingual quality |
| voyage-4 *(default)* | 1024 | 256, 512, 1024, 2048 | General-purpose model, strong quality |
| voyage-4-lite | 1024 | 256, 512, 1024, 2048 | Optimized for latency and cost |
| voyage-4-nano | 1024 | 256, 512, 1024, 2048 | Open-weight model, smallest and fastest |
| voyage-code-3 | 1024 | 256, 512, 1024, 2048 | Optimized for code retrieval |
| voyage-finance-2 | 1024 | - | Optimized for finance domain |
| voyage-law-2 | 1024 | - | Optimized for legal domain |
| voyage-multilingual-2 | 1024 | - | Optimized for multilingual content |
| voyage-3.5 | 1024 | 256, 512, 1024, 2048 | Previous generation general-purpose |
| voyage-3.5-lite | 1024 | 256, 512, 1024, 2048 | Previous generation lite |
| voyage-3-large | 1024 | 256, 512, 1024, 2048 | Previous generation large |

**Options:** batch size, input type (query/document), output dimension (256/512/1024/2048), truncation, encoding format, output data type (float/int8/uint8/binary/ubinary).

Output dimension and output data type are shown conditionally for models that support flexible dimensions (voyage-4*, voyage-3.5*, voyage-3-large, voyage-code-3).

### Embeddings VoyageAI Multimodal

Generate multimodal embeddings from text, images, or both using VoyageAI multimodal models.

**Supported models:**

| Model | Description |
|-------|-------------|
| voyage-multimodal-3.5 | Latest multimodal model, supports text, images, and video screenshots |
| voyage-multimodal-3 *(default)* | Previous generation multimodal model |

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
