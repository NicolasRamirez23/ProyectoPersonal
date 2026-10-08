export type GrammaticalGender = 'M' | 'F';

export interface NotarySearchOfficeData {
  place: string;
  issueDate: string;
  authorityName: string;
  authorityTitle: string;
  authorityDepartment: string;
  authorityGender: GrammaticalGender;
  radicationInstrument: string;
  radicationVolume: string;
  radicationDate: string;
  deceasedName: string;
  deceasedGender: GrammaticalGender;
  willInstrument: string;
  willVolume: string;
  willNotaryName: string;
  willNotaryNumber: string;
  willPlace: string;
  willDate: string;
  nationality: string;
  birthCity: string;
  birthState: string;
  birthDate: string;
  maritalStatus: string;
  occupation: string;
  street: string;
  exteriorNumber: string;
  interiorNumber: string;
  neighborhood: string;
  postalCode: string;
  city: string;
  state: string;
  curp: string;
  rfc: string;
  ineFolio: string;
  fatherName: string;
  fatherDeceased: boolean;
  motherName: string;
  motherDeceased: boolean;
  signerName: string;
  signerTitle: string;
  legalBasis: string;
}

export interface NotaryStoredDocument {
  id: string;
  folio: string;
  createdAt: string;
  formatType: string;
  referenceName: string;
  authority: string;
  data: NotarySearchOfficeData | NotaryPublicRegistrySearchData;
  docxPath?: string;
  pdfPath?: string;
  docxUrl?: string;
  pdfUrl?: string;
}

export interface NotaryPublicRegistrySearchData {
  place: string; issueDate: string;
  authorityName: string; authorityTitle: string; authorityDepartment: string;
  deceasedName: string; deceasedGender: GrammaticalGender;
  heirNames: string[]; executorName: string;
  willInstrument: string; willInstrumentWords: string; willVolume: string; willVolumeWords: string;
  willDate: string; willNotaryName: string; willNotaryNumber: string; willPlace: string;
  nationality: string; birthCity: string; birthState: string; birthDate: string;
  maritalStatus: string; occupation: string; fullAddress: string; curp: string;
  fatherName: string; fatherDeceased: boolean; motherName: string; motherDeceased: boolean;
  signerName: string; signerTitle: string;
  caseId?: string; sourceDocumentId?: string; sourceFileName?: string;
}
