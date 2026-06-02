// Minimal shim until @types/pdfkit can be installed.
// pdfkit ships its own bundled types but they conflict with the current
// @types/node Buffer definitions; this ambient declaration suppresses the error.
declare module 'pdfkit';
