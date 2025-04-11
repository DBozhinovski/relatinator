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
import { BM25Utils, TfIdfUtils } from "relatinator";

// Example using BM25Utils. TfIdfUtils works similarly.

// Ensure the instance is initialized (happens automatically on first use)
await BM25Utils.getInstance();

// Train the model with your documents
const documents = [
  { id: "doc1", content: "This is the first document about cats." },
  { id: "doc2", content: "Another document about dogs." },
  { id: "doc3", content: "A document about both cats and dogs." },
];

await BM25Utils.train(documents);

// Find related documents
const related = await BM25Utils.findRelated("A document about cats", "doc1", 2);
console.log(related); // ['doc3', 'doc2']

// Get top terms for a document
const terms = await BM25Utils.getTopTermsForId("doc1");
console.log(terms); // [{ term: 'cats', score: 0.8 }, ...]

// Find documents related to a term
const relatedDocs = await BM25Utils.getTopRelatedDocumentsForTerm("cats");
console.log(relatedDocs); // ['doc1', 'doc3']
```

## API

The library exports two main utility objects: `BM25Utils` and `TfIdfUtils`.

### `BM25Utils` / `TfIdfUtils`

These objects contain the methods for interacting with the respective algorithms.

#### `getInstance(): Promise<BM25VectorizerType | TfIdf>`

Returns a promise that resolves with the singleton instance of the vectorizer/model. Ensures the underlying NLP model is initialized. Usually not needed for direct use, as other methods call it internally.

#### `resetInstance(): Promise<BM25VectorizerType | TfIdf>`

Resets the singleton instance, clearing all learned data and the internal document map. Returns the new, empty instance. Necessary if you need to retrain from scratch without restarting the application.

#### `train(documents: RelatinatorDocument[], debug?: boolean): Promise<void>`

Trains the model with the provided documents. `RelatinatorDocument` is `{ id: string, content: string }`.

#### `findRelated(documentToCompare: string, id: string, topN?: number, debug?: boolean): Promise<string[]>`

Finds document IDs related to the input `documentToCompare` string. Excludes the document with the provided `id` from the results. Returns an array of related document IDs, sorted by relevance.

#### `getTopTermsForId(id: string, topN?: number, debug?: boolean): Promise<{ term: string, score: number }[]>`

Gets the top terms (and their scores) for a document specified by its `id`.

#### `getTopRelatedDocumentsForTerm(term: string, topN?: number, debug?: boolean): Promise<string[]>`

Finds document IDs related to a specific `term`. Returns an array of related document IDs, sorted by relevance.

## Development

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test
```

## License

MIT
