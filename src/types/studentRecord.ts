export interface PersonDetails {
  nombre: string;
  fechaNacimiento: string;
  curp: string;
  escolaridad: string;
  ocupacion: string;
  lugarTrabajo: string;
  telefonoTrabajo: string;
  celular: string;
  estadoCivil: string;
}

export interface ContactDetails {
  nombre: string;
  parentesco: string;
  telefono?: string;
}

export interface StudentRecordData {
  id?: string;
  createdAt?: string;
  escuela: string;
  nombre: string;
  genero: 'alumno' | 'alumna';
  foto: string;
  fotoAjuste: {
    x: number;
    y: number;
    zoom: number;
  };
  gradoGrupo: string;
  maestra: string;
  fechaNacimiento: string;
  lugarNacimiento: string;
  curp: string;
  edad: string;
  peso: string;
  estatura: string;
  alergias: string;
  calleNumero: string;
  codigoPostal: string;
  colonia: string;
  telefono: string;
  madre: PersonDetails;
  padre: PersonDetails;
  emergencias: [ContactDetails, ContactDetails];
  autorizados: [ContactDetails, ContactDetails];
}
