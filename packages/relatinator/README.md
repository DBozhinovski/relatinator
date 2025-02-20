# Relatinator

A TypeScript library for finding related documents using TF-IDF and BM25 algorithms.

## Installation

```bash
npm install relatinator
# or
pnpm add relatinator
# or
yarn add relatinator
```

## Features

- Two similarity algorithms: TF-IDF and BM25
- Find related documents based on content similarity
- Get top terms for a document
- Find documents related to a specific term
- Written in TypeScript with full type support

## Usage

```typescript
import {
  getInstance,
  train,
  findRelated,
  getTopTermsForId,
  getTopRelatedDocumentsForTerm,
} from "relatinator";

// Initialize with your preferred algorithm
await getInstance("bm25"); // or 'tfidf'

// Train the model with your documents
const documents = [
  { id: "doc1", content: "This is the first document about cats." },
  { id: "doc2", content: "Another document about dogs." },
  { id: "doc3", content: "A document about both cats and dogs." },
];

await train(documents);

// Find related documents
const related = await findRelated("A document about cats", "doc1", 2);
console.log(related); // ['doc3', 'doc2']

// Get top terms for a document
const terms = await getTopTermsForId("doc1");
console.log(terms); // [{ term: 'cats', score: 0.8 }, ...]

// Find documents related to a term
const relatedDocs = await getTopRelatedDocumentsForTerm("cats");
console.log(relatedDocs); // ['doc1', 'doc3']
```

## API

### `getInstance(algorithm?: 'tfidf' | 'bm25')`

Initializes or returns the current instance with the specified algorithm.

### `train(documents: Document[], debug?: boolean)`

Trains the model with the provided documents.

### `findRelated(documentToCompare: string, id: string, topN?: number, debug?: boolean)`

Finds documents related to the input document.

### `getTopTermsForId(id: string, topN?: number, debug?: boolean)`

Gets the top terms for a document by its ID.

### `getTopRelatedDocumentsForTerm(term: string, topN?: number)`

Finds documents related to a specific term.

## Development

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test
```

## License

MIT
