# Configuración segura de IA para Notaría

La bandeja utiliza OCR local y después invoca la Edge Function `analyze-notary-document`.
La función envía a Vertex AI solamente el texto OCR necesario; nunca comparte una llave de
Supabase ni permite que el modelo confirme o modifique directamente clientes.

## Secretos requeridos en Supabase

- `APP_ORIGIN`: dominio exacto de producción, por ejemplo `https://mi-sistema.vercel.app`.
- `GOOGLE_CLOUD_PROJECT`: identificador del proyecto empresarial de Google Cloud.
- `GOOGLE_CLOUD_LOCATION`: región autorizada para procesar los datos.
- `VERTEX_MODEL`: modelo de Vertex AI aprobado por la notaría.
- `GOOGLE_SERVICE_ACCOUNT_JSON`: JSON completo de una cuenta de servicio limitada a invocar Vertex AI.

No agregues estos valores a `.env.local`, GitHub o variables con prefijo `VITE_`.

## Antes de activar con expedientes reales

1. Firmar y revisar el acuerdo de tratamiento de datos de Google Cloud.
2. Elegir una región permitida y confirmar residencia de datos.
3. Solicitar la excepción de monitoreo de abuso si se requiere retención cero.
4. Desactivar el almacenamiento en caché del proyecto si la política de la notaría lo exige.
5. No habilitar Grounding con Google Search o Maps.
6. Otorgar a la cuenta de servicio solamente el permiso de uso de Vertex AI.
7. Desplegar la función y probar primero con documentos ficticios.

El resultado de la IA queda como propuesta `por_revisar`. Una persona autorizada debe cotejar
el documento original y confirmar o corregir cada dato.
