# n8n-nodes-voyageai

This is an n8n community node package that provides [Voyage AI by MongoDB](https://voyageai.com) embedding and reranking nodes for use in n8n workflows.

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

### Embeddings Voyage AI by MongoDB

Generate text embeddings using Voyage AI by MongoDB's embedding models. Uses the official `voyageai` SDK directly.

**Supported models:**

| Model | Default Dimensions | Flexible Dimensions | Description |
|-------|-------------------|---------------------|-------------|
| voyage-4-large | 1024 | 256, 512, 1024, 2048 | Flagship model, best general-purpose and multilingual quality |
| voyage-4 *(default)* | 1024 | 256, 512, 1024, 2048 | General-purpose model, strong quality |
| voyage-4-lite | 1024 | 256, 512, 1024, 2048 | Optimized for latency and cost |
| voyage-4-nano | 1024 | 256, 512, 1024, 2048 | Open-weight model, smallest and fastest |
| voyage-code-4 | 1024 | 256, 512, 1024, 2048 | Optimized for code retrieval and coding agent use cases |
| voyage-code-3 | 1024 | 256, 512, 1024, 2048 | Optimized for code retrieval |
| voyage-finance-2 | 1024 | - | Optimized for finance domain |
| voyage-law-2 | 1024 | - | Optimized for legal domain |
| voyage-multilingual-2 | 1024 | - | Optimized for multilingual content |
| voyage-3.5 | 1024 | 256, 512, 1024, 2048 | Previous generation general-purpose |
| voyage-3.5-lite | 1024 | 256, 512, 1024, 2048 | Previous generation lite |
| voyage-3-large | 1024 | 256, 512, 1024, 2048 | Previous generation large |

Requests are split by the model's per-request token limit (counted with the SDK tokenizer) and the 1,000 input limit; vectors come back in input order. The SDK tokenizer needs `@huggingface/transformers`, which this package installs, and downloads tokenizer files from Hugging Face on first use.

**Options:** batch size, input type (query/document), output dimension (256/512/1024/2048), truncation, encoding format, output data type (float/int8/uint8/binary/ubinary).

Output dimension and output data type are shown conditionally for models that support flexible dimensions (voyage-4*, voyage-code-4, voyage-3.5*, voyage-3-large, voyage-code-3).

### Embeddings Voyage AI by MongoDB Multimodal

Generate multimodal embeddings from text, images, or both using Voyage AI by MongoDB multimodal models.

**Supported models:**

| Model | Description |
|-------|-------------|
| voyage-multimodal-3.5 *(default)* | Latest multimodal model, supports text, images, and video screenshots |
| voyage-multimodal-3 | Previous generation multimodal model |

**Content types:** Text only, Image URL only, Text + Image URL, Binary image only, Text + Binary image.

### Embeddings Voyage AI by MongoDB Contextualized

Generate context-aware embeddings with `voyage-context-4` or `voyage-context-3` (default). Each input item is one **whole document**: the API splits it into chunks (`enable_auto_chunking`, chunk size 32,000 tokens) and embeds every chunk with the context of the whole document. Requests are split by the 120,000 token and 1,000 document limits.

With the 32,000 token chunk size, a document stays one chunk unless it is longer than 32,000 tokens. Only such a document produces several embeddings, and then the result is longer than the input list. Do not send pre-chunked text: send one item per document, with a unique document ID. Do not split the documents with a text splitter before they reach this node's embeddings output, because embeddings are looked up by the exact document text.

> **Breaking change in 0.2.0:** earlier versions expected pre-chunked text, with several items sharing a document ID. Items that share a document ID are now rejected; send each whole document once.

**Required fields:** Document ID field (each ID once), Text field (the whole document as a string).

### Reranker Voyage AI by MongoDB

Reorder documents by relevance to a query using Voyage AI by MongoDB's rerank models.

> **Known Limitation:** `NodeConnectionTypes.AiReranker` does not currently work for n8n community nodes. This node is included for completeness but will not function until n8n lifts this restriction.

**Supported models:** rerank-3, rerank-3-lite, rerank-2.5 *(default)*, rerank-2.5-lite, rerank-2, rerank-2-lite.

## Credentials

This package requires a **Voyage AI by MongoDB API** credential with your API key.

1. Sign up at [Voyage AI by MongoDB](https://dash.voyageai.com/)
2. Get your API key from the dashboard
3. In n8n, create a new **Voyage AI by MongoDB API** credential and paste your API key

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
