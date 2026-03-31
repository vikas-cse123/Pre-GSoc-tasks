
declare module "../../helpers/elasticlunr" {
  /**
   * A minimal full-text search index.
   * The constructor accepts a document ID field name followed by one or
   * more field names to index.
   *
   * @example
   * const index = new Elasticlunr("id", "id", "title", "summary");
   * index.addDocToIndex({ id: "1", title: "Hello", summary: "World" });
   * const results = index.searchFromIndex("hello");
   */
  export default class Elasticlunr {
    /**
     * @param idField  - name of the field used as the document identifier
     * @param fields   - one or more field names to include in the index
     */
    constructor(idField: string, ...fields: string[]);

    /**
     * Adds a document to the search index.
     * The document must contain the idField specified in the constructor.
     * @param doc - plain object to index
     */
    addDocToIndex(doc: Record<string, unknown>): void;

    /**
     * Searches the index for a given query string.
     * Returns an array of matching documents (the full stored objects).
     * @param query - search string
     */
    searchFromIndex(query: string): Record<string, unknown>[];

    /**
     * Returns all documents currently in the index.
     */
    getAllDocs(): Record<string, unknown>[];
  }
}
