import PDFDocument from 'core/pdf-document/PDFDocument';
import PDFObjectIndex from 'core/pdf-document/PDFObjectIndex';
import {
  PDFArray,
  PDFIndirectReference,
  PDFName,
  PDFObject,
  PDFStream,
} from 'core/pdf-objects';
import PDFParser, { IParsedPDF } from 'core/pdf-parser/PDFParser';
import { PDFCatalog, PDFObjectStream, PDFPageTree } from 'core/pdf-structures';
import { isInstance, validate } from 'utils/validate';

class PDFDocumentFactory {
  /**
   * Creates a new [[PDFDocument]] object. Useful for creating new PDF documents.
   *
   * @returns The new [[PDFDocument]] object.
   */
  static create = (): PDFDocument => {
    const index = PDFObjectIndex.create();
    const refs = {
      catalog: PDFIndirectReference.forNumbers(1, 0),
      pageTree: PDFIndirectReference.forNumbers(2, 0),
    };

    const catalog = PDFCatalog.create(refs.pageTree, index);
    const pageTree = PDFPageTree.createRootNode(
      PDFArray.fromArray([], index),
      index,
    );

    index.set(refs.catalog, catalog);
    index.set(refs.pageTree, pageTree);

    return PDFDocument.fromIndex(index);
  };

  /**
   * Loads an existing PDF document contained from the specified `Uint8Array`
   * into a [[PDFDocument]] object. Useful for modifying existing PDF documents.
   *
   * @param data A `Uint8Array` containing the raw bytes of a PDF document.
   *
   * @returns A [[PDFDocument]] object initialized from the provided document.
   */
  static load = (data: Uint8Array): PDFDocument => {
    validate(
      data,
      isInstance(Uint8Array),
      '"PDFDocumentFactory.load()" must be called with an argument of type Uint8Array.',
    );

    const index = PDFObjectIndex.create();
    const pdfParser = new PDFParser();

    const parsedPdf = pdfParser.parse(data, index);

    const indexMap = PDFDocumentFactory.normalize(parsedPdf);
    index.index = indexMap;

    return PDFDocument.fromIndex(index);
  };

  // TODO: Need to throw out objects with "free" obj numbers...
  /** @hidden */
  private static normalize = ({
    dictionaries,
    arrays,
    original: { body },
    updates,
  }: IParsedPDF): Map<PDFIndirectReference, PDFObject> => {
    const index: Map<PDFIndirectReference, PDFObject> = new Map();

    // Remove Object Streams and Cross Reference Streams, because we've already
    // parsed the Object Streams into PDFIndirectObjects, and will just write
    // them as such and use normal xref tables to reference them.
    const shouldKeep = (object: PDFObject) =>
      !(object instanceof PDFObjectStream) &&
      !(
        object instanceof PDFStream &&
        object.dictionary.getMaybe('Type') === PDFName.from('XRef')
      );

    // Initialize index with objects in the original body
    body.forEach(({ pdfObject }, ref) => {
      if (shouldKeep(pdfObject)) index.set(ref, pdfObject);
    });

    // Update index with most recent version of each object
    // TODO: This could be omitted to recover a previous version of the document...
    updates.forEach(({ body: updateBody }) => {
      updateBody.forEach(({ pdfObject }, ref) => {
        if (shouldKeep(pdfObject)) index.set(ref, pdfObject);
      });
    });

    return index;
  };
}

export default PDFDocumentFactory;
